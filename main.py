import os
import sys
import subprocess
import importlib.util

# --- WINDOWS TASKBAR ICON FIX ---
# Must be called as early as possible, before any windows are created
if os.name == 'nt':
    import ctypes
    try:
        myappid = u'applusidiada.fusionstudio.v1'
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
    except Exception:
        pass

def bootstrap():
    """Stage 1: Ensure minimal dependencies for the GUI are installed."""
    # List of critical libraries needed JUST to show the splash screen
    critical_deps = ["PySide6", "packaging"]
    
    missing = []
    for dep in critical_deps:
        if importlib.util.find_spec(dep) is None:
            missing.append(dep)
            
    if missing:
        print(f"--- Stage 1: Initializing environment ({', '.join(missing)}) ---")
        try:
            # Upgrade pip first to ensure we can handle latest wheels/packages
            subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "pip"], 
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            # Use sys.executable to ensure we use the same Python/venv
            subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing)
            print("--- Stage 1: Core framework ready ---")
        except Exception as e:
            print(f"Critical error during Stage 1 bootstrap: {e}")
            sys.exit(1)

def run_app():
    """Stage 2: Launch the application."""
    
    # --- NUMPY 1.24+ COMPATIBILITY PATCH ---
    # Newer versions of asammdf, MediaPipe, and other libs use np.bool which was removed in NumPy 1.24.
    try:
        import numpy as np
        # List of attributes removed in NumPy 1.24/2.0 that we want to restore for legacy libs
        patch_map = {
            'bool': bool,
            'float': float,
            'int': int,
            'object': object,
            'complex': complex,
            'str': str,
            'unicode': str
        }
        for attr, builtin_type in patch_map.items():
            if not hasattr(np, attr):
                setattr(np, attr, builtin_type)
        
        # Explicitly ensure it's on the 'numpy' module object in sys.modules
        if 'numpy' in sys.modules:
            for attr, builtin_type in patch_map.items():
                if not hasattr(sys.modules['numpy'], attr):
                    setattr(sys.modules['numpy'], attr, builtin_type)
            
        import warnings
        # Suppress asammdf FutureWarning regarding np.bool
        warnings.filterwarnings("ignore", category=FutureWarning, module="asammdf")
    except ImportError:
        pass

    # We MUST import these AFTER bootstrap to avoid ModuleNotFoundError
    from PySide6.QtWidgets import QApplication
    from PySide6.QtGui import QIcon, QFontDatabase, QFont
    from PySide6.QtCore import Qt
    
    from src.ui.splash_screen import SplashScreen
    from src.core.utils import resource_path

    # Sharpness fix for High DPI
    QApplication.setHighDpiScaleFactorRoundingPolicy(Qt.HighDpiScaleFactorRoundingPolicy.PassThrough)
    
    app = QApplication(sys.argv)
    app.setApplicationName("FusionStudio")
    app.setOrganizationName("ApplusIDIADA")
    icon_path = resource_path("assets/icon.ico")
    app.setWindowIcon(QIcon(icon_path))
    
    # Load static fonts
    QFontDatabase.addApplicationFont(resource_path("assets/fonts/Switzer_Complete/Fonts/OTF/Switzer-Regular.otf"))
    id2 = QFontDatabase.addApplicationFont(resource_path("assets/fonts/Switzer_Complete/Fonts/OTF/Switzer-Medium.otf"))
    QFontDatabase.addApplicationFont(resource_path("assets/fonts/Switzer_Complete/Fonts/OTF/Switzer-Bold.otf"))
    
    if id2 != -1:
        font_family = QFontDatabase.applicationFontFamilies(id2)[0]
        switzer_medium = QFont(font_family, 10, QFont.Medium)
        switzer_medium.setHintingPreference(QFont.HintingPreference.PreferNoHinting)
        app.setFont(switzer_medium)

    app.setQuitOnLastWindowClosed(False)
    splash = SplashScreen()
    splash.setWindowIcon(QIcon(icon_path))  # Set icon on splash to help taskbar association
    window = None
    
    def on_splash_finished():
        nonlocal window
        from src.ui.main_window import MainWindow
        
        # Instantiate MainWindow while splash is still showing
        window = MainWindow()
        
        # Center window on splash screen
        screen = splash.screen()
        if screen:
             window.setScreen(screen)
             window.move(screen.geometry().topLeft())
        
        window.showMaximized()
        app.setQuitOnLastWindowClosed(True)
        
        # Now fade out splash for a seamless transition
        splash.close_with_fade()
    
    splash.loading_finished.connect(on_splash_finished)
    splash.start()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    # Ensure project root is in path
    root = os.path.dirname(os.path.abspath(__file__))
    if root not in sys.path:
        sys.path.insert(0, root)
        
    bootstrap()
    run_app()
