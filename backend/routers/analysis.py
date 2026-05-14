import asyncio
import json
import logging
import os
import re
from threading import Thread

from fastapi import APIRouter, WebSocket, HTTPException, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.ws.manager import manager_analysis
from backend.core.audio_analysis import obtain_peak_frequency, find_first_valid_event
from backend.core.logic_engine import calculate_ncap_metrics
from backend.core.chronos_worker import ChronosWorker
from backend.core.chronos_manager import ChronosManager
from backend.core.utils import IDIADA_ORANGE

logger = logging.getLogger("fusionstudio.analysis")

router = APIRouter()


class ScanRequest(BaseModel):
    source_dir: str
    marks_path: str | None = None


class SignalPreviewRequest(BaseModel):
    file_path: str


class SignalDataRequest(BaseModel):
    file_path: str
    channel_name: str
    max_points: int = 100000


class AudioDetectRequest(BaseModel):
    file_path: str
    start_time: float = 9.0
    end_time: float = 10.5
    min_freq: float = 230
    max_freq: float = 2000
    signal_name: str = "SoundPressure"


class LogicRequest(BaseModel):
    file_path: str
    signal_map: dict
    marks_path: str | None = None
    thresholds: dict | None = None


class ChronosRequest(BaseModel):
    mf4_paths: list[str]
    camera_id: int = 0
    source_dir: str = ""


class BrowseRequest(BaseModel):
    path: str = ""


class MarksRequest(BaseModel):
    file_path: str
    marks: dict | list


_active_worker: ChronosWorker | None = None
_worker_thread: Thread | None = None


def _scan_analysis_dir(source_dir: str, marks_path: str | None = None) -> list:
    if not source_dir or not os.path.exists(source_dir):
        return []

    marks_keys: set[str] = set()
    try:
        mp = marks_path or os.path.join(source_dir, "marks.json")
        if os.path.exists(mp):
            with open(mp, encoding="utf-8") as f:
                marks_keys = set(json.load(f).keys())
    except Exception:
        pass

    results: list = []
    try:
        fusion_results_dir = os.path.join(source_dir, "_FUSION_RESULTS")
        scan_root = fusion_results_dir if os.path.exists(fusion_results_dir) else source_dir

        parts = [
            d
            for d in os.listdir(scan_root)
            if os.path.isdir(os.path.join(scan_root, d)) and re.match(r"^[A-Z][0-9]{2}$", d)
        ]
        parts.sort()

        for p in parts:
            p_path = os.path.join(scan_root, p)
            data: dict = {"total_mf4": 0, "total_tracking": 0, "total_marks": 0, "total_analysis": 0, "children": []}
            _scan_recursive(p_path, marks_keys, data)

            total = data["total_mf4"]
            tracking_done = data["total_tracking"]

            color = "#d1242f"
            if total > 0:
                if tracking_done == total:
                    color = "#2da44e"
                elif tracking_done > 0:
                    color = IDIADA_ORANGE
            elif total == 0:
                color = "gray"

            results.append({
                "name": p,
                "type": "participant",
                "path": p_path,
                "children": data["children"],
                "tracking_stats": [tracking_done, total],
                "marks_stats": [data["total_marks"], total],
                "analysis_stats": [data["total_analysis"], total],
                "color": color,
            })
    except Exception:
        pass

    return results


def _scan_recursive(path: str, marks_keys: set[str], out: dict):
    try:
        entries = os.listdir(path)
        entries.sort(key=lambda s: [
            int(t) if t.isdigit() else t.lower() for t in re.split(r"([0-9]+)", s)
        ])

        dirs: list[str] = []
        files: list[str] = []
        for e in entries:
            full = os.path.join(path, e)
            (dirs if os.path.isdir(full) else files).append(e)

        for d in dirs:
            sub = {"total_mf4": 0, "total_tracking": 0, "total_marks": 0, "total_analysis": 0, "children": []}
            _scan_recursive(os.path.join(path, d), marks_keys, sub)
            if sub["total_mf4"] > 0:
                out["children"].append({
                    "name": d,
                    "type": "folder",
                    "children": sub["children"],
                    "path": os.path.join(path, d),
                    "tracking_stats": [sub["total_tracking"], sub["total_mf4"]],
                    "marks_stats": [sub["total_marks"], sub["total_mf4"]],
                    "analysis_stats": [sub["total_analysis"], sub["total_mf4"]],
                })
                out["total_mf4"] += sub["total_mf4"]
                out["total_tracking"] += sub["total_tracking"]
                out["total_marks"] += sub["total_marks"]
                out["total_analysis"] += sub["total_analysis"]

        mf4_files_raw = [f for f in files if f.lower().endswith(".mf4") and not f.startswith("._")]

        base_map: dict[str, dict] = {}
        for f in mf4_files_raw:
            is_tracking = f.lower().endswith("_tracking.mf4")
            base = f[:-13] if is_tracking else os.path.splitext(f)[0]
            if base not in base_map:
                base_map[base] = {"has_tracking": False, "file": None, "path": None, "tracking_path": None}
            if is_tracking:
                base_map[base]["has_tracking"] = True
                base_map[base]["tracking_path"] = os.path.join(path, f)
                if base_map[base]["file"] is None:
                    base_map[base]["file"] = f
                    base_map[base]["path"] = os.path.join(path, f)
            else:
                base_map[base]["file"] = f
                base_map[base]["path"] = os.path.join(path, f)

        mf4_bases = sorted(base_map.keys(), key=lambda s: [
            int(t) if t.isdigit() else t.lower() for t in re.split(r"([0-9]+)", s)
        ])

        for base in mf4_bases:
            info = base_map[base]
            f = info["file"]
            fpath = info["path"]
            has_tracking = info["has_tracking"]

            has_analysis = False
            reports_dir = os.path.join(path, "Reports")
            file_base = os.path.splitext(f)[0]
            if os.path.exists(os.path.join(reports_dir, f"{file_base}.png")):
                has_analysis = True
            elif file_base != base and os.path.exists(os.path.join(reports_dir, f"{base}.png")):
                has_analysis = True

            out["total_mf4"] += 1
            if has_tracking:
                out["total_tracking"] += 1
            if has_analysis:
                out["total_analysis"] += 1

            child: dict = {
                "name": f,
                "type": "file",
                "path": fpath,
                "has_tracking": has_tracking,
                "has_analysis": has_analysis,
                "has_marks": False,
                "has_report": has_analysis,
            }

            try:
                for p_path in [fpath, info.get("tracking_path")]:
                    if not p_path:
                        continue
                    p_n = os.path.normpath(p_path)
                    p_unix = p_n.replace("\\", "/")
                    parts_l = p_unix.split("/")
                    if len(parts_l) >= 3 and "/".join(parts_l[-3:]) in marks_keys:
                        child["has_marks"] = True
                        break
                    if os.path.basename(p_n) in marks_keys:
                        child["has_marks"] = True
                        break
                if child["has_marks"]:
                    out["total_marks"] += 1
            except Exception:
                pass

            out["children"].append(child)

    except Exception:
        pass


@router.post("/scan")
async def scan_analysis(req: ScanRequest):
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(None, _scan_analysis_dir, req.source_dir, req.marks_path)

    fusion_results_dir = os.path.join(req.source_dir, "_FUSION_RESULTS")
    scan_root = fusion_results_dir if os.path.exists(fusion_results_dir) else req.source_dir

    def _find_cameras():
        cams: set[int] = set()
        for root, dirs, files in os.walk(scan_root):
            for f in files:
                if f.lower().endswith(".avi"):
                    m = re.search(r'_cam(\d+)\.avi$', f, re.I)
                    if m:
                        cams.add(int(m.group(1)))
        return sorted(cams)

    available_cameras = await loop.run_in_executor(None, _find_cameras)
    return {"results": results, "available_cameras": available_cameras}


def _list_directory(path: str) -> dict:
    import platform

    if not path or not os.path.exists(path):
        shortcuts = []
        home = os.path.expanduser("~")
        common = [
            ("Desktop", os.path.join(home, "Desktop")),
            ("Downloads", os.path.join(home, "Downloads")),
            ("Documents", os.path.join(home, "Documents")),
        ]
        for name, p in common:
            if os.path.exists(p):
                shortcuts.append({"name": name, "is_dir": True, "is_shortcut": True, "full_path": p})

        if platform.system() == "Windows":
            import string
            drives = []
            for d in string.ascii_uppercase:
                drive = f"{d}:\\"
                if os.path.exists(drive):
                    drives.append({"name": drive, "is_dir": True, "is_drive": True})
            return {"path": "", "entries": shortcuts + drives}
        return {"path": "/", "entries": shortcuts + [{"name": "/", "is_dir": True, "is_drive": True}]}

    try:
        entries = []
        with os.scandir(path) as it:
            sorted_entries = sorted(it, key=lambda e: (not e.is_dir(), e.name.lower()))
            for entry in sorted_entries:
                if entry.is_dir():
                    entries.append({"name": entry.name, "is_dir": True})
        return {"path": path, "entries": entries}
    except PermissionError:
        return {"path": path, "entries": [], "error": "Permission denied"}
    except Exception as e:
        return {"path": path, "entries": [], "error": str(e)}


@router.post("/browse")
async def browse_directory(req: BrowseRequest):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _list_directory, req.path)
    return result


@router.post("/channels")
async def get_channels(req: SignalPreviewRequest):
    loop = asyncio.get_event_loop()

    def _load():
        try:
            from asammdf import MDF
            with MDF(req.file_path) as mdf:
                channels = []
                for ch in mdf.iter_channels():
                    samples_count = 0
                    try:
                        if ch.samples is not None:
                            samples_count = len(ch.samples) if hasattr(ch.samples, "__len__") else 1
                    except Exception:
                        pass
                    channels.append({
                        "name": ch.name,
                        "unit": str(ch.unit) if hasattr(ch, "unit") and ch.unit else "",
                        "samples": samples_count,
                    })
                return channels
        except Exception as e:
            return {"error": str(e)}

    result = await loop.run_in_executor(None, _load)
    if isinstance(result, dict) and "error" in result:
        return {"channels": [], "error": result["error"]}
    return {"channels": result}


@router.post("/signal")
async def get_signal_data(req: SignalDataRequest):
    loop = asyncio.get_event_loop()

    def _load():
        try:
            from asammdf import MDF
            import numpy as np
            with MDF(req.file_path) as mdf:
                if req.channel_name not in mdf:
                    for ch in mdf.iter_channels():
                        if ch.name == req.channel_name:
                            sig = ch
                            break
                    else:
                        return {"error": f"Channel '{req.channel_name}' not found"}
                else:
                    sig = mdf.get(req.channel_name)

                timestamps = np.asarray(sig.timestamps, dtype=float)
                samples = np.asarray(sig.samples, dtype=float)

                n = len(timestamps)
                if n > req.max_points:
                    step = n // req.max_points
                    timestamps = timestamps[::step]
                    samples = samples[::step]

                return {
                    "timestamps": timestamps.tolist(),
                    "values": samples.tolist(),
                    "unit": str(sig.unit) if hasattr(sig, "unit") and sig.unit else "",
                    "name": req.channel_name,
                    "total_points": n,
                }
        except Exception as e:
            return {"error": str(e)}

    result = await loop.run_in_executor(None, _load)
    return result


@router.post("/detect/audio")
async def detect_audio_peak(req: AudioDetectRequest):
    loop = asyncio.get_event_loop()

    def _run():
        freq, err = obtain_peak_frequency(
            req.file_path,
            start_time=req.start_time,
            end_time=req.end_time,
            min_freq=int(req.min_freq),
            max_freq=int(req.max_freq),
            signal_name=req.signal_name,
        )
        if err:
            return {"success": False, "error": err}
        return {"success": True, "peak_frequency": freq}

    result = await loop.run_in_executor(None, _run)
    return result


@router.post("/detect/events")
async def detect_events(req: SignalDataRequest):
    loop = asyncio.get_event_loop()

    def _run():
        try:
            from asammdf import MDF
            import numpy as np
            with MDF(req.file_path) as mdf:
                if req.channel_name not in mdf:
                    for ch in mdf.iter_channels():
                        if ch.name == req.channel_name:
                            sig = ch
                            break
                    else:
                        return {"error": f"Channel '{req.channel_name}' not found"}
                else:
                    sig = mdf.get(req.channel_name)

                samples = np.asarray(sig.samples, dtype=float)
                timestamps = np.asarray(sig.timestamps, dtype=float)

                rms = float(np.sqrt(np.mean(np.square(samples[samples > 0])))) if np.any(samples > 0) else 0
                threshold_val = float(np.mean(samples)) + 2 * float(np.std(samples))
                first_event = find_first_valid_event(samples, timestamps, threshold_val, operator=">")

                return {
                    "rms": rms,
                    "mean": float(np.mean(samples)),
                    "std": float(np.std(samples)),
                    "threshold": threshold_val,
                    "first_event_time": first_event,
                    "min": float(np.min(samples)),
                    "max": float(np.max(samples)),
                }
        except Exception as e:
            return {"error": str(e)}

    result = await loop.run_in_executor(None, _run)
    return result


@router.post("/detect/logic")
async def detect_logic(req: LogicRequest):
    loop = asyncio.get_event_loop()

    def _run():
        marks = {}
        if req.marks_path and os.path.exists(req.marks_path):
            try:
                with open(req.marks_path, encoding="utf-8") as f:
                    marks = json.load(f)
            except Exception:
                pass
        
        return calculate_ncap_metrics(
            req.file_path, 
            req.signal_map, 
            marks=marks, 
            thresholds=req.thresholds
        )

    result = await loop.run_in_executor(None, _run)
    return result


def _resolve_tracking_tasks(mf4_paths: list[str], camera_id: int, source_dir: str = "") -> list[dict]:
    tasks = []
    logger.info(f"Resolving tasks for {len(mf4_paths)} files with camera_id={camera_id}")
    
    for mf4_path in mf4_paths:
        if not mf4_path.lower().endswith(".mf4"):
            continue

        fname = os.path.basename(mf4_path)
        # Ensure we always look for the base logic even if a tracking file was selected
        fname_clean = fname.replace("_tracking.mf4", ".mf4")
        logic = ChronosManager.get_logic_for_file(fname_clean)

        if not logic:
            logger.warning(f"No logic found for {fname_clean}")
            continue

        base_name = os.path.splitext(fname_clean)[0]
        # Matching original app: video is expected in the same directory as the MF4
        video_name = f"{base_name}_cam{camera_id}.avi"
        mf4_dir = os.path.dirname(mf4_path)
        video_path = os.path.join(mf4_dir, video_name)

        if os.path.exists(video_path):
            logger.info(f"Task resolved: {video_name} -> {logic}")
            tasks.append({
                "file_path": video_path,
                "mf4_path": mf4_path,
                "logic": logic
            })
        else:
            logger.warning(f"Video not found: {video_path}")

    return tasks


@router.post("/run/chronos")
async def run_chronos(req: ChronosRequest):
    global _active_worker, _worker_thread

    if _active_worker is not None:
        return {"status": "already_running"}

    tasks = _resolve_tracking_tasks(req.mf4_paths, req.camera_id, req.source_dir)
    if not tasks:
        return {"status": "no_tasks"}

    loop = asyncio.get_event_loop()

    def on_log(msg):
        print(f"WS LOG: {msg}")
        asyncio.run_coroutine_threadsafe(
            manager_analysis.broadcast({"type": "log", "message": msg}), loop
        )

    def on_progress(val):
        asyncio.run_coroutine_threadsafe(
            manager_analysis.broadcast({"type": "progress", "value": val}), loop
        )

    def on_finished_task(fpath):
        asyncio.run_coroutine_threadsafe(
            manager_analysis.broadcast({"type": "task_done", "path": fpath}), loop
        )

    def on_all_finished():
        print("WS FINISHED")
        global _active_worker
        asyncio.run_coroutine_threadsafe(
            manager_analysis.broadcast({"type": "finished"}), loop
        )
        _active_worker = None

    def on_error(err):
        global _active_worker
        asyncio.run_coroutine_threadsafe(
            manager_analysis.broadcast({"type": "error", "message": err}), loop
        )
        _active_worker = None

    def on_stats(stats):
        asyncio.run_coroutine_threadsafe(
            manager_analysis.broadcast({"type": "stats", **stats}), loop
        )

    def on_new_frame(frame_b64):
        asyncio.run_coroutine_threadsafe(
            manager_analysis.broadcast({"type": "frame", "data": frame_b64}), loop
        )

    worker = ChronosWorker(
        task_queue=tasks,
        camera_id=req.camera_id,
        on_log=on_log,
        on_progress=on_progress,
        on_finished_task=on_finished_task,
        on_all_finished=on_all_finished,
        on_error=on_error,
        on_stats=on_stats,
        on_new_frame=on_new_frame,
    )

    _active_worker = worker

    def _run():
        worker.run()

    _worker_thread = Thread(target=_run, daemon=True)
    _worker_thread.start()

    return {"status": "started", "task_count": len(tasks)}


@router.post("/marks/save")
async def save_marks(req: MarksRequest):
    """Save marks for a specific MF4/tracking file."""
    try:
        # Determine marks path
        mf4_dir = os.path.dirname(req.file_path)
        base_name = os.path.splitext(os.path.basename(req.file_path))[0]
        # Remove _tracking if present to unify marks
        base_name_clean = base_name.replace("_tracking", "")
        marks_file = os.path.join(mf4_dir, f"{base_name_clean}_marks.json")
        
        with open(marks_file, "w", encoding="utf-8") as f:
            json.dump(req.marks, f, indent=4)
        
        return {"status": "success", "path": marks_file}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/marks/load")
async def load_marks(req: SignalPreviewRequest):
    """Load marks for a specific MF4/tracking file."""
    try:
        mf4_dir = os.path.dirname(req.file_path)
        base_name = os.path.splitext(os.path.basename(req.file_path))[0]
        base_name_clean = base_name.replace("_tracking", "")
        marks_file = os.path.join(mf4_dir, f"{base_name_clean}_marks.json")
        
        if os.path.exists(marks_file):
            with open(marks_file, "r", encoding="utf-8") as f:
                return {"status": "success", "marks": json.load(f)}
        
        # Try finding in parent dir or root marks.json
        return {"status": "success", "marks": []}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/stop/chronos")
async def stop_chronos():
    global _active_worker
    if _active_worker is not None:
        _active_worker.stop()
        return {"status": "stopping"}
    return {"status": "no_worker"}


@router.websocket("/ws")
async def ws_analysis(ws: WebSocket):
    print("WS CONNECTING...")
    await manager_analysis.connect(ws)
    print(f"WS CONNECTED. Active connections: {len(manager_analysis.active)}")
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager_analysis.disconnect(ws)
        print("WS DISCONNECTED")


@router.get("/media")
async def get_media(path: str):
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)
