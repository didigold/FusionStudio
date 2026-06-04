import asyncio
import json
import logging
import os
from datetime import datetime
from threading import Thread

from fastapi import APIRouter, WebSocket
from pydantic import BaseModel

from backend.core.utils import resource_path
from backend.ws.manager import manager_reporting

logger = logging.getLogger("fusionstudio.reporting")

router = APIRouter()

TEMPLATE_OPTIONS: dict[str, list[tuple[str, str, bool]]] = {
    "Driver_Engagement.xlsx": [
        ("Distractions", "Distractions", True),
        ("Fatigue", "Fatigue", True),
        ("Occlusions", "Occlusions", True),
        ("Noise Variables", "Noise Variables", False),
    ],
}

_active_worker = None
_worker_thread: Thread | None = None


class RunRequest(BaseModel):
    template_name: str
    root_folder: str
    output_folder: str
    output_filename: str = "Report_Results.xlsx"
    selected_folders: list[str] = []


class PreviewRequest(BaseModel):
    file_path: str
    sheet_name: str = "DISTRACTION"


def _list_templates() -> list[dict]:
    templates_dir = resource_path("assets/templates")
    if not os.path.exists(templates_dir):
        return []
    results = []
    for file in sorted(os.listdir(templates_dir)):
        if file.endswith(".xlsx"):
            full_path = os.path.join(templates_dir, file)
            options = TEMPLATE_OPTIONS.get(file, [])
            results.append({
                "name": file,
                "path": full_path,
                "options": [{"label": o[0], "folder": o[1], "default": o[2]} for o in options],
            })
    return results


def _preview_excel(file_path: str, sheet_name: str) -> dict:
    try:
        import pandas as pd
        try:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
        except Exception:
            df = pd.read_excel(file_path, sheet_name=0, nrows=500)

        # Convert to dict, limit rows
        df = df.head(200).fillna("")
        return {
            "columns": df.columns.astype(str).tolist(),
            "rows": df.values.tolist(),
            "row_count": len(df),
            "sheet": sheet_name,
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/templates")
async def list_templates():
    templates = _list_templates()
    return {"templates": templates}


@router.get("/gauge_rules")
async def gauge_rules():
    rules_path = resource_path("config/gauge_rules.json")
    if os.path.exists(rules_path):
        with open(rules_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


@router.post("/preview")
async def preview_report(req: PreviewRequest):
    loop = asyncio.get_event_loop()
    if not os.path.exists(req.file_path):
        return {"error": "File not found"}
    result = await loop.run_in_executor(None, _preview_excel, req.file_path, req.sheet_name)
    return result


@router.post("/run")
async def run_report(req: RunRequest):
    global _active_worker, _worker_thread

    if _active_worker is not None:
        return {"status": "already_running"}

    if not req.output_filename.endswith(".xlsx"):
        req.output_filename += ".xlsx"

    output_path = os.path.join(req.output_folder, req.output_filename)

    # Find template path
    templates_dir = resource_path("assets/templates")
    template_path = os.path.join(templates_dir, req.template_name)
    if not os.path.exists(template_path):
        return {"status": "error", "message": f"Template not found: {req.template_name}"}

    if not os.path.exists(req.root_folder):
        return {"status": "error", "message": "Root folder not found"}

    loop = asyncio.get_event_loop()

    def on_progress(msg):
        asyncio.run_coroutine_threadsafe(
            manager_reporting.broadcast({"type": "progress", "message": msg}), loop
        )

    class _ReportingWorker:
        def __init__(self):
            self.is_running = True

        def stop(self):
            self.is_running = False

        def run(self):
            from backend.core.dsm_processor import DSMProcessor
            try:
                processor = DSMProcessor(callback=on_progress)
                processor.process_dsm_data(
                    template_path, output_path, req.root_folder,
                    req.selected_folders
                )
                loop.call_soon_threadsafe(
                    lambda: asyncio.run_coroutine_threadsafe(
                        manager_reporting.broadcast({
                            "type": "finished",
                            "output_path": output_path,
                        }), loop
                    )
                )
            except Exception as e:
                loop.call_soon_threadsafe(
                    lambda: asyncio.run_coroutine_threadsafe(
                        manager_reporting.broadcast({
                            "type": "error",
                            "message": str(e),
                        }), loop
                    )
                )

    worker = _ReportingWorker()
    _active_worker = worker

    def _run():
        worker.run()

    _worker_thread = Thread(target=_run, daemon=True)
    _worker_thread.start()

    return {"status": "started"}


@router.post("/stop")
async def stop_report():
    global _active_worker
    if _active_worker is not None:
        _active_worker.stop()
        return {"status": "stopping"}
    return {"status": "no_worker"}


@router.websocket("/ws")
async def ws_reporting(ws: WebSocket):
    await manager_reporting.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except Exception:
        await manager_reporting.disconnect(ws)


# --- Gaze Logic Tab Controls & Report Preview Endpoints ---

class GazePreviewRequest(BaseModel):
    file_path: str
    protocol: str = "Euro NCAP"
    metadata: dict = {}
    category_configs: dict = {}
    gauge_rules: dict = {}
    micro: dict = {}
    source_dir: str = ""


class GazeGenerateRequest(BaseModel):
    files: list[str]
    protocol: str = "Euro NCAP"
    metadata: dict = {}
    category_configs: dict = {}
    gauge_rules: dict = {}
    micro: dict = {}
    source_dir: str = ""


def _resolve_gsr_image_path(filename: str) -> str | None:
    import re
    match = re.search(r'(ADDW\d+)', filename, re.IGNORECASE)
    if match:
        case_key = match.group(1).upper()
        try:
            num = int(case_key.replace("ADDW", ""))
            image_name = f"{num}.png"
            # Check local first (user custom)
            local_path = resource_path(os.path.join("assets/gsr/local", image_name))
            if os.path.exists(local_path):
                return local_path
            # Check core
            core_path = resource_path(os.path.join("assets/gsr", image_name))
            if os.path.exists(core_path):
                return core_path
        except:
            pass
    return None


def build_report_config(file_path: str, protocol: str, metadata: dict, category_configs: dict, gauge_rules: dict, driver_marks: list, micro: dict = None) -> dict:
    import re
    import numpy as np
    from asammdf import MDF
    from backend.core.audio_analysis import find_first_valid_event

    basename = os.path.splitext(os.path.basename(file_path))[0]
    target_category = None
    if "ADDW" in basename.upper():
        path_lower = file_path.replace('\\', '/').lower()
        if "high speed" in path_lower:
            target_category = "High Speed"
        elif "low speed" in path_lower:
            target_category = "Low Speed"
        else:
            target_category = "High Speed"
    else:
        match_d = re.match(r'^D(\d+)', basename)
        if match_d:
            num = int(match_d.group(1))
            if 1 <= num <= 9:
                target_category = "Long Distraction (NDT)"
            elif 10 <= num <= 15:
                target_category = "Long Distraction (DT)"
            elif (16 <= num <= 19) or num == 28 or (29 <= num <= 42):
                target_category = "Short Distraction (NDT)"
            elif 20 <= num <= 27:
                target_category = "Short Distraction (DT)"
        else:
            match_f = re.match(r'^F(\d+)', basename)
            if match_f:
                num = int(match_f.group(1))
                if num == 1:
                    target_category = "Microsleep"
                elif num == 2:
                    target_category = "Sleep"
                elif num == 3:
                    target_category = "Drowsiness"
                elif num == 4:
                    target_category = "Unresponsive driver (SLE)"
                elif num == 5:
                    target_category = "Unresponsive driver (DTR)"

    if not target_category:
        target_category = "Long Distraction (NDT)"

    cat_conf = category_configs.get(target_category, {})
    signals_conf = cat_conf.get('signals', {})
    pass_signal_name = cat_conf.get('pass_signal_name')
    mask_start = float(cat_conf.get('mask_start', 6.0))
    conditions = []
    
    op1 = cat_conf.get('operator1')
    val1 = cat_conf.get('value1')
    if op1 and op1 != "None":
        try:
            conditions.append((op1, float(val1)))
        except:
            pass
            
    op2 = cat_conf.get('operator2')
    val2 = cat_conf.get('value2')
    if op2 and op2 != "None":
        try:
            conditions.append((op2, float(val2)))
        except:
            pass

    target_signals_conf = dict(signals_conf)
    unresponsive_phases = cat_conf.get('unresponsive_phases', [])
    for phase in unresponsive_phases:
        sig_name = phase.get('signal')
        if sig_name and sig_name not in target_signals_conf:
            is_audio = sig_name.lower().find("sound") >= 0 or sig_name.lower().find("audio") >= 0 or sig_name.lower().find("buzzer") >= 0
            target_signals_conf[sig_name] = {
                'checked': True,
                'operator': phase.get('operator', '==') if not is_audio else '>=',
                'threshold': phase.get('threshold') if is_audio else phase.get('value', 0.0),
                'alias': sig_name
            }

    signals = {}
    with MDF(file_path) as mdf:
        for sig_name, sig_info in target_signals_conf.items():
            if not sig_info.get('checked', True):
                continue
            mdf_sig = None
            if sig_name in mdf:
                mdf_sig = mdf.get(sig_name)
            else:
                for ch in mdf.iter_channels():
                    if ch.name.lower() == sig_name.lower():
                        mdf_sig = ch
                        break
                if mdf_sig is None:
                    norm_sig = re.sub(r'_[cde]3v_', '_', sig_name.lower())
                    for ch in mdf.iter_channels():
                        norm_ch = re.sub(r'_[cde]3v_', '_', ch.name.lower())
                        if norm_ch == norm_sig:
                            mdf_sig = ch
                            logger.info(f"Fuzzy matched config signal '{sig_name}' to MDF channel '{ch.name}'")
                            break
                if mdf_sig is None:
                    for ch in mdf.iter_channels():
                        if sig_name.lower() in ch.name.lower() or ch.name.lower() in sig_name.lower():
                            mdf_sig = ch
                            logger.info(f"Substring fuzzy matched config signal '{sig_name}' to MDF channel '{ch.name}'")
                            break
            if mdf_sig is None:
                continue

            # Safe conversion of samples to list of float or list of string
            raw_samples = mdf_sig.samples
            processed_samples = []
            if raw_samples is not None:
                if not isinstance(raw_samples, np.ndarray):
                    raw_samples = np.array(raw_samples)
                if np.issubdtype(raw_samples.dtype, np.number) or np.issubdtype(raw_samples.dtype, np.bool_):
                    processed_samples = list(np.asarray(raw_samples, dtype=float))
                else:
                    for v in raw_samples:
                        if isinstance(v, bytes):
                            processed_samples.append(v.decode('utf-8', errors='ignore'))
                        elif v is None:
                            processed_samples.append("")
                        else:
                            processed_samples.append(str(v))
            
            thresh_val = sig_info.get('threshold', 0.0)
            try:
                if isinstance(thresh_val, (int, float)):
                    thresh_val = float(thresh_val)
                else:
                    thresh_val = float(thresh_val)
            except (ValueError, TypeError):
                thresh_val = str(thresh_val)

            signals[sig_name] = {
                'timestamps': list(np.asarray(mdf_sig.timestamps, dtype=float)),
                'samples': processed_samples,
                'operator': sig_info.get('operator', '>='),
                'threshold': micro.get('threshold') if (sig_name == "SoundPressure" and micro and micro.get('threshold') is not None) else thresh_val,
                'unit': getattr(mdf_sig, 'unit', 'Value'),
                'category': target_category,
                'alias': sig_info.get('alias') or sig_name
            }

    tgaze = mask_start
    if driver_marks and len(driver_marks) > 0:
        try:
            tgaze = float(driver_marks[0])
        except:
            pass

    signal_times = {}
    for sig_name, sig_info in signals.items():
        timestamps = sig_info['timestamps']
        samples = sig_info['samples']
        operator = sig_info['operator']
        threshold = sig_info['threshold']
        first_match_time = None

        eval_start = mask_start
        if "Unresponsive" in target_category:
            eval_start = tgaze

        if sig_name == "SoundPressure":
            try:
                audio_thresh = micro.get('threshold') if (micro and micro.get('threshold') is not None) else threshold
                if len(samples) > 0 and len(timestamps) > 0:
                    samples_numeric = samples
                    try:
                        min_f = micro.get('min_freq') if (micro and micro.get('min_freq') is not None) else 230
                        max_f = micro.get('max_freq') if (micro and micro.get('max_freq') is not None) else 2000
                        samples_np = np.array(samples, dtype=float)
                        dur = timestamps[-1] - timestamps[0]
                        fs = len(samples) / dur if dur > 0 else 44100
                        nyq = 0.5 * fs
                        
                        low = max(1e-6, float(min_f) / nyq)
                        high = min(1.0 - 1e-6, float(max_f) / nyq)
                        if low >= high:
                            high = low + 0.1
                            if high >= 1.0:
                                low = 0.1
                                high = 0.9
                        
                        from scipy.signal import butter, filtfilt
                        b, a = butter(4, [low, high], btype='band')
                        samples_numeric = list(filtfilt(b, a, samples_np))
                    except Exception as fe:
                        logger.error(f"Error filtering SoundPressure: {fe}")
                    
                    op = operator if operator and operator != 'None' else '>='
                    first_match_time = find_first_valid_event(
                        np.array(samples_numeric),
                        np.array(timestamps),
                        float(audio_thresh) if audio_thresh is not None else 0.0,
                        op,
                        mask_start=eval_start
                    )
            except Exception as e:
                logger.error(f"Error calculating SoundPressure: {e}")
        elif threshold is not None and operator and operator != 'None':
            try:
                threshold_num = float(threshold)
                for t, val in zip(timestamps, samples):
                    if t < eval_start:
                        continue
                    val_num = float(val)
                    match = False
                    if operator == '>': match = val_num > threshold_num
                    elif operator == '<': match = val_num < threshold_num
                    elif operator == '>=': match = val_num >= threshold_num
                    elif operator == '<=': match = val_num <= threshold_num
                    elif operator == '==': match = abs(val_num - threshold_num) < 1e-6
                    elif operator == '!=': match = abs(val_num - threshold_num) >= 1e-6
                    if match:
                        first_match_time = t
                        break
            except (ValueError, TypeError):
                threshold_str = str(threshold)
                for t, val in zip(timestamps, samples):
                    if t < eval_start:
                        continue
                    val_str = str(val)
                    match = False
                    if operator == '==': match = val_str == threshold_str
                    elif operator == '!=': match = val_str != threshold_str
                    elif operator == '>': match = val_str > threshold_str
                    elif operator == '<': match = val_str < threshold_str
                    elif operator == '>=': match = val_str >= threshold_str
                    elif operator == '<=': match = val_str <= threshold_str
                    if match:
                        first_match_time = t
                        break
        signal_times[sig_name] = first_match_time

    if "Unresponsive" in target_category:
        for idx, phase in enumerate(unresponsive_phases):
            sig_name = phase.get('signal')
            if not sig_name or sig_name not in signals:
                signal_times[f"phase_{idx}"] = None
                continue
            
            sig_info = signals[sig_name]
            timestamps = sig_info['timestamps']
            samples = sig_info['samples']
            
            is_audio = sig_name.lower().find("sound") >= 0 or sig_name.lower().find("audio") >= 0 or sig_name.lower().find("buzzer") >= 0
            if is_audio:
                operator = ">="
                threshold = phase.get('threshold') if phase.get('threshold') is not None else 0.5
            else:
                operator = phase.get('operator', '==')
                threshold = phase.get('value', 0)
                
            first_match_time = None
            
            # Determine evaluation start time (eval_start)
            mask_val = phase.get('mask')
            is_custom_mask = False
            custom_mask_time = None
            if mask_val is not None and str(mask_val).strip().lower() != 'previous' and str(mask_val).strip() != '':
                try:
                    custom_mask_time = float(mask_val)
                    is_custom_mask = True
                except ValueError:
                    pass
            
            if is_custom_mask:
                eval_start = custom_mask_time
            else:
                # Default: from previous phase
                if idx == 0:
                    eval_start = tgaze
                else:
                    # Find last enabled phase before idx
                    prev_t = None
                    found_active_prev = False
                    for p_idx in range(idx - 1, -1, -1):
                        p_prev = unresponsive_phases[p_idx]
                        if p_prev.get('enabled', True):
                            found_active_prev = True
                            prev_t = signal_times.get(f"phase_{p_idx}")
                            break
                    if found_active_prev:
                        if prev_t is not None:
                            eval_start = prev_t
                        else:
                            # Previous active phase didn't trigger, so this one can't trigger
                            eval_start = None
                    else:
                        eval_start = tgaze

            if eval_start is None:
                signal_times[f"phase_{idx}"] = None
                continue
            
            if sig_name == "SoundPressure":
                try:
                    audio_thresh = threshold
                    if len(samples) > 0 and len(timestamps) > 0:
                        samples_numeric = samples
                        try:
                            min_f = phase.get('min_freq') or 230
                            max_f = phase.get('max_freq') or phase.get('frequency') or 2000
                            samples_np = np.array(samples, dtype=float)
                            dur = timestamps[-1] - timestamps[0]
                            fs = len(samples) / dur if dur > 0 else 44100
                            nyq = 0.5 * fs
                            
                            low = max(1e-6, float(min_f) / nyq)
                            high = min(1.0 - 1e-6, float(max_f) / nyq)
                            if low >= high:
                                high = low + 0.1
                                if high >= 1.0:
                                    low = 0.1
                                    high = 0.9
                            
                            from scipy.signal import butter, filtfilt
                            b, a = butter(4, [low, high], btype='band')
                            samples_numeric = list(filtfilt(b, a, samples_np))
                        except Exception as fe:
                            logger.error(f"Error filtering SoundPressure for phase {idx}: {fe}")
                        
                        op = operator if operator and operator != 'None' else '>='
                        first_match_time = find_first_valid_event(
                            np.array(samples_numeric),
                            np.array(timestamps),
                            float(audio_thresh) if audio_thresh is not None else 0.0,
                            op,
                            mask_start=eval_start
                        )
                except Exception as e:
                    logger.error(f"Error calculating SoundPressure for phase {idx}: {e}")
            elif threshold is not None and operator and operator != 'None':
                try:
                    threshold_num = float(threshold)
                    for t, val in zip(timestamps, samples):
                        if t < eval_start:
                            continue
                        val_num = float(val)
                        match = False
                        if operator == '>': match = val_num > threshold_num
                        elif operator == '<': match = val_num < threshold_num
                        elif operator == '>=': match = val_num >= threshold_num
                        elif operator == '<=': match = val_num <= threshold_num
                        elif operator == '==': match = abs(val_num - threshold_num) < 1e-6
                        elif operator == '!=': match = abs(val_num - threshold_num) >= 1e-6
                        if match:
                            first_match_time = t
                            break
                except (ValueError, TypeError):
                    threshold_str = str(threshold)
                    for t, val in zip(timestamps, samples):
                        if t < eval_start:
                            continue
                        val_str = str(val)
                        match = False
                        if operator == '==': match = val_str == threshold_str
                        elif operator == '!=': match = val_str != threshold_str
                        elif operator == '>': match = val_str > threshold_str
                        elif operator == '<': match = val_str < threshold_str
                        elif operator == '>=': match = val_str >= threshold_str
                        elif operator == '<=': match = val_str <= threshold_str
                        if match:
                            first_match_time = t
                            break
                            
            signal_times[f"phase_{idx}"] = first_match_time

    t_event = "No warn"
    t_event_color = "red"
    
    if "Unresponsive" in target_category:
        # 1. Compute t_event
        active_phases_with_trigger = []
        for idx, phase in enumerate(unresponsive_phases):
            enabled = phase.get('enabled', True)
            if enabled:
                t_trig = signal_times.get(f"phase_{idx}")
                if t_trig is not None:
                    active_phases_with_trigger.append((idx, phase, t_trig))
                    
        if len(active_phases_with_trigger) > 0:
            last_idx, last_phase, last_trig_time = active_phases_with_trigger[-1]
            t_event = last_trig_time - tgaze
            
            # 2. Compute t_event_color (PASS/FAIL validation based on active milestones)
            is_unresponsive_pass = True
            is_dtr = "DTR" in target_category
            num_milestones = len(unresponsive_phases) + 1
            
            for i in range(num_milestones - 1):
                step_enabled = unresponsive_phases[i].get('enabled', True)
                if not step_enabled:
                    continue
                
                t_next = signal_times.get(f"phase_{i}")
                if i == 0:
                    t_curr = tgaze
                else:
                    t_curr = signal_times.get(f"phase_{i-1}") if unresponsive_phases[i-1].get('enabled', True) else None
                
                delta = None
                if t_curr is not None and t_next is not None:
                    delta = t_next - t_curr
                
                ok = False
                if is_dtr:
                    if i == 0:
                        ok = delta is not None and 3.0 <= delta <= 4.0
                    elif i == 1:
                        ok = delta is not None and delta <= 4.0
                    elif i == 2:
                        if num_milestones == 4:
                            ok = delta is not None and delta <= 5.0
                        else:
                            ok = delta is not None and delta < 1.0
                    elif i == 3:
                        ok = delta is not None and delta <= 5.0
                else:
                    if i == 0:
                        ok = delta is not None and delta <= 7.0
                    elif i == 1:
                        ok = delta is not None and delta <= 5.0
                
                if not ok:
                    is_unresponsive_pass = False
            
            # Evaluate compound brackets
            if is_dtr:
                if len(unresponsive_phases) >= 2 and unresponsive_phases[1].get('enabled', True):
                    t0 = tgaze
                    t2 = signal_times.get("phase_1")
                    ok_m02 = False
                    if t0 is not None and t2 is not None:
                        ok_m02 = 7.0 <= (t2 - t0) <= 8.0
                    if not ok_m02:
                        is_unresponsive_pass = False
                
                target_idx = 2 if len(unresponsive_phases) == 3 else 3
                if len(unresponsive_phases) > target_idx and unresponsive_phases[target_idx].get('enabled', True):
                    t0 = tgaze
                    t_end = signal_times.get(f"phase_{target_idx}")
                    ok_end = False
                    if t0 is not None and t_end is not None:
                        if len(unresponsive_phases) == 3:
                            ok_end = (t_end - t0) <= 13.0
                        else:
                            ok_end = 13.0 <= (t_end - t0) <= 14.0
                    if not ok_end:
                        is_unresponsive_pass = False
            else:
                # SLE: compound M0->M_last must be <= 12s
                target_idx = len(unresponsive_phases) - 1
                if len(unresponsive_phases) > target_idx and target_idx >= 0 and unresponsive_phases[target_idx].get('enabled', True):
                    t0 = tgaze
                    t_end = signal_times.get(f"phase_{target_idx}")
                    ok_sle_total = False
                    if t0 is not None and t_end is not None:
                        ok_sle_total = (t_end - t0) <= 12.0
                    if not ok_sle_total:
                        is_unresponsive_pass = False
            
            t_event_color = "green" if is_unresponsive_pass else "red"
        else:
            t_event = "No warn"
            t_event_color = "red"
    else:
        # Standard scenario calculation
        warn_time = signal_times.get(pass_signal_name) if pass_signal_name else None
        if warn_time is not None:
            is_scenario2 = any(kw in target_category for kw in ["Short Distraction", "Phone Use"])
            if is_scenario2 and driver_marks and len(driver_marks) >= 2:
                marks_sorted = sorted([float(m) for m in driver_marks])
                accumulated = 0.0
                for i in range(0, len(marks_sorted) - 1, 2):
                    start = marks_sorted[i]
                    end = marks_sorted[i+1]
                    if warn_time < start:
                        break
                    elif warn_time <= end:
                        accumulated += (warn_time - start)
                        break
                    else:
                        accumulated += (end - start)
                t_event = accumulated
            else:
                t_event = warn_time - tgaze

            if conditions:
                all_met = True
                for op, limit in conditions:
                    if op == '>': match = t_event > limit
                    elif op == '<': match = t_event < limit
                    elif op == '>=': match = t_event >= limit
                    elif op == '<=': match = t_event <= limit
                    elif op == '==': match = abs(t_event - limit) < 1e-6
                    elif op == '!=': match = abs(t_event - limit) >= 1e-6
                    else: match = True
                    if not match:
                        all_met = False
                        break
                t_event_color = "green" if all_met else "red"
            else:
                t_event_color = "green" if t_event < 3.0 else "red"

    relative_path = os.path.basename(file_path)
    try:
        abs_path = os.path.abspath(file_path)
        parts = abs_path.split(os.sep)
        for i, part in enumerate(parts):
            if re.match(r'^[PE]\d+', part, re.IGNORECASE):
                relative_path = os.sep.join(parts[i:])
                break
    except:
        pass

    camera_image_path = None
    if protocol == "GSR ADDW" or protocol == "2023/2590":
        camera_image_path = _resolve_gsr_image_path(os.path.basename(file_path))

    # Normalize gauge_rules to ensure green_range and ticks exist
    normalized_gauge_rules = {}
    for cat_key, rule in gauge_rules.items():
        r = dict(rule) if isinstance(rule, dict) else {}
        if 'green_range' not in r:
            r['green_range'] = [r.get('green_min', 0), r.get('green_max', 3)]
        if 'ticks' not in r:
            min_v = r.get('min', 0)
            max_v = r.get('max', 10)
            num_ticks = r.get('num_ticks', None)
            if num_ticks and int(num_ticks) > 1:
                count = int(num_ticks)
                diff = max_v - min_v
                r['ticks'] = [round(min_v + i * (diff / count), 2) for i in range(count + 1)]
            else:
                diff = max_v - min_v
                count = int(diff) if 0 < diff <= 10 else 5
                r['ticks'] = [round(min_v + i * (diff / count), 2) for i in range(count + 1)]
        normalized_gauge_rules[cat_key] = r

    return {
        'filename': os.path.basename(file_path),
        'relative_path': relative_path,
        'target_category': target_category,
        'pass_signal_name': pass_signal_name,
        'show_thresholds': False,
        'oem_name': metadata.get('oem_name', ''),
        'vehicle': metadata.get('vehicle', ''),
        'protocol': protocol,
        'engineer': metadata.get('engineer', ''),
        'analyst': metadata.get('analyst', ''),
        'track': metadata.get('track', ''),
        'test_date': datetime.now(),
        'signals': signals,
        'signal_times': signal_times,
        'camera_image_path': camera_image_path,
        'tgaze': tgaze,
        't_event': t_event,
        't_event_color': t_event_color,
        'mask': mask_start,
        'audio_params': {
            'min_freq': float(micro.get('min_freq')) if (micro and micro.get('min_freq') is not None) else 230.0,
            'max_freq': float(micro.get('max_freq')) if (micro and micro.get('max_freq') is not None) else 2000.0,
            'threshold': float(micro.get('threshold')) if (micro and micro.get('threshold') is not None) else (float(signals_conf.get('SoundPressure', {}).get('threshold')) if ('SoundPressure' in signals_conf and signals_conf.get('SoundPressure', {}).get('threshold') is not None) else 0.0)
        },
        'gauge_rules': normalized_gauge_rules,
        'driver_marks': driver_marks,
        'unresponsive_phases': unresponsive_phases
    }


def update_excel_results(config: dict, file_path: str):
    """Update Analysis_Results.xlsx with 6-column format matching PySide6 original."""
    import openpyxl
    from openpyxl.styles import PatternFill, Font, Alignment

    participant_dir = os.path.dirname(file_path)
    excel_path = os.path.join(participant_dir, "Analysis_Results.xlsx")
    file_name = os.path.basename(file_path)

    folder_name = config.get('target_category', '--')
    dist_start = config.get('tgaze')

    pass_sig = config.get('pass_signal_name')
    warn_start = config.get('signal_times', {}).get(pass_sig) if pass_sig else None

    warn_timer = config.get('t_event')
    score = "PASS" if config.get('t_event_color') == "green" else "FAIL"

    row_data = [
        folder_name,
        file_name,
        dist_start if dist_start is not None else "",
        warn_start if warn_start is not None else "nan",
        warn_timer if isinstance(warn_timer, (int, float)) else "",
        score
    ]

    try:
        if os.path.exists(excel_path):
            wb = openpyxl.load_workbook(excel_path)
            ws = wb.active
        else:
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Results"
            headers = ["Folder Name", "File Name", "Distraction Start",
                       "Warning Start", "Warning Timer", "Score"]
            ws.append(headers)

            header_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
            header_font = Font(bold=True)
            for cell in ws[1]:
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center")

        # Find existing row by File Name (column 2)
        found_row = -1
        for row in range(2, ws.max_row + 1):
            cell_val = ws.cell(row=row, column=2).value
            if cell_val and str(cell_val) == file_name:
                found_row = row
                break

        if found_row != -1:
            for col_idx, val in enumerate(row_data, 1):
                ws.cell(row=found_row, column=col_idx, value=val)
            target_row = found_row
        else:
            ws.append(row_data)
            target_row = ws.max_row

        for cell in ws[target_row]:
            cell.alignment = Alignment(horizontal="center")

        for i, col in enumerate(ws.columns, 1):
            max_length = 0
            for cell in col:
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))
            ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = max_length + 4

        wb.save(excel_path)
        logger.info(f"Excel result saved/updated in {excel_path}")
    except Exception as e:
        logger.error(f"Failed to update excel results: {e}")


@router.post("/gaze/preview")
async def gaze_preview(req: GazePreviewRequest):
    import traceback
    from backend.routers.analysis import _load_marks_dict, _get_marks_key
    from backend.core.report_builder import MatplotlibReportBuilder
    try:
        if not os.path.exists(req.file_path):
            return {"status": "error", "message": f"File not found: {req.file_path}"}
        
        source_dir = req.source_dir
        if not source_dir:
            curr = os.path.dirname(req.file_path)
            while curr and curr != os.path.dirname(curr):
                if os.path.exists(os.path.join(curr, "marks.json")):
                    source_dir = curr
                    break
                curr = os.path.dirname(curr)
            if not source_dir:
                source_dir = os.path.dirname(req.file_path)

        marks_dict = _load_marks_dict(source_dir)
        key = _get_marks_key(req.file_path)
        driver_marks = marks_dict.get(key) or marks_dict.get(key.replace(".mf4", "_tracking.mf4")) or []
        if not isinstance(driver_marks, list):
            driver_marks = []
            
        config = build_report_config(
            file_path=req.file_path,
            protocol=req.protocol,
            metadata=req.metadata,
            category_configs=req.category_configs,
            gauge_rules=req.gauge_rules,
            driver_marks=driver_marks,
            micro=req.micro
        )
        
        temp_dir = os.path.abspath("temp")
        os.makedirs(temp_dir, exist_ok=True)
        preview_output_path = os.path.join(temp_dir, "gaze_preview.png")
        
        builder = MatplotlibReportBuilder(config)
        builder.generate(preview_output_path, dpi=300)
        
        return {
            "status": "success",
            "preview_path": preview_output_path
        }
    except Exception as e:
        logger.error(f"Error generating gaze preview: {e}")
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


@router.post("/gaze/generate")
async def gaze_generate(req: GazeGenerateRequest):
    global _active_worker, _worker_thread

    if _active_worker is not None:
        return {"status": "already_running"}

    loop = asyncio.get_event_loop()

    def on_progress(msg):
        asyncio.run_coroutine_threadsafe(
            manager_reporting.broadcast({"type": "progress", "message": msg}), loop
        )

    class _GazeReportingWorker:
        def __init__(self):
            self.is_running = True

        def stop(self):
            self.is_running = False

        def run(self):
            from backend.routers.analysis import _load_marks_dict, _get_marks_key
            from backend.core.report_builder import MatplotlibReportBuilder
            
            total_files = len(req.files)
            success_count = 0
            for idx, file_path in enumerate(req.files):
                if not self.is_running:
                    on_progress("Gaze batch generation stopped by user.")
                    break
                
                base_name = os.path.splitext(os.path.basename(file_path))[0]
                on_progress(f"Processing ({idx+1}/{total_files}): {base_name}...")
                asyncio.run_coroutine_threadsafe(
                    manager_reporting.broadcast({
                        "type": "progress_update",
                        "current": idx + 1,
                        "total": total_files,
                        "message": f"Processing ({idx+1}/{total_files}): {base_name}..."
                    }), loop
                )
                
                try:
                    if not os.path.exists(file_path):
                        on_progress(f"[ERROR] File not found: {file_path}")
                        continue
                    
                    source_dir = req.source_dir
                    if not source_dir:
                        curr = os.path.dirname(file_path)
                        while curr and curr != os.path.dirname(curr):
                            if os.path.exists(os.path.join(curr, "marks.json")):
                                source_dir = curr
                                break
                            curr = os.path.dirname(curr)
                        if not source_dir:
                            source_dir = os.path.dirname(file_path)

                    marks_dict = _load_marks_dict(source_dir)
                    key = _get_marks_key(file_path)
                    driver_marks = marks_dict.get(key) or marks_dict.get(key.replace(".mf4", "_tracking.mf4")) or []
                    if not isinstance(driver_marks, list):
                        driver_marks = []
                        
                    config = build_report_config(
                        file_path=file_path,
                        protocol=req.protocol,
                        metadata=req.metadata,
                        category_configs=req.category_configs,
                        gauge_rules=req.gauge_rules,
                        driver_marks=driver_marks,
                        micro=req.micro
                    )
                    
                    base_dir = os.path.dirname(file_path)
                    reports_dir = os.path.join(base_dir, "Reports")
                    os.makedirs(reports_dir, exist_ok=True)
                    output_png = os.path.join(reports_dir, f"{base_name}.png")
                    
                    builder = MatplotlibReportBuilder(config)
                    builder.generate(output_png, dpi=300)
                    
                    update_excel_results(config=config, file_path=file_path)
                    
                    success_count += 1
                except Exception as e:
                    logger.error(f"Failed to generate report for {file_path}: {e}")
                    on_progress(f"[ERROR] {base_name}: {str(e)}")

            loop.call_soon_threadsafe(
                lambda: asyncio.run_coroutine_threadsafe(
                    manager_reporting.broadcast({
                        "type": "finished",
                        "message": f"Successfully generated {success_count} reports."
                    }), loop
                )
            )
            
            global _active_worker
            _active_worker = None

    worker = _GazeReportingWorker()
    _active_worker = worker

    def _run():
        worker.run()

    _worker_thread = Thread(target=_run, daemon=True)
    _worker_thread.start()

    return {"status": "started"}


class GaugeFileReadRequest(BaseModel):
    file_path: str


class GaugeFileWriteRequest(BaseModel):
    file_path: str
    rules: dict


class GaugeFileExistsRequest(BaseModel):
    file_path: str


@router.post("/gauge_rules/read_file")
async def read_gauge_rules_file(req: GaugeFileReadRequest):
    if not os.path.exists(req.file_path):
        return {"error": "File not found"}
    try:
        with open(req.file_path, "r", encoding="utf-8") as f:
            content = json.load(f)
            if isinstance(content, dict):
                return {"rules": content}
            return {"error": "Invalid format, must be a JSON object"}
    except Exception as e:
        return {"error": str(e)}


@router.post("/gauge_rules/write_file")
async def write_gauge_rules_file(req: GaugeFileWriteRequest):
    try:
        parent_dir = os.path.dirname(req.file_path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)
        with open(req.file_path, "w", encoding="utf-8") as f:
            json.dump(req.rules, f, indent=2)
        return {"status": "success"}
    except Exception as e:
        return {"error": str(e)}


@router.post("/gauge_rules/exists")
async def check_gauge_rules_exists(req: GaugeFileExistsRequest):
    return {"exists": os.path.exists(req.file_path) and os.path.isfile(req.file_path)}