"""
VideoFeatureExtractor for FusionStudio Multimodal Pipeline.
Extracts per-frame visual embeddings from .avi files using MobileNetV2 (frozen)
and MediaPipe face landmarks (iris ratios + head pose angles).
Embeddings are cached as .npy for reuse across training sessions.
"""
import os
import time
import math
import numpy as np
from PySide6.QtCore import QThread, Signal, QObject


class VideoFeatureExtractor(QObject):
    log = Signal(str)
    progress = Signal(float)

    FRAME_SIZE = (224, 224)
    EMBEDDING_DIM = 1280
    LANDMARK_DIM = 4
    FEATURE_DIM = EMBEDDING_DIM + LANDMARK_DIM

    def __init__(self, cache_dir=None, fps_sample=5):
        super().__init__()
        self.fps_sample = fps_sample
        self._mobilenet = None
        self._mediapipe_model_path = None
        if cache_dir is None:
            from src.core.utils import resource_path
            cache_dir = os.path.join(resource_path("models"), "distraction_detector", "multimodal", "video_cache")
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)
        self._landmark_indices = {
            "right_iris": [474, 475, 476, 477],
            "r_h_left": 362,
            "r_h_right": 263,
            "r_v_brown": 295,
            "r_v_cheek": 349,
            "head_pose": [33, 263, 1, 61, 291, 199],
        }

    def _load_mobilenet(self):
        if self._mobilenet is not None:
            return self._mobilenet
        import torch
        import torchvision.models as models
        model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
        self._mobilenet = torch.nn.Sequential(
            *list(model.features.children()),
            torch.nn.AdaptiveAvgPool2d((1, 1)),
            torch.nn.Flatten(1),
        )
        for param in self._mobilenet.parameters():
            param.requires_grad = False
        self._mobilenet.eval()
        return self._mobilenet

    def _get_mediapipe_path(self):
        if self._mediapipe_model_path is not None:
            return self._mediapipe_model_path
        from src.core.utils import resource_path
        self._mediapipe_model_path = resource_path("assets/face_landmarker.task")
        return self._mediapipe_model_path

    def _extract_frame_embeddings(self, frame):
        import torch
        mobilenet = self._load_mobilenet()
        frame_rgb = frame[:, :, ::-1] if frame.shape[2] == 3 else frame
        frame_resized = self._resize_frame(frame_rgb)
        tensor = torch.from_numpy(frame_resized).permute(2, 0, 1).float() / 255.0
        mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
        tensor = (tensor - mean) / std
        tensor = tensor.unsqueeze(0)
        with torch.no_grad():
            features = mobilenet(tensor)
        return features.squeeze().numpy()

    def _resize_frame(self, frame_rgb):
        import cv2
        resized = cv2.resize(frame_rgb, self.FRAME_SIZE, interpolation=cv2.INTER_LINEAR)
        return resized.astype(np.float32)

    def _extract_landmarks(self, frame_bgr, face_landmarker):
        import mediapipe as mp
        import cv2
        img_h, img_w = frame_bgr.shape[:2]
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        result = face_landmarker.detect(mp_image)
        if not result.face_landmarks:
            last_vals = getattr(self, "_last_landmark_vals", None)
            if last_vals is not None:
                return last_vals
            return np.zeros(self.LANDMARK_DIM, dtype=np.float32)

        landmarks = result.face_landmarks[0]
        iris_pts = [landmarks[i] for i in self._landmark_indices["right_iris"]]
        iris_x = np.mean([p.x * img_w for p in iris_pts])
        iris_y = np.mean([p.y * img_h for p in iris_pts])
        iris_center = (iris_x, iris_y)

        r_h_right = (landmarks[self._landmark_indices["r_h_right"]].x * img_w,
                      landmarks[self._landmark_indices["r_h_right"]].y * img_h)
        r_h_left = (landmarks[self._landmark_indices["r_h_left"]].x * img_w,
                    landmarks[self._landmark_indices["r_h_left"]].y * img_h)

        d_right = math.sqrt((iris_center[0] - r_h_right[0]) ** 2 + (iris_center[1] - r_h_right[1]) ** 2)
        d_total_h = math.sqrt((r_h_left[0] - r_h_right[0]) ** 2 + (r_h_left[1] - r_h_right[1]) ** 2)
        h_ratio = d_right / d_total_h if d_total_h > 0 else 0.0

        r_v_brown = (landmarks[self._landmark_indices["r_v_brown"]].x * img_w,
                     landmarks[self._landmark_indices["r_v_brown"]].y * img_h)
        r_v_cheek = (landmarks[self._landmark_indices["r_v_cheek"]].x * img_w,
                     landmarks[self._landmark_indices["r_v_cheek"]].y * img_h)
        d_brown = math.sqrt((iris_center[0] - r_v_brown[0]) ** 2 + (iris_center[1] - r_v_brown[1]) ** 2)
        d_total_v = math.sqrt((r_v_cheek[0] - r_v_brown[0]) ** 2 + (r_v_cheek[1] - r_v_brown[1]) ** 2)
        v_ratio = d_brown / d_total_v if d_total_v > 0 else 0.0

        import cv2
        face_2d = []
        face_3d = []
        for idx in self._landmark_indices["head_pose"]:
            lm = landmarks[idx]
            x, y = int(lm.x * img_w), int(lm.y * img_h)
            face_2d.append([x, y])
            face_3d.append([x, y, lm.z])
        face_2d = np.array(face_2d, dtype=np.float64)
        face_3d = np.array(face_3d, dtype=np.float64)
        focal = img_w
        cam_mat = np.array([[focal, 0, img_h / 2], [0, focal, img_w / 2], [0, 0, 1]])
        dist = np.zeros((4, 1), dtype=np.float64)
        ok, rot_vec, _ = cv2.solvePnP(face_3d, face_2d, cam_mat, dist)
        h_angle, v_angle = 0.0, 0.0
        if ok:
            rmat, _ = cv2.Rodrigues(rot_vec)
            angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
            h_angle = angles[1] * 360
            v_angle = angles[0] * 360

        vals = np.array([h_ratio, v_ratio, h_angle, v_angle], dtype=np.float32)
        self._last_landmark_vals = vals
        return vals

    def _cache_path(self, case_key):
        safe_key = case_key.replace("/", "_").replace("\\", "_").replace(":", "_")
        return os.path.join(self.cache_dir, f"{safe_key}_embeddings.npy")

    def extract_to_cache(self, video_path, case_key):
        if not video_path or not os.path.exists(video_path):
            self.log.emit(f"  Video not found for {case_key}, skipping.")
            return None

        cache_path = self._cache_path(case_key)
        if os.path.exists(cache_path):
            existing = np.load(cache_path)
            if existing.shape[1] != self.FEATURE_DIM + 1:
                self.log.emit(f"  Cache dimension mismatch ({existing.shape[1]} vs {self.FEATURE_DIM + 1}), regenerating...")
                os.remove(cache_path)
            else:
                self.log.emit(f"  Cache hit: {os.path.basename(cache_path)}")
                return cache_path

        import cv2
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            self.log.emit(f"  Cannot open video: {os.path.basename(video_path)}")
            return None

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_interval = max(1, int(fps / self.fps_sample))
        embeddings = []

        import mediapipe as mp
        from mediapipe.tasks.python import vision
        from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions
        mp_path = self._get_mediapipe_path()
        options = FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=mp_path),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
        )
        face_landmarker = FaceLandmarker.create_from_options(options)
        self._last_landmark_vals = None

        frame_idx = 0
        proc_start = time.time()
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % frame_interval != 0:
                frame_idx += 1
                continue

            timestamp_sec = frame_idx / fps
            frame = cv2.flip(frame, 1)

            lm_vals = self._extract_landmarks(frame, face_landmarker)
            emb = self._extract_frame_embeddings(frame)
            emb_flat = emb.flatten()
            combined = np.concatenate([emb_flat, lm_vals, [timestamp_sec]])
            embeddings.append(combined)

            if frame_idx % (frame_interval * 10) == 0:
                p = frame_idx / total_frames if total_frames > 0 else 0
                self.progress.emit(p)

            frame_idx += 1

        cap.release()
        face_landmarker.close()

        if not embeddings:
            self.log.emit(f"  No frames extracted from {os.path.basename(video_path)}")
            return None

        data = np.array(embeddings, dtype=np.float32)
        np.save(cache_path, data)
        elapsed = time.time() - proc_start
        self.log.emit(f"  Cached {len(embeddings)} frames in {elapsed:.1f}s → {os.path.basename(cache_path)}")
        return cache_path

    def load_from_cache(self, case_key):
        cache_path = self._cache_path(case_key)
        if os.path.exists(cache_path):
            data = np.load(cache_path)
            if data.shape[1] != self.FEATURE_DIM + 1:
                self.log.emit(f"  Cache dimension mismatch for {case_key}, removing invalid cache")
                os.remove(cache_path)
                return None
            return data
        return None

    def get_embeddings_for_interval(self, video_path, start_t, end_t, case_key):
        data = self.load_from_cache(case_key)
        if data is None:
            cache_path = self.extract_to_cache(video_path, case_key)
            if cache_path is None:
                return None
            data = np.load(cache_path)

        timestamps_col = data[:, -1]
        mask = (timestamps_col >= start_t) & (timestamps_col <= end_t)
        interval_data = data[mask]

        if len(interval_data) == 0:
            closest_idx = np.argmin(np.abs(timestamps_col - (start_t + end_t) / 2))
            window = max(1, int(2.0 * self.fps_sample))
            start_idx = max(0, closest_idx - window)
            end_idx = min(len(data), closest_idx + window)
            interval_data = data[start_idx:end_idx]

        return interval_data

    @staticmethod
    def find_video_for_mf4(mf4_path, camera_hint=None):
        base = mf4_path.replace(".mf4", "").replace(".MF4", "")
        base_no_tracking = base.replace("_tracking", "")
        patterns = []
        if camera_hint and camera_hint not in ("auto", "Auto"):
            cam = camera_hint.lstrip("_")
            patterns.extend([
                base_no_tracking + f"_{cam}.avi",
                base_no_tracking + f"_{cam}.AVI",
            ])
        patterns.extend([
            base + ".avi",
            base + ".AVI",
            base_no_tracking + ".avi",
            base_no_tracking + ".AVI",
            base_no_tracking + "_cam1.avi",
            base_no_tracking + "_cam1.AVI",
            base_no_tracking + "_cam2.avi",
            base_no_tracking + "_cam2.AVI",
        ])
        for p in patterns:
            if os.path.exists(p):
                return p
        mf4_base = os.path.splitext(os.path.basename(mf4_path))[0]
        base_stem = mf4_base.replace("_tracking", "")
        video_dirs = []
        parent = os.path.dirname(mf4_path)
        for _ in range(3):
            video_dirs.append(parent)
            parent = os.path.dirname(parent)
        for d in video_dirs:
            for root, _, files in os.walk(d):
                for f in files:
                    if not f.lower().endswith(".avi"):
                        continue
                    full = os.path.join(root, f)
                    f_stem = os.path.splitext(f)[0]
                    if f_stem == base_stem:
                        return full
                    if base_stem and base_stem in f_stem and "_tracking" not in f_stem:
                        if camera_hint and camera_hint not in ("auto", "Auto"):
                            cam = camera_hint.lstrip("_")
                            if cam in f_stem.lower():
                                return full
                        else:
                            return full
        return None


class VideoExtractionWorker(QThread):
    log = Signal(str)
    progress = Signal(float)
    finished_ok = Signal()
    failed = Signal(str)

    def __init__(self, extractor, tasks, parent=None):
        super().__init__(parent)
        self.extractor = extractor
        self.tasks = tasks

    def run(self):
        try:
            for i, (video_path, case_key) in enumerate(self.tasks):
                self.log.emit(f"Extracting [{i+1}/{len(self.tasks)}]: {os.path.basename(video_path)}")
                self.extractor.extract_to_cache(video_path, case_key)
                self.progress.emit((i + 1) / len(self.tasks))
            self.finished_ok.emit()
        except Exception as e:
            import traceback
            self.log.emit(f"Extraction error: {e}")
            traceback.print_exc()
            self.failed.emit(str(e))