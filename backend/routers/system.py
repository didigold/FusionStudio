import os
import re
from fastapi import APIRouter
from pydantic import BaseModel

from backend.config.version import APP_VERSION

router = APIRouter()

class ApplyUpdatePayload(BaseModel):
    installer_path: str

@router.get("/check-update")
async def check_update():
    user_home = os.path.expanduser('~')
    tools_dir = os.path.join(
        user_home, 
        "IDIADA Group", 
        "Grp__ADASTesting_Electronic Chassis Control Systems - Documentos", 
        "Analysis", 
        "Tools"
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
