import asyncio
import json
import logging
import os
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


class GazeGenerateRequest(BaseModel):
    files: list[str]
    protocol: str = "Euro NCAP"
    metadata: dict = {}
    category_configs: dict = {}
    gauge_rules: dict = {}


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


def build_report_config(file_path: str, protocol: str, metadata: dict, category_configs: dict, gauge_rules: dict, driver_marks: list) -> dict:
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
                elif num in [4, 5]:
                    target_category = "Unresponsive driver"

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

    signals = {}
    with MDF(file_path) as mdf:
        for sig_name, sig_info in signals_conf.items():
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
                'threshold': thresh_val,
                'unit': getattr(mdf_sig, 'unit', 'Value'),
                'category': target_category,
                'alias': sig_info.get('alias') or sig_name
            }

    signal_times = {}
    for sig_name, sig_info in signals.items():
        timestamps = sig_info['timestamps']
        samples = sig_info['samples']
        operator = sig_info['operator']
        threshold = sig_info['threshold']
        first_match_time = None

        if sig_name == "SoundPressure":
            try:
                audio_thresh = threshold
                if len(samples) > 0 and len(timestamps) > 0:
                    samples_numeric = samples
                    try:
                        min_f = 230
                        max_f = 2000
                        samples_np = np.array(samples, dtype=float)
                        dur = timestamps[-1] - timestamps[0]
                        fs = len(samples) / dur if dur > 0 else 44100
                        nyq = 0.5 * fs
                        low = min_f / nyq
                        high = max_f / nyq
                        from scipy.signal import butter, filtfilt
                        b, a = butter(4, [low, high], btype='band')
                        samples_numeric = list(filtfilt(b, a, samples_np))
                    except:
                        pass
                    
                    op = operator if operator and operator != 'None' else '>='
                    first_match_time = find_first_valid_event(
                        np.array(samples_numeric),
                        np.array(timestamps),
                        float(audio_thresh),
                        op,
                        mask_start=mask_start
                    )
            except Exception as e:
                logger.error(f"Error calculating SoundPressure: {e}")
        elif threshold is not None and operator and operator != 'None':
            try:
                threshold_num = float(threshold)
                for t, val in zip(timestamps, samples):
                    if t < mask_start:
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
                    if t < mask_start:
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

    tgaze = mask_start
    if driver_marks and len(driver_marks) > 0:
        try:
            tgaze = float(driver_marks[0])
        except:
            pass

    t_event = "No warn"
    t_event_color = "red"
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
            'min_freq': 230,
            'max_freq': 2000,
            'threshold': float(signals_conf.get('SoundPressure', {}).get('threshold', 0.0)) if 'SoundPressure' in signals_conf else 0.0
        },
        'gauge_rules': gauge_rules,
        'driver_marks': driver_marks
    }


def update_excel_results(file_path: str, category: str, t0: float, t_event: any, status_color: str):
    import openpyxl
    from openpyxl.styles import Alignment
    base_dir = os.path.dirname(file_path)
    excel_path = os.path.join(base_dir, "Analysis_Results.xlsx")
    file_name = os.path.basename(file_path)
    file_name_clean = file_name.replace("_tracking.mf4", ".mf4")
    overall_status = "PASS" if status_color == "green" else "FAIL"
    
    try:
        if os.path.exists(excel_path):
            wb = openpyxl.load_workbook(excel_path)
            ws = wb.active
        else:
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Results"
            ws.append(["File Name", "Category", "T0 / T_gaze (s)", "T_event (s)", "Result"])
            for cell in ws[1]:
                cell.alignment = Alignment(horizontal="center")
                
        found_row = -1
        for row in range(2, ws.max_row + 1):
            cell_val = ws.cell(row=row, column=1).value
            if cell_val:
                c_val = str(cell_val).replace("_tracking.mf4", ".mf4")
                if c_val == file_name_clean:
                    found_row = row
                    break
                    
        row_data = [file_name, category, t0, t_event, overall_status]
        
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
            driver_marks=driver_marks
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
                
                try:
                    if not os.path.exists(file_path):
                        on_progress(f"[ERROR] File not found: {file_path}")
                        continue
                    
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
                        driver_marks=driver_marks
                    )
                    
                    base_dir = os.path.dirname(file_path)
                    reports_dir = os.path.join(base_dir, "Reports")
                    os.makedirs(reports_dir, exist_ok=True)
                    output_png = os.path.join(reports_dir, f"{base_name}.png")
                    
                    builder = MatplotlibReportBuilder(config)
                    builder.generate(output_png, dpi=300)
                    
                    update_excel_results(
                        file_path=file_path,
                        category=config['target_category'],
                        t0=config['tgaze'],
                        t_event=config['t_event'],
                        status_color=config['t_event_color']
                    )
                    
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