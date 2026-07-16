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

import re

def get_app_version(project_root):
    try:
        config_path = os.path.join(project_root, "backend", "config", "version.py")
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                content = f.read()
                match = re.search(r'APP_VERSION\s*=\s*["\']([^"\']+)["\']', content)
                if match:
                    return match.group(1)
    except Exception as e:
        print(f"Warning: could not read version from version.py: {e}")
    return "1.0"

def bump_version(project_root, current_version):
    """Increment the patch number in version.py for the next build.
    
    Format: X.YYY  ->  X.(YYY+1) zero-padded to 3 digits
    Example: 1.024  ->  1.025
    """
    try:
        parts = current_version.split(".")
        major = parts[0]
        patch = int(parts[1]) + 1
        # Preserve zero-padding (3 digits: 001, 002 ... 023, 024 ...)
        patch_str = str(patch).zfill(len(parts[1]))
        next_version = f"{major}.{patch_str}"
        
        config_path = os.path.join(project_root, "backend", "config", "version.py")
        with open(config_path, "w", encoding="utf-8") as f:
            f.write(f'APP_VERSION = "{next_version}"\n')
        
        print(f"  version.py updated: {current_version} -> {next_version}")
        print(f"  Next build will compile version {next_version}.")
        return next_version
    except Exception as e:
        print(f"Warning: could not auto-bump version: {e}")
        return current_version

def build():
    # Get absolute path to project root
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    # Current version of the application (dynamically loaded from version.py)
    app_version = get_app_version(project_root)
    
    print("="*50)
    print(f"  FusionStudio Build Script")
    print(f"  Building version: {app_version}")
    print("="*50)
    print("")
    
    print("--- Cleaning Build Artifacts ---")
    # Remove dist and build folders
    for d in ["build", "dist"]:
        path = os.path.join(project_root, d)
        if os.path.exists(path):
            shutil.rmtree(path, ignore_errors=True)
    # Remove old spec file
    spec_path = os.path.join(project_root, "FusionStudio.spec")
    if os.path.exists(spec_path):
        os.remove(spec_path)
    # Purge all __pycache__ dirs to ensure no stale Python bytecode is packaged
    for root, dirs, files in os.walk(project_root):
        for d in dirs:
            if d == "__pycache__":
                shutil.rmtree(os.path.join(root, d), ignore_errors=True)
    
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
        
        # Exclude heavy ML libraries that are not used but get pulled by sklearn
        '--exclude-module=torch',
        '--exclude-module=jaxlib',
        
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
        print("\n[PUBLISH INSTRUCTIONS]")
        print("To publish this update on SharePoint so that the app's auto-updater detects it:")
        print(f"1. Go to your SharePoint 'Tools/FusionStudio' directory.")
        print(f"2. Create a folder named exactly: FusionStudio_{app_version}")
        print(f"3. Copy 'FusionStudio_Setup.exe' into that new folder.")
        print("="*50)
        print("")
        print("--- Auto-bumping version for next build ---")
        bump_version(project_root, app_version)
    else:
        print("\n" + "="*50)
        print("--- Build Finished Successfully ---")
        print("[INFO] Inno Setup compiler (ISCC.exe) not found.")
        print("Standalone folder is compiled, but no setup installer was created.")
        print(f"Standalone application folder is available at:\n{os.path.join(project_root, 'dist', 'FusionStudio')}")
        print("\n[PUBLISH INSTRUCTIONS]")
        print("To make this a distributable version, install Inno Setup and rebuild, or compile manually.")
        print("Once compiled, place the installer inside a folder named: FusionStudio_<Version> in the 'SharePoint Tools/FusionStudio' directory.")
        print("="*50)
        print("")
        print("--- Auto-bumping version for next build ---")
        bump_version(project_root, app_version)

if __name__ == "__main__":
    build()
