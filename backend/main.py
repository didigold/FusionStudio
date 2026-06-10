import os
import sys
import logging
from contextlib import asynccontextmanager

# Ensure stdout and stderr handle UTF-8 output safely
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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.ws.system import system_monitor_loop
from backend.routers import fuse, analysis, classification, reporting, om, brain


logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    task = asyncio.create_task(system_monitor_loop())
    yield
    task.cancel()


DEV_MODE = os.getenv("FUSIONSTUDIO_DEV", "0") == "1"

app = FastAPI(
    title="FusionStudio API",
    docs_url="/docs" if DEV_MODE else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:8000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(fuse.router, prefix="/api/fuse")
app.include_router(analysis.router, prefix="/api/analysis")
app.include_router(classification.router, prefix="/api/classification")
app.include_router(reporting.router, prefix="/api/reporting")
app.include_router(om.router, prefix="/api/om")
app.include_router(brain.router, prefix="/api/brain")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "FusionStudio API"}

@app.get("/api/user/me")
async def get_current_user():
    import getpass
    try:
        username = getpass.getuser()
    except Exception:
        username = "User"
    
    return {
        "username": username
    }


FRONTEND_DIST = os.getenv("FUSIONSTUDIO_FRONTEND_DIST")

if not FRONTEND_DIST:
    # Check next to executable (fallback)
    import sys
    exe_dir = os.path.dirname(sys.executable)
    FRONTEND_DIST = os.path.join(exe_dir, "frontend", "dist")

if not FRONTEND_DIST or not os.path.exists(FRONTEND_DIST):
    # Fallback to source-relative path (dev mode)
    FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")

if os.path.exists(FRONTEND_DIST):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")