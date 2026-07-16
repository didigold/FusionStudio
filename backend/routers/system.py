import os
import re
import json
import sys
import subprocess
import tempfile
import winreg
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

from backend.config.version import APP_VERSION

router = APIRouter()

# ─── Inno Setup App ID (must match installer_script.iss) ───────────────────
INNO_APP_ID = "928AD631-4FEF-407E-971D-3A252E9B5690"

# ─────────────────────────────────────────────────────────────────────────────
# Settings
# ─────────────────────────────────────────────────────────────────────────────

def get_settings_file_path():
    """
    Returns the path to the settings JSON file.
    
    Production builds (frozen by PyInstaller) use:   %APPDATA%\FusionStudio\app_settings.json
    Dev mode (not frozen) uses:                       %APPDATA%\FusionStudio_dev\app_settings.json
    
    This ensures dev-mode preferences never contaminate a fresh production install,
    while still being preserved across updates (since APPDATA is NOT wiped on uninstall).
    """
    is_frozen = getattr(sys, 'frozen', False)
    folder_name = "FusionStudio" if is_frozen else "FusionStudio_dev"

    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA")
        dir_path = os.path.join(appdata, folder_name) if appdata else os.path.expanduser(f"~/.{folder_name.lower()}")
    elif sys.platform == "darwin":
        dir_path = os.path.expanduser(f"~/Library/Application Support/{folder_name}")
    else:
        dir_path = os.path.expanduser(f"~/.config/{folder_name.lower()}")

    os.makedirs(dir_path, exist_ok=True)
    return os.path.join(dir_path, "app_settings.json")


class SettingsPayload(BaseModel):
    theme: Optional[str] = "dark"
    color_theme: Optional[str] = "default"
    recent_projects: Optional[List[str]] = []

@router.get("/settings")
async def get_settings():
    path = get_settings_file_path()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "theme": "dark",
        "color_theme": "default",
        "recent_projects": []
    }

@router.post("/settings")
async def save_settings(payload: SettingsPayload):
    path = get_settings_file_path()
    try:
        data = {
            "theme": payload.theme,
            "color_theme": payload.color_theme,
            "recent_projects": payload.recent_projects
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Update check
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/check-update")
async def check_update():
    user_home = os.path.expanduser('~')
    tools_dir = os.path.join(
        user_home,
        "IDIADA Group",
        "Grp__ADASTesting_Electronic Chassis Control Systems - Documentos",
        "Analysis",
        "Tools",
        "FusionStudio"
    )

    update_available = False
    latest_version = APP_VERSION
    installer_path = None

    if not os.path.exists(tools_dir):
        return {
            "update_available": False,
            "version": APP_VERSION,
            "error": f"Tools directory not found: {tools_dir}"
        }

    max_version_float = 0.0
    try:
        max_version_float = float(APP_VERSION)
    except ValueError:
        pass

    latest_dir_name = None

    for item in os.listdir(tools_dir):
        item_path = os.path.join(tools_dir, item)
        if os.path.isdir(item_path) and item.startswith("FusionStudio_"):
            match = re.search(r"FusionStudio_(\d+\.\d+)", item)
            if match:
                version_str = match.group(1)
                try:
                    version_float = float(version_str)
                    if version_float > max_version_float:
                        max_version_float = version_float
                        latest_version = version_str
                        latest_dir_name = item
                        update_available = True
                except ValueError:
                    continue

    if update_available and latest_dir_name:
        potential_installer = os.path.join(tools_dir, latest_dir_name, "FusionStudio_Setup.exe")
        if os.path.exists(potential_installer):
            installer_path = potential_installer
        else:
            update_available = False

    return {
        "update_available": update_available,
        "version": latest_version,
        "installer_path": installer_path
    }


# ─────────────────────────────────────────────────────────────────────────────
# Apply update — clean uninstall + silent install via detached batch script
# ─────────────────────────────────────────────────────────────────────────────

def _find_uninstaller() -> Optional[str]:
    """
    Look up the Inno Setup uninstaller path from the Windows registry.
    Checks both HKCU and HKLM (user-level and system-level installs).
    Returns the path to unins000.exe if found, otherwise None.
    """
    reg_key = f"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{{{INNO_APP_ID}}}_is1"
    for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        try:
            with winreg.OpenKey(hive, reg_key) as key:
                uninstall_str, _ = winreg.QueryValueEx(key, "UninstallString")
                # Inno Setup stores it as: "C:\path\unins000.exe"
                # Strip surrounding quotes if present
                uninstaller = uninstall_str.strip('"')
                if os.path.exists(uninstaller):
                    return uninstaller
        except (FileNotFoundError, OSError):
            continue
    return None


class ApplyUpdatePayload(BaseModel):
    installer_path: str

@router.post("/apply-update")
async def apply_update(payload: ApplyUpdatePayload):
    if not payload.installer_path or not os.path.exists(payload.installer_path):
        return {"success": False, "error": "Installer not found"}

    uninstaller = _find_uninstaller()

    try:
        # Build a self-deleting batch script that:
        #   1. Waits 3 s for the app process to fully exit
        #   2. Silently uninstalls the old version (if uninstaller found)
        #   3. Silently installs the new version
        #   4. Deletes itself
        #
        # User settings live in %APPDATA%\FusionStudio\ which Inno Setup does NOT
        # touch during uninstall, so color theme, recent projects, etc. are preserved.

        uninstall_line = (
            f'"{uninstaller}" /SILENT /NORESTART\r\n'
            if uninstaller
            else "rem No previous uninstaller found, skipping uninstall step\r\n"
        )

        batch_content = (
            "@echo off\r\n"
            "timeout /t 3 /nobreak > nul\r\n"
            + uninstall_line +
            f'"{payload.installer_path}" /SILENT /NORESTART\r\n'
            "del \"%~f0\"\r\n"
        )

        # Write to a temp .bat file (won't be deleted by uninstall since it's in TEMP)
        fd, bat_path = tempfile.mkstemp(suffix=".bat", prefix="fusionstudio_update_")
        with os.fdopen(fd, "w") as f:
            f.write(batch_content)

        # Launch completely detached so it survives after os._exit(0)
        subprocess.Popen(
            ["cmd", "/c", bat_path],
            creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
            close_fds=True
        )

        # Terminate the current app — the batch script will handle the rest
        os._exit(0)

    except Exception as e:
        return {"success": False, "error": str(e)}

    user_home = os.path.expanduser('~')
    tools_dir = os.path.join(
        user_home, 
        "IDIADA Group", 
        "Grp__ADASTesting_Electronic Chassis Control Systems - Documentos", 
        "Analysis", 
        "Tools",
        "FusionStudio"
    )

    update_available = False
    latest_version = APP_VERSION
    installer_path = None

    if not os.path.exists(tools_dir):
        return {
            "update_available": False,
            "version": APP_VERSION,
            "error": f"Tools directory not found: {tools_dir}"
        }

    max_version_float = 0.0
    try:
        current_version_float = float(APP_VERSION)
        max_version_float = current_version_float
    except ValueError:
        pass

    latest_dir_name = None

    for item in os.listdir(tools_dir):
        item_path = os.path.join(tools_dir, item)
        if os.path.isdir(item_path) and item.startswith("FusionStudio_"):
            # Extract version using regex, e.g., FusionStudio_1.023
            match = re.search(r"FusionStudio_(\d+\.\d+)", item)
            if match:
                version_str = match.group(1)
                try:
                    version_float = float(version_str)
                    if version_float > max_version_float:
                        max_version_float = version_float
                        latest_version = version_str
                        latest_dir_name = item
                        update_available = True
                except ValueError:
                    continue

    if update_available and latest_dir_name:
        potential_installer = os.path.join(tools_dir, latest_dir_name, "FusionStudio_Setup.exe")
        if os.path.exists(potential_installer):
            installer_path = potential_installer
        else:
            update_available = False

    return {
        "update_available": update_available,
        "version": latest_version,
        "installer_path": installer_path
    }

@router.post("/apply-update")
async def apply_update(payload: ApplyUpdatePayload):
    if not payload.installer_path or not os.path.exists(payload.installer_path):
        return {"success": False, "error": "Installer not found"}

    try:
        # Launch the installer independently
        os.startfile(payload.installer_path)
        
        # Kill the current application
        os._exit(0)
    except Exception as e:
        return {"success": False, "error": str(e)}

import json
import sys
from typing import List, Optional

class SettingsPayload(BaseModel):
    theme: Optional[str] = "dark"
    color_theme: Optional[str] = "default"
    recent_projects: Optional[List[str]] = []

def get_settings_file_path():
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA")
        if appdata:
            dir_path = os.path.join(appdata, "FusionStudio")
        else:
            dir_path = os.path.expanduser("~/.fusionstudio")
    elif sys.platform == "darwin":
        dir_path = os.path.expanduser("~/Library/Application Support/FusionStudio")
    else:
        dir_path = os.path.expanduser("~/.config/fusionstudio")
    os.makedirs(dir_path, exist_ok=True)
    return os.path.join(dir_path, "app_settings.json")

@router.get("/settings")
async def get_settings():
    path = get_settings_file_path()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "theme": "dark",
        "color_theme": "default",
        "recent_projects": []
    }

@router.post("/settings")
async def save_settings(payload: SettingsPayload):
    path = get_settings_file_path()
    try:
        data = {
            "theme": payload.theme,
            "color_theme": payload.color_theme,
            "recent_projects": payload.recent_projects
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
