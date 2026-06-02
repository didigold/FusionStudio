import asyncio
import logging
import os
import re
from threading import Thread

from fastapi import APIRouter, WebSocket
from pydantic import BaseModel

from backend.ws.manager import manager_classify
from backend.core.classification_worker import ClassificationWorker

logger = logging.getLogger("fusionstudio.classification")

router = APIRouter()

# NCAP data mapping (from original PySide6 ClassificationWidget)
NCAP_DATA: dict[str, tuple[str, str]] = {
    "D1":   ("Driver side window", "LD_NDT_OW_DSW"),
    "D2":   ("Passenger side window", "LD_NDT_OW_PSW"),
    "D3":   ("Passenger footwell", "LD_NDT_OW_PAF"),
    "D4":   ("Passenger face", "LD_NDT_OW_PFA"),
    "D5":   ("In-vehicle infotainment system", "LD_NDT_OW_IIS"),
    "D6":   ("In-vehicle infotainment system", "LD_NDT_LI_IIS"),
    "D7":   ("Glovebox", "LD_NDT_LI_GLB"),
    "D8":   ("Passenger footwell", "LD_NDT_BL_PAF"),
    "D9":   ("Rear passenger", "LD_NDT_BL_RPA"),
    "D10":  ("Rear view mirror", "LD_DRT_OW_RVM"),
    "D11":  ("Passenger side mirror", "LD_DRT_OW_PSM"),
    "D12":  ("Driver side mirror", "LD_DRT_OW_DSM"),
    "D13":  ("Instrument cluster", "LD_DRT_LI_ICL"),
    "D14":  ("Driver side mirror", "LD_DRT_LI_DSM"),
    "D15":  ("Rear view mirror", "LD_DRT_LI_RVM"),
    "D16":  ("In-vehicle infotainment system", "SD_NDT_OW_IIS"),
    "D17":  ("Passenger footwell", "SD_NDT_OW_PAF"),
    "D18":  ("Passenger footwell", "SD_NDT_LI_PAF"),
    "D19":  ("In-vehicle infotainment system", "SD_NDT_LI_IIS"),
    "D20":  ("Rear view mirror", "SD_DRT_OW_RVM"),
    "D21":  ("Passenger side mirror", "SD_DRT_OW_PSM"),
    "D22":  ("Driver side mirror", "SD_DRT_OW_DSM"),
    "D23":  ("Passenger side window", "SD_DRT_OW_PSW"),
    "D24":  ("Instrument cluster", "SD_DRT_LI_ICL"),
    "D25":  ("Driver side mirror", "SD_DRT_LI_DSM"),
    "D26":  ("Rear view mirror", "SD_DRT_LI_RVM"),
    "D27":  ("Driver side window", "SD_DRT_LI_PSW"),
    "D28":  ("Combination NDT locations", "SD_AFR_LI_COMB"),
    "D29":  ("Driver knee outboard", "PU_PUB_OW_DKD"),
    "D30":  ("Driver knee inboard", "PU_PUB_OW_DKP"),
    "D31":  ("Driver lap", "PU_PUB_OW_DLA"),
    "D32":  ("Phone dash outboard", "PU_PUB_OW_PDD"),
    "D33":  ("Phone in charge port", "PU_PUB_OW_DCP"),
    "D34":  ("Driver knee outboard", "PU_PUB_LI_DKD"),
    "D35":  ("Driver knee inboard", "PU_PUB_LI_DKP"),
    "D36":  ("Driver lap", "PU_PUB_LI_DLA"),
    "D37":  ("Phone centre steering wheel", "PU_PUB_LI_PHC"),
    "D38":  ("Phone in charge port", "PU_PUB_LI_DCP"),
    "D39":  ("Phone dash outboard", "PU_PUA_LI_PDD"),
    "D40":  ("Phone 9-11 / 13-15 o'clock", "PU_PUA_LI_PHS"),
    "D41":  ("Phone in view of windscreen", "PU_PUA_LI_PHW"),
    "D42":  ("Phone in view of instrument cluster", "PU_PUA_LI_PHI"),
    "F1":   ("Microsleep", "FAT_MSL"),
    "F2":   ("Sleep", "FAT_SLE"),
    "F3":   ("Drowsiness", "FAT_DRO"),
    "F4":   ("Unresponsive driver", "UR_SPD"),
    "F5":   ("Unresponsive driver", "UR_SPD"),
}

OCCLUSION_CODES: dict[int, str] = {
    4: "CG", 5: "SU", 6: "SH", 7: "LH", 8: "BL",
    9: "FM", 10: "HA", 11: "FR", 12: "EM",
}


class ScanRequest(BaseModel):
    source_dir: str


class GenerateNamesRequest(BaseModel):
    case_key: str
    attempt: int = 1
    occ_code: str | None = None
    year: str = ""
    oem: str = ""
    ref_code: str = ""
    protocol: str = "DSM"


class RunRequest(BaseModel):
    tasks: list[dict]
    project_root: str
    meta: dict
    report_pdf_path: str = ""


class ControlRequest(BaseModel):
    pass


_active_worker: ClassificationWorker | None = None
_worker_thread: Thread | None = None


def _natural_sort_key(s: str) -> list:
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"([0-9]+)", s)]


def _get_official_case_name(case_key: str, attempt: int, occ_code: str | None,
                            ref_code: str) -> str:
    base_key = case_key.split("_")[0]
    info = NCAP_DATA.get(base_key)
    base_code = f"UNDEFINED_{case_key}"
    if info:
        base_code = info[1]
        if occ_code:
            parts = base_code.split("_")
            if len(parts) > 1:
                parts.insert(-1, occ_code)
                base_code = "_".join(parts)
            else:
                base_code = f"{base_code}_{occ_code}"
    if not ref_code:
        ref_code = "0000"
    return f"{ref_code}-{base_code}_{attempt:02d}"


@router.post("/scan")
async def scan_directory(req: ScanRequest):
    loop = asyncio.get_event_loop()

    def _scan():
        base_dir = req.source_dir
        if not base_dir or not os.path.exists(base_dir):
            return {"groups": []}

        pattern = re.compile(r"([DFWB]+)(\d+)(?:_O(\d+))?_(\d+)")
        pattern_simple = re.compile(r"([DFWB]+)(\d+)")

        groups: dict[str, list] = {}

        for r, _, files in os.walk(base_dir):
            for file in files:
                if not file.lower().endswith(".mf4"):
                    continue
                clean_file = re.sub(r'_tracking', '', file, flags=re.IGNORECASE)
                match = pattern.match(clean_file)
                simple_match = pattern_simple.match(clean_file)
                if not match and not simple_match:
                    continue

                case_key = "Unknown"
                attempt = 1
                occ_val: int | None = None
                if match:
                    prefix, pos, occ_str, att_str = match.groups()
                    case_key = f"{prefix}{pos}"
                    if occ_str:
                        case_key += f"_O{occ_str}"
                        occ_val = int(occ_str)
                    attempt = int(att_str) if att_str else 1
                elif simple_match:
                    prefix, pos = simple_match.groups()
                    case_key = f"{prefix}{pos}"

                occ_code = OCCLUSION_CODES.get(occ_val) if occ_val else None

                base_src_name = re.sub(r'_tracking', '', os.path.splitext(file)[0], flags=re.IGNORECASE)
                
                has_report = False
                for folder in [r, os.path.join(r, "Reports"), os.path.join(r, "reports")]:
                    if os.path.exists(folder) and os.path.isdir(folder):
                        pngs = [f for f in os.listdir(folder) if f.lower().endswith(".png") and f.lower().startswith(base_src_name.lower())]
                        if pngs:
                            has_report = True
                            break

                has_video = False
                avis = [f for f in os.listdir(r) if f.lower().endswith(".avi") and f.lower().startswith(base_src_name.lower())]
                if avis:
                    has_video = True

                file_data = {
                    "path": os.path.join(r, file),
                    "filename": file,
                    "case_key": case_key,
                    "attempt": attempt,
                    "occ_code": occ_code,
                    "has_report": has_report,
                    "has_video": has_video,
                }
                groups.setdefault(case_key, []).append(file_data)

        sorted_keys = sorted(groups.keys(), key=_natural_sort_key)
        result: list[dict] = []

        for case_key in sorted_keys:
            file_list = groups[case_key]
            base_key = case_key.split("_")[0]
            info = NCAP_DATA.get(base_key)
            description = info[0] if info else "Undefined Case"
            nc_code = info[1] if info else f"UNDEF_{case_key}"
            if file_list[0].get("occ_code"):
                description += f" (Occlusion: {file_list[0]['occ_code']})"

            file_list.sort(key=lambda x: x["attempt"])

            children = []
            for f_data in file_list:
                children.append({
                    "path": f_data["path"],
                    "filename": f_data["filename"],
                    "case_key": f_data["case_key"],
                    "attempt": f_data["attempt"],
                    "occ_code": f_data.get("occ_code"),
                    "has_report": f_data.get("has_report", False),
                    "has_video": f_data.get("has_video", False),
                    "checked": True,
                    "status": "pending",
                })

            result.append({
                "case_key": case_key,
                "base_key": base_key,
                "description": description,
                "nc_code": nc_code,
                "file_count": len(file_list),
                "files": children,
            })

        return {"groups": result}

    return await loop.run_in_executor(None, _scan)


@router.post("/generate-names")
async def generate_names(req: GenerateNamesRequest):
    name = _get_official_case_name(
        req.case_key, req.attempt, req.occ_code, req.ref_code
    )
    return {"proposed_name": name}


@router.post("/run")
async def run_classification(req: RunRequest):
    global _active_worker, _worker_thread

    if _active_worker is not None:
        return {"status": "already_running"}

    loop = asyncio.get_event_loop()

    def on_progress(val):
        asyncio.run_coroutine_threadsafe(
            manager_classify.broadcast({"type": "progress", "value": val}), loop
        )

    def on_status(msg):
        asyncio.run_coroutine_threadsafe(
            manager_classify.broadcast({"type": "status", "message": msg}), loop
        )

    def on_item(item_ref_str, success, error_msg):
        asyncio.run_coroutine_threadsafe(
            manager_classify.broadcast({
                "type": "item_done",
                "item_ref": item_ref_str,
                "success": success,
                "error": error_msg,
            }), loop
        )

    worker = ClassificationWorker(
        tasks=req.tasks,
        project_root=req.project_root,
        meta_data=req.meta,
        report_pdf_path=req.report_pdf_path,
        on_progress=on_progress,
        on_status=on_status,
        on_item=on_item,
    )

    _active_worker = worker

    def _run():
        global _active_worker
        try:
            worker.run()
        finally:
            _active_worker = None
            asyncio.run_coroutine_threadsafe(
                manager_classify.broadcast({"type": "finished"}), loop
            )

    _worker_thread = Thread(target=_run, daemon=True)
    _worker_thread.start()

    return {"status": "started"}


@router.post("/stop")
async def stop_classification():
    global _active_worker
    if _active_worker is not None:
        _active_worker.stop()
        return {"status": "stopping"}
    return {"status": "no_worker"}


class CheckCompletedRequest(BaseModel):
    project_root: str
    items: list[dict]


@router.post("/check-completed")
async def check_completed(req: CheckCompletedRequest):
    results = {}
    if not req.project_root:
        return {"results": results}

    for item in req.items:
        item_ref = item["item_ref"]
        case_full_name = item["case_full_name"]

        case_dir = os.path.join(req.project_root, case_full_name)
        mme_file = os.path.join(case_dir, f"{case_full_name}.mme")

        if os.path.exists(case_dir) and os.path.isdir(case_dir) and os.path.exists(mme_file):
            results[item_ref] = "done"
        else:
            results[item_ref] = "pending"

    return {"results": results}



@router.websocket("/ws")
async def ws_classify(ws: WebSocket):
    await manager_classify.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except Exception:
        await manager_classify.disconnect(ws)