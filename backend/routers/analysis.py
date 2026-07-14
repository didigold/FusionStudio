import asyncio
import json
import logging
import os
import os
import re
import uuid
from threading import Thread
from typing import Dict

from fastapi import APIRouter, WebSocket, HTTPException, WebSocketDisconnect, Request
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
    source_dir: str = ""
    marks_type: str = "OM"


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
    gamification_filter: str = "none"


class UpdateFilterRequest(BaseModel):
    gamification_filter: str


class SignalUniqueValuesRequest(BaseModel):
    file_path: str
    channel_name: str
    max_unique: int = 200


class BrowseRequest(BaseModel):
    path: str = ""
    show_files: bool = False
    file_extension: str | None = None



class MarksRequest(BaseModel):
    file_path: str
    source_dir: str = ""
    marks: list[float]
    marks_type: str = "OM"


_active_worker: ChronosWorker | None = None
_worker_thread: Thread | None = None


def _scan_analysis_dir(source_dir: str, marks_path: str | None = None) -> list:
    if not source_dir or not os.path.exists(source_dir):
        return []

    marks_keys: set[str] = set()
    try:
        if marks_path:
            if os.path.exists(marks_path):
                with open(marks_path, encoding="utf-8") as f:
                    marks_keys = {k.lower() for k in json.load(f).keys()}
        else:
            for default_name in ["GA_marks.json", "OM_marks.json", "marks.json"]:
                mp = os.path.join(source_dir, default_name)
                if os.path.exists(mp):
                    try:
                        with open(mp, encoding="utf-8") as f:
                            data = json.load(f)
                            if default_name == "OM_marks.json":
                                for k, v in data.items():
                                    if isinstance(v, list) and len(v) > 0 and v[0] != -1.0:
                                        marks_keys.add(k.lower())
                            else:
                                for k in data.keys():
                                    marks_keys.add(k.lower())
                    except Exception:
                        pass
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
                    if len(parts_l) >= 3 and "/".join(parts_l[-3:]).lower() in marks_keys:
                        child["has_marks"] = True
                        break
                    if os.path.basename(p_n).lower() in marks_keys:
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
        cams = set()
        for root, dirs, files in os.walk(scan_root):
            for f in files:
                if f.lower().endswith(".avi"):
                    m = re.search(r'_cam(\d+)\.avi$', f, re.I)
                    if m:
                        cams.add(int(m.group(1)))
                    else:
                        m_str = re.search(r'_(CAM_[A-Za-z0-9_-]+)\.avi$', f, re.I)
                        if m_str:
                            cams.add(m_str.group(1))
        ints = sorted([c for c in cams if isinstance(c, int)])
        strs = sorted([c for c in cams if isinstance(c, str)])
        return ints + strs

    available_cameras = await loop.run_in_executor(None, _find_cameras)
    return {"results": results, "available_cameras": available_cameras}


def _list_directory(path: str, show_files: bool = False, file_extension: str | None = None) -> dict:
    import platform

    if not path or not os.path.exists(path):
        shortcuts = []
        if platform.system() == "Windows":
            try:
                import win32com.client
                shell = win32com.client.Dispatch("Shell.Application")
                qa = shell.Namespace("shell:::{679f85cb-0220-4080-b29b-5540cc05aab6}")
                if qa:
                    seen = set()
                    for item in qa.Items():
                        if item.IsFolder:
                            p = item.Path
                            if p and os.path.exists(p) and os.path.isdir(p) and p.lower() not in seen:
                                is_pinned = False
                                try:
                                    is_pinned = item.ExtendedProperty("System.Home.IsPinned")
                                except Exception:
                                    pass
                                if is_pinned:
                                    seen.add(p.lower())
                                    shortcuts.append({"name": item.Name, "is_dir": True, "is_shortcut": True, "full_path": p})
            except Exception as e:
                logger.warning(f"Failed to fetch Quick Access folders: {e}")
            
            if not shortcuts:
                # Fallback to standard folders
                home = os.path.expanduser("~")
                common = [
                    ("Desktop", os.path.join(home, "Desktop")),
                    ("Downloads", os.path.join(home, "Downloads")),
                    ("Documents", os.path.join(home, "Documents")),
                ]
                for name, p in common:
                    if os.path.exists(p):
                        shortcuts.append({"name": name, "is_dir": True, "is_shortcut": True, "full_path": p})

            import string
            import ctypes
            drives = []
            kernel32 = ctypes.windll.kernel32
            for d in string.ascii_uppercase:
                drive = f"{d}:\\"
                if os.path.exists(drive):
                    drive_name = ""
                    try:
                        volume_name_buffer = ctypes.create_unicode_buffer(1024)
                        result = kernel32.GetVolumeInformationW(
                            ctypes.c_wchar_p(drive),
                            volume_name_buffer,
                            ctypes.sizeof(volume_name_buffer),
                            None, None, None, None, 0
                        )
                        if result and volume_name_buffer.value:
                            drive_name = f"{volume_name_buffer.value} ({d}:)"
                        else:
                            drive_name = drive
                    except Exception:
                        drive_name = drive

                    drives.append({"name": drive_name, "is_dir": True, "is_drive": True, "full_path": drive})
            return {"path": "", "entries": shortcuts + drives}
        else:
            home = os.path.expanduser("~")
            common = [
                ("Desktop", os.path.join(home, "Desktop")),
                ("Downloads", os.path.join(home, "Downloads")),
                ("Documents", os.path.join(home, "Documents")),
            ]
            for name, p in common:
                if os.path.exists(p):
                    shortcuts.append({"name": name, "is_dir": True, "is_shortcut": True, "full_path": p})
            return {"path": "/", "entries": shortcuts + [{"name": "/", "is_dir": True, "is_drive": True}]}

    try:
        entries = []
        with os.scandir(path) as it:
            sorted_entries = sorted(it, key=lambda e: (not e.is_dir(), e.name.lower()))
            for entry in sorted_entries:
                if entry.is_dir():
                    entries.append({"name": entry.name, "is_dir": True})
                elif show_files:
                    if not file_extension or entry.name.lower().endswith(file_extension.lower()):
                        entries.append({"name": entry.name, "is_dir": False})
        return {"path": path, "entries": entries}
    except PermissionError:
        return {"path": path, "entries": [], "error": "Permission denied"}
    except Exception as e:
        return {"path": path, "entries": [], "error": str(e)}


@router.post("/browse")
async def browse_directory(req: BrowseRequest):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _list_directory, req.path, req.show_files, req.file_extension)
    return result


@router.post("/channels")
async def get_channels(req: SignalPreviewRequest):
    loop = asyncio.get_event_loop()

    def _load():
        import os
        import json
        cache_path = req.file_path + ".analysis_channels.json"
        
        if os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass  # Fallback to parsing MF4 if cache read fails

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
                
                try:
                    with open(cache_path, "w", encoding="utf-8") as f:
                        json.dump(channels, f)
                except Exception:
                    pass
                    
                return channels
        except Exception as e:
            return {"error": str(e)}

    result = await loop.run_in_executor(None, _load)
    if isinstance(result, dict) and "error" in result:
        return {"channels": [], "error": result["error"]}
    return {"channels": result}


@router.post("/signal_unique_values")
async def get_signal_unique_values(req: SignalUniqueValuesRequest):
    loop = asyncio.get_event_loop()

    def _load():
        try:
            from asammdf import MDF
            import numpy as np
            with MDF(req.file_path) as mdf:
                sig = None
                # Check channels_db first (exact or case-insensitive)
                actual_name = None
                if req.channel_name in mdf.channels_db:
                    actual_name = req.channel_name
                else:
                    for k in mdf.channels_db.keys():
                        if k.lower() == req.channel_name.lower():
                            actual_name = k
                            break

                if actual_name is not None:
                    try:
                        gp, idx = mdf.channels_db[actual_name][0]
                        sig = mdf.get(actual_name, group=gp, index=idx)
                    except Exception:
                        pass

                if sig is None:
                    # Fallback to iter_channels fuzzy/casing match
                    for ch in mdf.iter_channels():
                        if ch.name.lower() == req.channel_name.lower():
                            sig = ch
                            break

                if sig is None:
                    return {"values": [], "error": f"Channel '{req.channel_name}' not found"}
                samples = sig.samples
                if samples is None:
                    return {"values": [], "continuous": False}
                
                if not isinstance(samples, np.ndarray):
                    samples = np.array(samples)
                
                if np.issubdtype(samples.dtype, np.bytes_) or np.issubdtype(samples.dtype, np.str_):
                    if np.issubdtype(samples.dtype, np.bytes_):
                        samples = np.char.decode(samples, 'utf-8', errors='ignore')
                    unique_vals = np.unique(samples)
                    unique_vals = [str(v).strip() for v in unique_vals if v is not None]
                    unique_vals = sorted(list(set(unique_vals)))
                    if len(unique_vals) > req.max_unique:
                        return {"values": [], "continuous": True}
                    return {"values": unique_vals, "continuous": False}
                
                try:
                    float_samples = np.asarray(samples, dtype=float)
                    unique_vals = np.unique(float_samples)
                    if len(unique_vals) > req.max_unique:
                        return {"values": [], "continuous": True}
                    rounded_vals = []
                    for v in unique_vals:
                        try:
                            if np.isnan(v):
                                continue
                            rounded_vals.append(round(float(v), 6))
                        except Exception:
                            pass
                    return {
                        "values": sorted(list(set(rounded_vals))),
                        "continuous": False
                    }
                except (ValueError, TypeError):
                    str_samples = []
                    for v in samples:
                        if isinstance(v, bytes):
                            str_samples.append(v.decode('utf-8', errors='ignore'))
                        else:
                            str_samples.append(str(v))
                    unique_vals = np.unique(str_samples)
                    unique_vals = [v.strip() for v in unique_vals if v is not None]
                    unique_vals = sorted(list(set(unique_vals)))
                    if len(unique_vals) > req.max_unique:
                        return {"values": [], "continuous": True}
                    return {"values": unique_vals, "continuous": False}
        except Exception as e:
            return {"values": [], "error": str(e)}

    result = await loop.run_in_executor(None, _load)
    return result


@router.post("/signal")
async def get_signal_data(req: SignalDataRequest):
    loop = asyncio.get_event_loop()

    def _load():
        try:
            from asammdf import MDF
            import numpy as np
            with MDF(req.file_path) as mdf:
                sig = None
                # Check channels_db first (exact or case-insensitive)
                actual_name = None
                if req.channel_name in mdf.channels_db:
                    actual_name = req.channel_name
                else:
                    for k in mdf.channels_db.keys():
                        if k.lower() == req.channel_name.lower():
                            actual_name = k
                            break

                if actual_name is not None:
                    try:
                        gp, idx = mdf.channels_db[actual_name][0]
                        sig = mdf.get(actual_name, group=gp, index=idx)
                    except Exception:
                        pass

                if sig is None:
                    # Fallback to iter_channels fuzzy/casing match
                    for ch in mdf.iter_channels():
                        if ch.name.lower() == req.channel_name.lower():
                            sig = ch
                            break

                if sig is None:
                    return {"error": f"Channel '{req.channel_name}' not found"}

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
                lookup_names = [req.channel_name]
                if req.channel_name == 'SoundPressure':
                    lookup_names = ['SoundPressure', 'MySound PressureTask.Sound Pressure']
                elif req.channel_name == 'MySound PressureTask.Sound Pressure':
                    lookup_names = ['MySound PressureTask.Sound Pressure', 'SoundPressure']

                sig = None
                for name in lookup_names:
                    for ch in mdf.iter_channels():
                        if ch.name == name:
                            sig = ch
                            break
                    if sig:
                        break
                if sig is None:
                    for name in lookup_names:
                        if name in mdf:
                            sig = mdf.get(name)
                            break
                if sig is None:
                    return {"error": f"Channel '{req.channel_name}' not found"}

                samples = np.asarray(sig.samples, dtype=float)
                timestamps = np.asarray(sig.timestamps, dtype=float)

                rms = float(np.sqrt(np.mean(np.square(samples[samples > 0])))) if np.any(samples > 0) else 0
                threshold_val = float(np.mean(samples)) + 2 * float(np.std(samples))
                first_event = find_first_valid_event(samples, timestamps, threshold_val, operator=">")[0]

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
        # Resolve the source MF4 path for the completed task so the frontend
        # can match it against node.path in the recordings tree.
        source_mf4 = fpath  # fallback: use what was given
        for t in tasks:
            if t.get("file_path") == fpath:
                source_mf4 = t.get("mf4_path", fpath)
                break
        asyncio.run_coroutine_threadsafe(
            manager_analysis.broadcast({"type": "task_done", "path": source_mf4}), loop
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
        gamification_filter=req.gamification_filter,
    )

    _active_worker = worker

    def _run():
        worker.run()

    _worker_thread = Thread(target=_run, daemon=True)
    _worker_thread.start()

    return {"status": "started", "task_count": len(tasks)}


@router.post("/run/chronos/filter")
async def run_chronos_filter(req: UpdateFilterRequest):
    global _active_worker
    if _active_worker is not None:
        _active_worker.update_filter(req.gamification_filter)
        return {"status": "updated", "filter": req.gamification_filter}
    return {"status": "no_active_worker"}


@router.get("/assets/gamification/{filename}")
async def get_gamification_asset(filename: str):
    from backend.core.utils import resource_path
    img_path = resource_path(f"assets/gamification/{filename}")
    if os.path.exists(img_path):
        return FileResponse(img_path)
    raise HTTPException(status_code=404, detail="Gamification asset not found")


def _get_marks_key(file_path: str) -> str:
    """Compute marks key: last 3 path segments, stripping _tracking, normalizing extension."""
    p = os.path.normpath(file_path).replace("_tracking.mf4", ".mf4").replace("_tracking.MF4", ".mf4")
    if p.lower().endswith(".mf4"):
        p = p[:-4] + ".mf4"
    parts = p.split(os.sep)
    if len(parts) < 3:
        return os.path.basename(p)
    return "/".join(parts[-3:])


def _load_marks_dict(source_dir: str, marks_type: str = "OM") -> dict:
    """Read specific marks dict from source_dir, falls back to legacy marks.json."""
    if not source_dir:
        return {}
    filename = "GA_marks.json" if marks_type == "GA" else "OM_marks.json"
    mp = os.path.join(source_dir, filename)
    if not os.path.exists(mp):
        # Fallback to legacy marks.json
        legacy_mp = os.path.join(source_dir, "marks.json")
        if not os.path.exists(legacy_mp):
            return {}
        mp = legacy_mp
    try:
        with open(mp, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_marks_dict(source_dir: str, marks: dict, marks_type: str = "OM"):
    """Write marks dict to specific file in source_dir."""
    filename = "GA_marks.json" if marks_type == "GA" else "OM_marks.json"
    mp = os.path.join(source_dir, filename)
    with open(mp, "w", encoding="utf-8") as f:
        json.dump(marks, f, indent=2)


@router.post("/marks/save")
async def save_marks(req: MarksRequest):
    """Save marks to specific json file based on marks_type."""
    try:
        marks_dict = _load_marks_dict(req.source_dir, req.marks_type)
        key = _get_marks_key(req.file_path)
        if req.marks:
            marks_dict[key] = req.marks
        elif key in marks_dict:
            del marks_dict[key]
        await asyncio.to_thread(_save_marks_dict, req.source_dir, marks_dict, req.marks_type)
        filename = "GA_marks.json" if req.marks_type == "GA" else "OM_marks.json"
        return {"status": "success", "path": os.path.join(req.source_dir, filename)}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/marks/load")
async def load_marks(req: SignalPreviewRequest):
    """Load marks from specific json file based on marks_type."""
    try:
        marks_dict = _load_marks_dict(req.source_dir, req.marks_type)
        key = _get_marks_key(req.file_path)
        # Try both _tracking and non-tracking variants
        entry = marks_dict.get(key) or marks_dict.get(key.replace(".mf4", "_tracking.mf4")) or []
        if not isinstance(entry, list):
            entry = []
        return {"status": "success", "marks": entry}
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


# Global dictionary to track ongoing transcode tasks to prevent concurrent generation
transcoding_tasks: Dict[str, asyncio.Event] = {}


def _run_ffmpeg_sync(cmd: list, creationflags: int) -> int:
    import subprocess
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            creationflags=creationflags
        )
        _, stderr = process.communicate()
        if process.returncode != 0 and stderr:
            logger.error(f"FFmpeg stderr: {stderr.decode('utf-8', 'replace')[-1000:]}")
        return process.returncode
    except Exception as e:
        logger.error(f"FFmpeg process exception: {e}")
        return -1


@router.get("/media")
@router.head("/media")
async def get_media(path: str, request: Request):
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    
    if path.lower().endswith(".avi"):
        dir_name = os.path.dirname(path)
        base_name = os.path.basename(path)
        cache_dir = os.path.join(dir_name, "_video_cache")
        os.makedirs(cache_dir, exist_ok=True)
        mp4_path = os.path.join(cache_dir, os.path.splitext(base_name)[0] + ".mp4")
        
        # Clean up corrupted/empty cache files from previous interrupted runs
        if os.path.exists(mp4_path) and os.path.getsize(mp4_path) < 1024:
            try:
                os.remove(mp4_path)
            except Exception:
                pass

        # If another request is currently transcoding this file, wait for it
        if mp4_path in transcoding_tasks:
            logger.info(f"Waiting for ongoing transcode to finish: {mp4_path}")
            await transcoding_tasks[mp4_path].wait()
            if not os.path.exists(mp4_path):
                # If it still doesn't exist after waiting, the transcode failed.
                return FileResponse(path)
            return FileResponse(mp4_path)

        if not os.path.exists(mp4_path):
            transcode_event = asyncio.Event()
            transcoding_tasks[mp4_path] = transcode_event
            # Use a short temp filename to avoid exceeding Windows MAX_PATH (260)
            tmp_path = os.path.join(cache_dir, f"_tmp_{uuid.uuid4().hex[:8]}.mp4")
            
            try:
                logger.info(f"Transcoding AVI to MP4 for browser playback: {path} -> {mp4_path}")
                
                # Configure subprocess to run quietly and without window on Windows
                creationflags = 0
                if os.name == 'nt':
                    creationflags = 0x08000000  # CREATE_NO_WINDOW
                
                # Resolve ffmpeg executable location using imageio-ffmpeg if available
                ffmpeg_exe = "ffmpeg"
                try:
                    import imageio_ffmpeg
                    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
                except ImportError:
                    pass
                
                cmd = [
                    ffmpeg_exe, "-y", "-i", path,
                    "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-preset", "veryfast", "-g", "1",
                    "-c:a", "aac", "-movflags", "faststart",
                    tmp_path
                ]
                
                loop = asyncio.get_running_loop()
                returncode = await loop.run_in_executor(
                    None,
                    _run_ffmpeg_sync,
                    cmd,
                    creationflags
                )
                
                if returncode == 0:
                    if os.path.exists(tmp_path):
                        os.replace(tmp_path, mp4_path)
                    logger.info(f"Successfully transcoded: {mp4_path}")
                else:
                    raise Exception(f"FFmpeg exited with code {returncode}")
                    
            except Exception as e:
                logger.error(f"Failed to transcode {path} to browser-compatible format: {e}")
                if os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except Exception:
                        pass
                # Fallback to original AVI file
                return FileResponse(path)
            finally:
                # Always signal that this file is done (success or fail)
                transcode_event.set()
                if mp4_path in transcoding_tasks:
                    del transcoding_tasks[mp4_path]
        
        return FileResponse(mp4_path)
        
    return FileResponse(path)
