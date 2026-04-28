import sys
import os
import shutil
import ctypes
from ctypes import wintypes

# --- FUNCIÓN DE RUTAS ABSOLUTAS ---
def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.dirname(os.path.abspath(__file__))
        # Adjustment for when running from src/core/utils.py or similar depth 
        # in development, but usually sys._MEIPASS handles PyInstaller.
        # If running as script from 'src/core', we probably want to go up to project root
        # But commonly resource_path expects relative_path from where 'main' is.
        # Let's keep the original logic but be mindful of CWD.
        # In the original file, it was in root.
        # If we run 'main.py' in root, __file__ of main is in root.
        
    # If running from source (no MEIPASS)
    if not hasattr(sys, '_MEIPASS'):
        # Assuming the assets folder is in the project root
        # We need to find the project root from this file's location: src/core/utils.py
        # root is ../../
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(os.path.dirname(current_dir))
        return os.path.join(project_root, relative_path)
        
    return os.path.join(base_path, relative_path)

# --- CLONADO DE METADATOS (WINDOWS) ---
def clone_file_metadata(src, dst):
    """
    Copia fecha de Creación, Modificación y Acceso de src a dst.
    Funciona en Windows para Creation Time usando kernel32.
    """
    if not os.path.exists(src) or not os.path.exists(dst): return

    # 1. Modificación y Acceso (Estándar Python)
    try:
        shutil.copystat(src, dst)
    except Exception as e:
        print(f"Error copying stat: {e}")

    # 2. Fecha de Creación (Solo Windows - Truco ctypes)
    if os.name == 'nt':
        try:
            # Obtener timestamp de creación del original
            creation_time = os.path.getctime(src)
            
            # Convertir timestamp a formato Windows FileTime (100ns intervals since 1601-01-01)
            timestamp = int((creation_time * 10000000) + 116444736000000000)
            ctime = wintypes.FILETIME(timestamp & 0xFFFFFFFF, timestamp >> 32)
            
            # Abrir archivo destino para escribir atributos
            handle = ctypes.windll.kernel32.CreateFileW(
                dst, 256, 0, None, 3, 128, None
            )
            if handle != -1:
                ctypes.windll.kernel32.SetFileTime(handle, ctypes.byref(ctime), None, None)
                ctypes.windll.kernel32.CloseHandle(handle)
        except Exception as e:
            print(f"Error setting creation time: {e}")
