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