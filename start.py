"""
start.py — Entry point for distribution with pywebview.
Launches FastAPI in a daemon thread and opens a native window.
"""
import sys
import threading
import time
import webview


HOST = "127.0.0.1"
PORT = 8000


def start_server():
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=HOST,
        port=PORT,
        log_level="warning",
        access_log=False,
    )


def wait_for_server(url, timeout=15):
    import urllib.request
    import urllib.error
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = urllib.request.urlopen(url, timeout=1)
            if resp.status == 200:
                return True
        except (urllib.error.URLError, ConnectionRefusedError, OSError):
            pass
        time.sleep(0.3)
    return False


if __name__ == "__main__":
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    url = f"http://{HOST}:{PORT}"
    print(f"[FusionStudio] Starting server on {url}...")

    if wait_for_server(f"{url}/api/health"):
        print(f"[FusionStudio] Server ready. Opening window...")
    else:
        print(f"[FusionStudio] WARNING: Server did not respond within timeout. Opening window anyway...")

    webview.create_window(
        title="Fusion Studio | Applus+ IDIADA",
        url=url,
        width=1400,
        height=900,
        resizable=True,
        min_size=(1100, 750),
    )
    webview.start()