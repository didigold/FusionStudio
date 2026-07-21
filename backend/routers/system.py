import os
import re
import json
import sys
import subprocess
import tempfile
import winreg
import asyncio
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

def _read_settings(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/settings")
async def get_settings():
    path = get_settings_file_path()
    if os.path.exists(path):
        try:
            return await asyncio.to_thread(_read_settings, path)
        except Exception:
            pass
    return {
        "theme": "dark",
        "color_theme": "default",
        "recent_projects": []
    }

def _write_settings(path: str, data: dict):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@router.post("/settings")
async def save_settings(payload: SettingsPayload):
    path = get_settings_file_path()
    try:
        data = {
            "theme": payload.theme,
            "color_theme": payload.color_theme,
            "recent_projects": payload.recent_projects
        }
        await asyncio.to_thread(_write_settings, path, data)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Update check
# ─────────────────────────────────────────────────────────────────────────────

# Relative path expected inside the SharePoint document library
_TOOLS_RELATIVE_PATH = os.path.join("Analysis", "Tools", "FusionStudio")


def _collect_onedrive_mount_points() -> list[tuple[str, str]]:
    """
    Collects all OneDrive/SharePoint synced folder mount points from the Windows
    registry using three independent sources, ordered by reliability.

    Returns a list of (mount_point, source_label) tuples, deduplicated by
    normalized path so downstream code doesn't test the same folder twice.

    Sources:
        1. SyncEngines/Providers/OneDrive — the MountPoint value in each subkey.
           Present on most machines but not every subkey has it.
        2. OneDrive/Accounts/Business*/Tenants — each tenant subkey has value
           names that ARE the mount-point paths.  Very stable across corporate PCs.
        3. OneDrive/Accounts/Business*/ScopeIdToMountPointPathCache — similar to
           the Tenants approach; scope-id values map to mount paths.
    """
    results: list[tuple[str, str]] = []
    seen: set[str] = set()

    def _add(path: str, source: str):
        norm = os.path.normcase(os.path.normpath(path))
        if norm not in seen:
            seen.add(norm)
            results.append((path, source))

    # ── Strategy 1: SyncEngines registry ────────────────────────────────────
    try:
        key_path = r"Software\SyncEngines\Providers\OneDrive"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path) as key:
            for i in range(winreg.QueryInfoKey(key)[0]):
                subkey_name = winreg.EnumKey(key, i)
                try:
                    with winreg.OpenKey(key, subkey_name) as subkey:
                        mount_point, _ = winreg.QueryValueEx(subkey, "MountPoint")
                        if mount_point:
                            _add(mount_point, f"SyncEngines/{subkey_name}")
                except (FileNotFoundError, OSError):
                    pass
    except Exception:
        pass

    # ── Strategy 2: OneDrive Accounts Tenants ───────────────────────────────
    # Each Business account can have multiple tenants, and each tenant key
    # stores mount paths as *value names* (the value data is an opaque int).
    try:
        accounts_path = r"Software\Microsoft\OneDrive\Accounts"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, accounts_path) as accounts_key:
            for i in range(winreg.QueryInfoKey(accounts_key)[0]):
                account_name = winreg.EnumKey(accounts_key, i)
                if not account_name.lower().startswith("business"):
                    continue
                tenants_path = f"{accounts_path}\\{account_name}\\Tenants"
                try:
                    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, tenants_path) as tenants_key:
                        for j in range(winreg.QueryInfoKey(tenants_key)[0]):
                            tenant_name = winreg.EnumKey(tenants_key, j)
                            try:
                                with winreg.OpenKey(tenants_key, tenant_name) as tenant_key:
                                    num_values = winreg.QueryInfoKey(tenant_key)[1]
                                    for v in range(num_values):
                                        val_name, _, _ = winreg.EnumValue(tenant_key, v)
                                        if val_name and os.sep in val_name:
                                            _add(val_name, f"Tenants/{tenant_name}")
                            except (FileNotFoundError, OSError):
                                pass
                except (FileNotFoundError, OSError):
                    pass
    except Exception:
        pass

    # ── Strategy 3: ScopeIdToMountPointPathCache ────────────────────────────
    try:
        accounts_path = r"Software\Microsoft\OneDrive\Accounts"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, accounts_path) as accounts_key:
            for i in range(winreg.QueryInfoKey(accounts_key)[0]):
                account_name = winreg.EnumKey(accounts_key, i)
                if not account_name.lower().startswith("business"):
                    continue
                cache_path = f"{accounts_path}\\{account_name}\\ScopeIdToMountPointPathCache"
                try:
                    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, cache_path) as cache_key:
                        num_values = winreg.QueryInfoKey(cache_key)[1]
                        for v in range(num_values):
                            _, val_data, _ = winreg.EnumValue(cache_key, v)
                            if val_data and isinstance(val_data, str) and os.sep in val_data:
                                _add(val_data, f"ScopeCache/{account_name}")
                except (FileNotFoundError, OSError):
                    pass
    except Exception:
        pass

    return results


def find_sharepoint_tools_dir() -> tuple[str | None, list[str]]:
    """
    Dynamically searches for the SharePoint/OneDrive synced folder path that
    contains the FusionStudio update directory.

    Uses three registry strategies to discover OneDrive mount points, then
    falls back to common default home directory structures.

    Returns:
        (resolved_path or None, debug_log)
        debug_log contains human-readable diagnostic messages for remote
        troubleshooting when the update check fails on a coworker's PC.
    """
    debug_log: list[str] = []

    # ── Registry-based discovery ────────────────────────────────────────────
    mount_points = _collect_onedrive_mount_points()
    debug_log.append(f"Registry mount points found: {len(mount_points)}")

    for mount_point, source in mount_points:
        target = os.path.join(mount_point, _TOOLS_RELATIVE_PATH)
        exists = os.path.exists(target)
        debug_log.append(f"  [{source}] {target} -> {'EXISTS' if exists else 'NOT FOUND'}")
        if exists:
            return target, debug_log

    # ── Fallback: common default home paths ─────────────────────────────────
    user_home = os.path.expanduser("~")
    # The synced folder name under ~ depends on the Azure AD tenant display
    # name, which can vary across organizations and language settings.
    tenants = ["IDIADA Group", "Applus IDIADA", "IDIADA"]
    # The SharePoint document library name may be localized (e.g. Catalan,
    # Spanish, English).  We try the known variants.
    library_names = [
        "Grp__ADASTesting_Electronic Chassis Control Systems - Documentos",
        "Grp__ADASTesting_Electronic Chassis Control Systems - Documents",
        "Grp__ADASTesting_Electronic Chassis Control Systems - Documents compartits",
    ]
    debug_log.append(f"Trying home-dir fallbacks under {user_home}")
    for tenant in tenants:
        for library in library_names:
            path = os.path.join(user_home, tenant, library, _TOOLS_RELATIVE_PATH)
            exists = os.path.exists(path)
            debug_log.append(f"  [{tenant}/{library[:30]}...] -> {'EXISTS' if exists else 'NOT FOUND'}")
            if exists:
                return path, debug_log

    debug_log.append("All strategies exhausted — no FusionStudio tools directory found.")
    return None, debug_log


@router.get("/check-update")
async def check_update():
    tools_dir, debug_log = find_sharepoint_tools_dir()

    update_available = False
    latest_version = APP_VERSION
    installer_path = None

    if tools_dir is None or not os.path.exists(tools_dir):
        return {
            "update_available": False,
            "version": APP_VERSION,
            "error": f"Tools directory not found",
            "debug_log": debug_log,
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
        "installer_path": installer_path,
        "debug_log": debug_log,
    }


@router.get("/debug-update-paths")
async def debug_update_paths():
    """
    Diagnostic endpoint that returns all registry-discovered OneDrive mount
    points and the full resolution log.  Ask a coworker to open this URL in
    their browser to troubleshoot update-discovery failures.
    """
    mount_points = _collect_onedrive_mount_points()
    tools_dir, debug_log = find_sharepoint_tools_dir()
    return {
        "resolved_tools_dir": tools_dir,
        "mount_points": [{"path": p, "source": s} for p, s in mount_points],
        "debug_log": debug_log,
        "current_version": APP_VERSION,
        "user_home": os.path.expanduser("~"),
        "hostname": os.environ.get("COMPUTERNAME", "unknown"),
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


