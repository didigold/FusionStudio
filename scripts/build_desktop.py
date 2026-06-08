import os
import subprocess
import shutil
import sys

def run_command(command, cwd=None):
    print(f"Running: {command} in {cwd or '.'}")
    result = subprocess.run(command, shell=True, cwd=cwd)
    if result.returncode != 0:
        raise Exception(f"Command failed with exit code {result.returncode}")

def build():
    # Get absolute path to project root
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    # 1. Build frontend
    print("--- Building Frontend ---")
    run_command("npx vite build", cwd=os.path.join(project_root, "frontend"))
    
    # 2. Setup PyInstaller arguments
    print("--- Packaging with PyInstaller ---")
    
    pyinstaller_args = [
        "python",
        "-m",
        "PyInstaller",
        "--onedir",
        "--noconsole",
        "--clean",
        "--noconfirm",
        "--name=FusionStudio_Pro",
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
        
        # Hidden imports for Uvicorn and Websockets dynamic protocols
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
    
    print("\n" + "="*50)
    print("--- Build Finished Successfully ---")
    print(f"Standalone application folder is available at:\n{os.path.join(project_root, 'dist', 'FusionStudio_Pro')}")
    print("="*50)

if __name__ == "__main__":
    build()
