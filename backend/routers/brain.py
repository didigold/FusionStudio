import asyncio
import glob
import json
import logging
import os
import shutil
from threading import Thread

from fastapi import APIRouter, WebSocket
from pydantic import BaseModel

from backend.ws.manager import manager_brain, manager_system
from backend.core.utils import resource_path

logger = logging.getLogger("fusionstudio.brain")

router = APIRouter()


class TrainLegacyRequest(BaseModel):
    root_folders: list[str]
    model_name: str = "distraction_detector"
    epochs: int = 100
    lr: float = 0.001


class TrainMultimodalRequest(BaseModel):
    root_folders: list[str]
    model_name: str = "distraction_detector"
    epochs: int = 150
    lr: float = 0.001
    patience: int = 20
    batch_size: int = 32
    weight_decay: float = 0.0001
    video_fps: int = 5
    camera_config: dict[str, str] = {}
    base_model_path: str = ""


class AnalyzeRequest(BaseModel):
    tracking_mf4: str
    video_path: str = ""
    model_path: str = ""


class DeleteModelRequest(BaseModel):
    path: str


_active_training = None
_training_thread: Thread | None = None


@router.get("/projects")
async def list_projects(root: str = ""):
    if not root or not os.path.isdir(root):
        return {"projects": []}
    projects = []
    for folder in os.listdir(root):
        fpath = os.path.join(root, folder)
        if not os.path.isdir(fpath):
            continue
        avis = len(glob.glob(os.path.join(fpath, "**", "*.avi"), recursive=True))
        mf4s = len(glob.glob(os.path.join(fpath, "**", "*.mf4"), recursive=True))
        if avis > 0 or mf4s > 0:
            projects.append({"name": folder, "path": fpath, "avis": avis, "mf4s": mf4s})
    return {"projects": projects}


def clean_nans_infs(obj):
    import math
    if isinstance(obj, float):
        if math.isinf(obj) or math.isnan(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: clean_nans_infs(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nans_infs(v) for v in obj]
    return obj


@router.get("/models")
async def list_models():
    models_dir = resource_path("models")
    if not os.path.exists(models_dir):
        return {"models": []}

    result = []
    for root, dirs, files in os.walk(models_dir):
        for f in files:
            if f == "model.pkl" or f == "model.pt":
                rel = os.path.relpath(root, models_dir)
                parts = rel.replace("\\", "/").split("/")
                architecture = parts[0] if len(parts) > 0 else "unknown"
                variant = parts[1] if len(parts) > 1 else ""
                size = os.path.getsize(os.path.join(root, f))
                entry = {
                    "path": os.path.join(root, f),
                    "architecture": architecture,
                    "variant": variant,
                    "size_mb": round(size / (1024 * 1024), 2),
                    "metadata": None,
                }
                # Try to load metadata from metadata.json or training_history.json
                meta_path = os.path.join(root, "metadata.json")
                if not os.path.exists(meta_path):
                    meta_path = os.path.join(root, "training_history.json")
                if os.path.exists(meta_path):
                    try:
                        with open(meta_path) as hf:
                            entry["metadata"] = json.load(hf)
                    except Exception:
                        pass
                # Try to load metadata from model.pkl (joblib)
                elif f == "model.pkl":
                    try:
                        import joblib
                        data = joblib.load(os.path.join(root, f))
                        if isinstance(data, dict) and "metadata" in data:
                            entry["metadata"] = data["metadata"]
                    except Exception:
                        pass
                result.append(entry)
    return clean_nans_infs({"models": result})


@router.delete("/models")
async def delete_model(req: DeleteModelRequest):
    """Delete a saved model file and its containing directory."""
    model_path = req.path
    if not os.path.exists(model_path):
        return {"status": "not_found"}

    # Safety: only allow deletion within the models directory
    models_dir = resource_path("models")
    try:
        abs_model = os.path.abspath(model_path)
        abs_models = os.path.abspath(models_dir)
        if not abs_model.startswith(abs_models):
            return {"status": "forbidden", "message": "Path outside models directory"}
    except Exception:
        return {"status": "error", "message": "Invalid path"}

    try:
        model_dir = os.path.dirname(model_path)
        shutil.rmtree(model_dir)
        logger.info(f"Deleted model directory: {model_dir}")
        return {"status": "deleted"}
    except Exception as e:
        logger.error(f"Failed to delete model: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/history")
async def get_history():
    models_dir = resource_path("models")
    result = {"mlp": None, "multimodal": None}

    # MLP history
    for root, dirs, files in os.walk(os.path.join(models_dir, "distraction_detector", "mlp") if os.path.exists(os.path.join(models_dir, "distraction_detector")) else models_dir):
        for f in files:
            if f == "model.pkl":
                try:
                    import joblib
                    data = joblib.load(os.path.join(root, f))
                    meta = data.get("metadata", {})
                    result["mlp"] = {
                        "name": meta.get("name", "MLP"),
                        "projects": meta.get("projects", []),
                        "history": meta.get("history", {}),
                    }
                except Exception:
                    pass

    # Multimodal history  
    for root, dirs, files in os.walk(os.path.join(models_dir, "distraction_detector", "multimodal") if os.path.exists(os.path.join(models_dir, "distraction_detector")) else models_dir):
        if "training_history.json" in files:
            try:
                with open(os.path.join(root, "training_history.json")) as hf:
                    result["multimodal"] = json.load(hf)
            except Exception:
                pass

    return clean_nans_infs(result)


@router.post("/train/legacy")
async def train_legacy(req: TrainLegacyRequest):
    global _active_training, _training_thread

    if _active_training is not None:
        return {"status": "already_running"}

    loop = asyncio.get_event_loop()

    def emit(evt: dict):
        asyncio.run_coroutine_threadsafe(
            manager_brain.broadcast(evt), loop
        )

    class _LegacyTrainer:
        def __init__(self):
            self.is_running = True

        def stop(self):
            self.is_running = False

        def run(self):
            try:
                from backend.core.dataset_builder import DatasetBuilder
                from backend.core.ml_engine import MLEngine

                builder = DatasetBuilder(
                    on_log=lambda m: emit({"type": "log", "message": m}),
                    on_progress=lambda v: emit({"type": "progress", "value": v}),
                )
                engine = MLEngine(
                    resource_path("models"),
                    on_log=lambda m: emit({"type": "log", "message": m}),
                    on_epoch_progress=lambda ep, loss, acc: emit({
                        "type": "epoch",
                        "epoch": ep,
                        "loss": loss,
                        "acc": acc,
                    }),
                )

                emit({"type": "status", "phase": "building"})
                built = builder.build_from_folders(req.root_folders, "")

                if not built:
                    emit({"type": "error", "message": "Dataset build failed"})
                    return

                csv_path = os.path.join(
                    resource_path("models"), "distraction_detector", "mlp",
                    f"train_{req.model_name}.csv"
                )
                os.makedirs(os.path.dirname(csv_path), exist_ok=True)
                built = builder.build_from_folders(req.root_folders, csv_path)

                emit({"type": "status", "phase": "training"})
                success = engine.train(
                    csv_path, req.model_name, req.epochs, req.lr, req.root_folders, check_running_callback=lambda: worker.is_running
                )

                if success:
                    emit({"type": "finished"})
                else:
                    emit({"type": "error", "message": "Training failed"})

            except Exception as e:
                emit({"type": "error", "message": str(e)})

    worker = _LegacyTrainer()
    _active_training = worker

    def _run():
        global _active_training
        try:
            worker.run()
        finally:
            _active_training = None

    _training_thread = Thread(target=_run, daemon=True)
    _training_thread.start()

    return {"status": "started"}


@router.post("/train/multimodal")
async def train_multimodal(req: TrainMultimodalRequest):
    global _active_training, _training_thread

    if _active_training is not None:
        return {"status": "already_running"}

    loop = asyncio.get_event_loop()

    def emit(evt: dict):
        asyncio.run_coroutine_threadsafe(
            manager_brain.broadcast(evt), loop
        )

    class _MultiTrainer:
        def __init__(self):
            self.is_running = True

        def stop(self):
            self.is_running = False

        def run(self):
            global _active_training
            try:
                from backend.core.dataset_builder import DatasetBuilder
                from backend.core.multimodal_engine import MultimodalTrainer
                from backend.core.video_feature_extractor import VideoFeatureExtractor

                # Auto-generate model name with timestamp
                from datetime import datetime
                timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                model_name = f"distraction_detector_{timestamp_str}"

                output_dir = os.path.join(
                    resource_path("models"), "distraction_detector", "multimodal",
                    f"run_{model_name}"
                )
                os.makedirs(output_dir, exist_ok=True)

                extractor = VideoFeatureExtractor(
                    fps_sample=req.video_fps,
                    on_log=lambda v: emit({"type": "log", "message": v}),
                    on_progress=lambda v: emit({"type": "status", "phase": "extracting", "progress": v}),
                )

                builder = DatasetBuilder(
                    on_log=lambda m: emit({"type": "log", "message": m}),
                    on_progress=lambda v: emit({"type": "status", "phase": "building", "progress": v}),
                )

                def _on_metrics(data):
                    """Route metrics: dataset_stats go as their own type, epoch data as 'epoch'."""
                    if data.get("type") == "dataset_stats":
                        emit({"type": "dataset_stats", **{k: v for k, v in data.items() if k != "type"}})
                    else:
                        emit({
                            "type": "epoch",
                            "epoch": data.get("epoch"),
                            "loss": data.get("loss"),
                            "acc": data.get("acc"),
                            "val_loss": data.get("val_loss"),
                            "val_acc": data.get("val_acc"),
                            "val_f1": data.get("val_f1"),
                            "train_f1": data.get("train_f1"),
                            "lr": data.get("lr"),
                            "epoch_time": data.get("epoch_time"),
                        })

                trainer = MultimodalTrainer(
                    on_metrics=_on_metrics,
                    on_log=lambda m: emit({"type": "log", "message": m}),
                )

                emit({"type": "status", "phase": "extracting"})
                emit({"type": "log", "message": f"Starting video feature extraction (sampling at {req.video_fps} fps)..."})

                result = builder.build_multimodal_from_folders(
                    req.root_folders, output_dir,
                    video_extractor=extractor,
                    project_camera_config=req.camera_config,
                )

                if result is None:
                    emit({"type": "error", "message": "Dataset building failed"})
                    return

                emit({"type": "status", "phase": "training"})
                emit({"type": "log", "message": "Starting multimodal training..."})

                success = trainer.train(
                    result["signal_windows"],
                    result["video_windows"],
                    result["labels"],
                    result["project_ids"],
                    model_name, req.epochs, req.lr,
                    req.root_folders, req.patience,
                    base_model_path=req.base_model_path,
                    batch_size=req.batch_size,
                    weight_decay=req.weight_decay,
                    check_running_callback=lambda: worker.is_running
                )

                if success:
                    emit({"type": "finished"})
                else:
                    emit({"type": "error", "message": "Training failed"})

            except Exception as e:
                emit({"type": "error", "message": str(e)})
            finally:
                _active_training = None

    worker = _MultiTrainer()
    _active_training = worker

    def _run():
        worker.run()

    _training_thread = Thread(target=_run, daemon=True)
    _training_thread.start()

    return {"status": "started"}


@router.post("/stop")
async def stop_training():
    global _active_training
    if _active_training is not None:
        _active_training.stop()
        return {"status": "stopping"}
    return {"status": "no_worker"}


@router.post("/analyze")
async def analyze_file(req: AnalyzeRequest):
    loop = asyncio.get_event_loop()
    loop_ref = asyncio.get_event_loop()

    def emit(evt: dict):
        asyncio.run_coroutine_threadsafe(
            manager_brain.broadcast(evt), loop_ref
        )

    def _run():
        from backend.core.ai_analyzer import AIAnalyzer
        analyzer = AIAnalyzer(
            on_log=lambda m: emit({"type": "log", "message": m}),
            on_progress=lambda v: emit({"type": "progress", "value": v}),
        )
        try:
            result = analyzer.analyze(req.tracking_mf4, req.video_path, req.model_path)
            emit({"type": "analysis_done", "markers": result})
        except Exception as e:
            emit({"type": "error", "message": str(e)})

    Thread(target=_run, daemon=True).start()
    return {"status": "started"}


@router.websocket("/ws/training")
async def ws_brain_train(ws: WebSocket):
    await manager_brain.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except Exception:
        await manager_brain.disconnect(ws)


@router.websocket("/ws/system")
async def ws_brain_system(ws: WebSocket):
    await manager_system.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except Exception:
        await manager_system.disconnect(ws)