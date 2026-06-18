import sys
import os
import shutil
import ctypes
from ctypes import wintypes

IDIADA_ORANGE = '#F39200'

def user_data_path(relative_path=""):
    app_data = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or os.path.expanduser("~")
    base_dir = os.path.join(app_data, "FusionStudio")
    if relative_path:
        if relative_path.startswith('assets/'):
            relative_path = 'backend/' + relative_path
        elif relative_path == 'models' or relative_path.startswith('models/'):
            relative_path = 'backend/' + relative_path
        elif relative_path == 'config' or relative_path.startswith('config/'):
            relative_path = 'backend/' + relative_path
        elif not relative_path.startswith('backend/'):
            relative_path = 'backend/assets/' + relative_path
        full_path = os.path.join(base_dir, relative_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        return full_path
    os.makedirs(base_dir, exist_ok=True)
    return base_dir

def resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        base_path = sys._MEIPASS
    else:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        base_path = os.path.dirname(os.path.dirname(current_dir))

    # Redirect legacy root paths to their new organized subdirectories
    if relative_path.startswith('assets/'):
        relative_path = 'backend/' + relative_path
    elif relative_path == 'models' or relative_path.startswith('models/'):
        relative_path = 'backend/' + relative_path
    elif relative_path == 'config' or relative_path.startswith('config/'):
        relative_path = 'backend/' + relative_path
    elif not relative_path.startswith('backend/'):
        relative_path = 'backend/assets/' + relative_path

    return os.path.join(base_path, relative_path)

def shared_asset_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        pass

    if hasattr(sys, '_MEIPASS'):
        return os.path.join(base_path, "frontend", "public", "assets", relative_path)

    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(current_dir))
    return os.path.join(project_root, "frontend", "public", "assets", relative_path)

def clone_file_metadata(src, dst):
    if not os.path.exists(src) or not os.path.exists(dst):
        return

    try:
        shutil.copystat(src, dst)
    except Exception as e:
        print(f"Error copying stat: {e}")

    if os.name == 'nt':
        try:
            creation_time = os.path.getctime(src)
            timestamp = int((creation_time * 10000000) + 116444736000000000)
            ctime = wintypes.FILETIME(timestamp & 0xFFFFFFFF, timestamp >> 32)
            handle = ctypes.windll.kernel32.CreateFileW(
                dst, 256, 0, None, 3, 128, None
            )
            if handle != -1:
                ctypes.windll.kernel32.SetFileTime(handle, ctypes.byref(ctime), None, None)
                ctypes.windll.kernel32.CloseHandle(handle)
        except Exception as e:
            print(f"Error setting creation time: {e}")