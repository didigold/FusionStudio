import os
import sys
import socket
import threading
import uvicorn
import webview

# Force UTF-8 environment encoding for stdout/stderr streams
os.environ["PYTHONIOENCODING"] = "utf-8"

# Reconfigure stdout/stderr streams to handle UTF-8 and fallback gracefully
if sys.stdout is not None:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr is not None:
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def get_free_port():
    preferred_ports = [8001, 8002, 8003, 8004, 8005]
    for port in preferred_ports:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(('127.0.0.1', port))
            s.close()
            return port
        except socket.error:
            continue
            
    # Fallback to random port if all preferred are busy
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port

def run_api(port, frontend_dist):
    # Set the frontend dist path in env so main.py knows where it is
    os.environ["FUSIONSTUDIO_FRONTEND_DIST"] = frontend_dist
    os.environ["FUSIONSTUDIO_DEV"] = "0"
    
    # Import the FastAPI app inside the function to ensure the env var is set before import
    from backend.main import app
    
    # Run uvicorn programmatically
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")

if __name__ == "__main__":
    # 1. Resolve frontend and splash paths
    if hasattr(sys, '_MEIPASS'):
        # In PyInstaller, the frontend dist and assets will be copied into the bundle
        frontend_dist = os.path.join(sys._MEIPASS, "frontend", "dist")
        splash_html = os.path.join(sys._MEIPASS, "backend", "assets", "splash.html")
    else:
        # In dev mode, use source relative path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        frontend_dist = os.path.join(current_dir, "frontend", "dist")
        splash_html = os.path.join(current_dir, "backend", "assets", "splash.html")
        
    frontend_dist = os.path.abspath(frontend_dist)
    splash_html = os.path.abspath(splash_html)
    
    # 2. Get a free port
    port = get_free_port()
    
    # 3. Start FastAPI in a background thread
    api_thread = threading.Thread(target=run_api, args=(port, frontend_dist), daemon=True)
    api_thread.start()
    
    # 4. Open native GUI window with local splash screen first
    initial_url = splash_html if os.path.exists(splash_html) else f"http://127.0.0.1:{port}"
    
    # Create window (uses Edge Webview2 under the hood)
    window = webview.create_window(
        title="FusionStudio",
        url=initial_url,
        width=1280,
        height=800,
        resizable=True,
        min_size=(1024, 768),
        background_color='#060608'
    )
    
    def check_backend_ready():
        import http.client
        import time
        
        start_time = time.time()
        backend_url = f"http://127.0.0.1:{port}"
        
        # Poll health endpoint until backend is active
        backend_ready = False
        while not backend_ready:
            try:
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=1)
                conn.request("GET", "/api/health")
                response = conn.getresponse()
                if response.status == 200:
                    backend_ready = True
                conn.close()
                if backend_ready:
                    break
            except Exception:
                pass
            time.sleep(0.1)
            
        # Enforce minimum splash screen display duration of 5.0 seconds
        min_splash_time = 5.0
        elapsed = time.time() - start_time
        if elapsed < min_splash_time:
            time.sleep(min_splash_time - elapsed)
            
        # Redirect window to final FastAPI url
        window.load_url(backend_url)
        
    # Resolve a persistent user data directory (storage_path) for WebView2.
    # When packaged in an EXE and installed to Program Files, standard paths
    # like the EXE directory are read-only. Specifying a path in %APPDATA% (or
    # standard equivalents) guarantees that cookies and localStorage persist.
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA")
        if appdata:
            storage_path = os.path.join(appdata, "FusionStudio")
        else:
            storage_path = os.path.expanduser("~/.fusionstudio")
    elif sys.platform == "darwin":
        storage_path = os.path.expanduser("~/Library/Application Support/FusionStudio")
    else:
        storage_path = os.path.expanduser("~/.config/fusionstudio")

    storage_path = os.path.abspath(storage_path)
    os.makedirs(storage_path, exist_ok=True)

    # Start webview loop (blocks until window is closed)
    # We must explicitly disable private_mode to enable disk-backed localStorage and cache.
    webview.start(check_backend_ready, http_server=True, private_mode=False, storage_path=storage_path)
