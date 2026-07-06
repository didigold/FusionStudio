import os
import re

base_path = r"C:\Software\OSM\FusionStudio\backend\routers"
reporting_path = os.path.join(base_path, "reporting.py")
om_path = os.path.join(base_path, "om.py")

with open(reporting_path, "r", encoding="utf-8") as f:
    reporting_content = f.read()

om_header = """import asyncio
import json
import logging
import os
from datetime import datetime
from threading import Thread

from fastapi import APIRouter, WebSocket
from pydantic import BaseModel
from asammdf import MDF
import numpy as np

from backend.core.utils import resource_path
from backend.ws.manager import manager_reporting
from backend.core.om_report_builder import OMReportBuilder
from backend.routers.reporting import _load_marks_dict, _get_marks_key, update_excel_results

logger = logging.getLogger("fusionstudio.om")
router = APIRouter()

class OMGenerateRequest(BaseModel):
    files: list[str]
    protocol: str = "Euro NCAP"
    metadata: dict = {}
    category_configs: dict = {}
    gauge_rules: dict = {}
    micro: dict = {}
    source_dir: str = ""
    report_camera_settings: dict | None = None

class OMPreviewRequest(BaseModel):
    file_path: str
    protocol: str = "Euro NCAP"
    metadata: dict = {}
    category_configs: dict = {}
    gauge_rules: dict = {}
    micro: dict = {}
    source_dir: str = ""
    report_camera_settings: dict | None = None
"""

match_build = re.search(r"(def build_report_config.*?)(?=\n\nclass |\n\n@router|\Z)", reporting_content, re.DOTALL)
build_func = match_build.group(1) if match_build else ""
build_func_om = build_func.replace("def build_report_config", "def build_om_report_config")
build_func_om = build_func_om.replace('target_category = "Long Distraction (NDT)"', 'target_category = "CSR — Initial Phase"')

match_worker = re.search(r"(class _GazeReportingWorker.*?)(?=\n\nclass |\n\n@router|\Z)", reporting_content, re.DOTALL)
worker_cls = match_worker.group(1) if match_worker else ""
worker_cls_om = worker_cls.replace("_GazeReportingWorker", "_OMReportingWorker")
worker_cls_om = worker_cls_om.replace("build_report_config", "build_om_report_config")
worker_cls_om = worker_cls_om.replace("builder = MatplotlibReportBuilder(config)", "builder = OMReportBuilder(config)")

match_resolve = re.search(r"(def _resolve_om_video_paths.*?)(?=\n\nclass |\n\ndef |\n\n@router|\Z)", reporting_content, re.DOTALL)
resolve_func = match_resolve.group(1) if match_resolve else ""

endpoints_om = """
_active_worker = None
_worker_thread: Thread | None = None

@router.post("/generate")
async def generate_om_report(req: OMGenerateRequest):
    global _active_worker, _worker_thread

    if _active_worker is not None:
        return {"status": "already_running"}

    loop = asyncio.get_event_loop()

    def on_progress(msg):
        asyncio.run_coroutine_threadsafe(
            manager_reporting.broadcast({"type": "progress", "message": msg}), loop
        )

{WORKER_CLS}

    worker = _OMReportingWorker()
    _active_worker = worker

    def _run():
        worker.run()

    _worker_thread = Thread(target=_run, daemon=True)
    _worker_thread.start()

    return {"status": "started"}
""".replace("{WORKER_CLS}", worker_cls_om)

om_file_content = om_header + "\n" + resolve_func + "\n" + build_func_om + "\n" + endpoints_om

with open(om_path, "w", encoding="utf-8") as f:
    f.write(om_file_content)

print("OM router created successfully.")
