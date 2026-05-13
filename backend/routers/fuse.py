import asyncio
import logging
from threading import Thread

from fastapi import APIRouter, WebSocket
from pydantic import BaseModel

from backend.ws.manager import manager_fuse
from backend.core.fusion_worker import ParticipantScanner, PreviewSignalsWorker, FusionWorker

logger = logging.getLogger("fusionstudio.fuse")

router = APIRouter()


class ScanRequest(BaseModel):
    source_dir: str


class SignalsRequest(BaseModel):
    file_path: str


class SignalRef(BaseModel):
    name: str
    g_idx: int
    c_idx: int


class RunRequest(BaseModel):
    source_dir: str
    participants: list[str]
    signal_whitelist: list[SignalRef] | None = None
    copy_videos: bool = False
    overwrite_mode: bool = False


class ControlRequest(BaseModel):
    pass


_active_worker: FusionWorker | None = None
_worker_thread: Thread | None = None


@router.post("/scan")
async def scan_participants(req: ScanRequest):
    loop = asyncio.get_event_loop()

    def _scan():
        scanner = ParticipantScanner(req.source_dir)
        return scanner.run()

    results = await loop.run_in_executor(None, _scan)
    return {"participants": results}


@router.post("/signals")
async def get_signals(req: SignalsRequest):
    loop = asyncio.get_event_loop()

    def _load():
        worker = PreviewSignalsWorker(req.file_path)
        return worker.run()

    data = await loop.run_in_executor(None, _load)
    if data is None:
        return {"channels": [], "error": "Failed to load signals"}
    return {"channels": data}


@router.post("/run")
async def run_fusion(req: RunRequest):
    global _active_worker, _worker_thread

    if _active_worker is not None:
        return {"status": "already_running"}

    loop = asyncio.get_event_loop()

    def on_log(msg):
        asyncio.run_coroutine_threadsafe(
            manager_fuse.broadcast({"type": "log", "message": msg}), loop
        )

    def on_progress(val):
        asyncio.run_coroutine_threadsafe(
            manager_fuse.broadcast({"type": "progress", "value": val}), loop
        )

    def on_participant_progress(name, pct):
        asyncio.run_coroutine_threadsafe(
            manager_fuse.broadcast({"type": "participant_progress", "name": name, "percent": pct}), loop
        )

    def on_participant_status(name, status):
        asyncio.run_coroutine_threadsafe(
            manager_fuse.broadcast({"type": "participant_status", "name": name, "status": status}), loop
        )

    def on_cleaning_mem(active):
        asyncio.run_coroutine_threadsafe(
            manager_fuse.broadcast({"type": "cleaning_mem", "active": active}), loop
        )

    def on_finished():
        global _active_worker
        asyncio.run_coroutine_threadsafe(
            manager_fuse.broadcast({"type": "finished"}), loop
        )
        _active_worker = None

    def on_error(err):
        global _active_worker
        asyncio.run_coroutine_threadsafe(
            manager_fuse.broadcast({"type": "error", "message": err}), loop
        )
        _active_worker = None

    whitelist = req.signal_whitelist
    if whitelist is not None:
        whitelist = [(w.name, w.g_idx, w.c_idx) for w in whitelist]

    worker = FusionWorker(
        source_dir=req.source_dir,
        participants_to_process=req.participants,
        signal_whitelist=whitelist,
        copy_videos=req.copy_videos,
        overwrite_mode=req.overwrite_mode,
        on_log=on_log,
        on_progress=on_progress,
        on_participant_progress=on_participant_progress,
        on_participant_status=on_participant_status,
        on_cleaning_mem=on_cleaning_mem,
        on_finished=on_finished,
        on_error=on_error,
    )

    _active_worker = worker

    def _run():
        worker.run()

    _worker_thread = Thread(target=_run, daemon=True)
    _worker_thread.start()

    return {"status": "started"}


@router.post("/pause")
async def pause_fusion():
    global _active_worker
    if _active_worker is not None:
        _active_worker.pause()
        return {"status": "paused"}
    return {"status": "no_worker"}


@router.post("/resume")
async def resume_fusion():
    global _active_worker
    if _active_worker is not None:
        _active_worker.resume()
        return {"status": "resumed"}
    return {"status": "no_worker"}


@router.post("/stop")
async def stop_fusion():
    global _active_worker
    if _active_worker is not None:
        _active_worker.stop()
        return {"status": "stopping"}
    return {"status": "no_worker"}


@router.websocket("/ws")
async def ws_fuse(ws: WebSocket):
    await manager_fuse.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except Exception:
        await manager_fuse.disconnect(ws)