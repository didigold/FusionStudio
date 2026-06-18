import os
import subprocess
import shutil
import sys

def run_command(command, cwd=None):
    print(f"Running: {command} in {cwd or '.'}")
    result = subprocess.run(command, shell=True, cwd=cwd)
    if result.returncode != 0:
        raise Exception(f"Command failed with exit code {result.returncode}")

def find_inno_compiler():
    # 1. Check user local app data (non-admin install)
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        path = os.path.join(local_app_data, "Programs", "Inno Setup 6", "ISCC.exe")
        if os.path.exists(path):
            return path
            
    # 2. Check standard system paths
    standard_paths = [
        r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        r"C:\Program Files\Inno Setup 6\ISCC.exe"
    ]
    for path in standard_paths:
        if os.path.exists(path):
            return path
            
    return None

def build():
    # Get absolute path to project root
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    # Current version of the application (keep in sync with updates)
    app_version = "1.0"
    
    print("--- Cleaning Build Artifacts ---")
    for d in ["build", "dist"]:
        path = os.path.join(project_root, d)
        if os.path.exists(path):
            shutil.rmtree(path, ignore_errors=True)
    spec_path = os.path.join(project_root, "FusionStudio.spec")
    if os.path.exists(spec_path):
        os.remove(spec_path)
    
    # 1. Build frontend
    print("--- Building Frontend ---")
    run_command("npx vite build", cwd=os.path.join(project_root, "frontend"))
    
    # 2. Prepare Splash Screen
    print("--- Preparing Splash Screen ---")
    run_command("python scripts/prepare_splash.py", cwd=project_root)
    
    # 3. Setup PyInstaller arguments
    print("--- Packaging with PyInstaller ---")
    
    pyinstaller_args = [
        "python",
        "-m",
        "PyInstaller",
        "--onedir",
        "--noconsole",
        "--clean",
        "--noconfirm",
        "--name=FusionStudio",
        "--icon=backend/assets/icon.ico",
        
        # Add backend project resources
        '--add-data=backend/assets;backend/assets',
        '--add-data=backend/config;backend/config',
        '--add-data=backend/models;backend/models',
        
        # Add frontend static distribution and shared assets
        '--add-data=frontend/dist;frontend/dist',
        '--add-data=frontend/public/assets;frontend/public/assets',
        
        # Collect third-party data and binaries that PyInstaller misses
        '--collect-data=mediapipe',
        '--collect-data=asammdf',
        '--collect-data=pythonnet',
        
        # Hidden imports for Uvicorn and Websockets dynamic protocols
        '--hidden-import=clr',
        '--hidden-import=uvicorn.protocols.http.h11_impl',
        '--hidden-import=uvicorn.protocols.http.flow_control',
        '--hidden-import=uvicorn.protocols.websockets.wsproto_impl',
        '--hidden-import=uvicorn.protocols.websockets.websockets_impl',
        '--hidden-import=uvicorn.lifespan.on',
        '--hidden-import=uvicorn.lifespan.off',
        '--hidden-import=uvicorn.loops.auto',
        '--hidden-import=uvicorn.loops.asyncio',
        '--hidden-import=websockets.legacy.server',
        '--hidden-import=websockets.legacy.client',
        '--hidden-import=websockets.legacy.auth',
        '--hidden-import=websockets.legacy.handshake',
        '--hidden-import=websockets.legacy.http',
        '--hidden-import=websockets.legacy.protocol',
        
        # Exclude unnecessary Qt bindings that cause packaging conflicts
        '--exclude-module=PyQt5',
        '--exclude-module=PyQt6',
        '--exclude-module=PySide6',
        '--exclude-module=PySide2',
        
        # Entrypoint script
        "run_desktop.py"
    ]
    
    # Construct and run the command
    pyinstaller_cmd = " ".join(pyinstaller_args)
    run_command(pyinstaller_cmd, cwd=project_root)
    
    # 4. Check for Inno Setup compiler and compile setup
    inno_compiler = find_inno_compiler()
    if inno_compiler:
        print("\n--- Compiling Installer with Inno Setup ---")
        iss_path = os.path.join(project_root, "scripts", "installer_script.iss")
        run_command(f'"{inno_compiler}" /DAppVersion="{app_version}" "{iss_path}"', cwd=project_root)
        print("\n" + "="*50)
        print("--- Installer Compiled Successfully ---")
        print(f"Setup installer available at:\n{os.path.join(project_root, 'dist', 'FusionStudio_Setup.exe')}")
        print("="*50)
    else:
        print("\n" + "="*50)
        print("--- Build Finished Successfully ---")
        print("[INFO] Inno Setup compiler (ISCC.exe) not found.")
        print("Standalone folder is compiled, but no setup installer was created.")
        print(f"Standalone application folder is available at:\n{os.path.join(project_root, 'dist', 'FusionStudio')}")
        print("="*50)

if __name__ == "__main__":
    build()
