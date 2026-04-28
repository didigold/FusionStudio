"""
ChronosWorker - Face tracking using MediaPipe Tasks API (0.10.x)
Supports OWL (head pose) and LIZ/EYE (iris ratios) algorithms.
TURBO MODE: Processes at max CPU speed, display throttled.
"""
import time
import math
import os
import re
from PySide6.QtCore import QThread, Signal as PySignal
from PySide6.QtGui import QImage

from src.core.utils import resource_path

# --- Landmark indices ---
RIGHT_IRIS = [474, 475, 476, 477]
R_H_LEFT = 362
R_H_RIGHT = 263
R_V_EYE_BROWN = 295
R_V_POMULO = 349
HEAD_POSE_LANDMARKS = [33, 263, 1, 61, 291, 199]


def euclidean_distance(p1, p2):
    return math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)


def iris_position(iris_center, right_pt, left_pt):
    d_right = euclidean_distance(iris_center, right_pt)
    total = euclidean_distance(right_pt, left_pt)
    return d_right / total if total > 0 else 0.0


def iris_v_position(iris_center, top_pt, bot_pt):
    d_bot = euclidean_distance(iris_center, bot_pt)
    total = euclidean_distance(bot_pt, top_pt)
    return d_bot / total if total > 0 else 0.0


class ChronosWorker(QThread):
    """Worker thread for face tracking - TURBO MODE."""
    new_frame = PySignal(QImage)
    log = PySignal(str)
    progress = PySignal(int)
    finished_task = PySignal(str)  # Emits file path when done
    all_finished = PySignal()
    error = PySignal(str)
    
    # NEW: Real-time stats signal
    stats = PySignal(dict)  # {'engine', 'file', 'frame', 'total_frames', 'h_val', 'v_val', 'fps'}

    FRAME_SKIP = 5  # Emit every Nth frame to UI (increased for speed)

    def __init__(self, task_queue, camera_id):
        super().__init__()
        self.task_queue = task_queue
        self.camera_id = camera_id
        self.is_running = True
        self.model_path = resource_path("assets/face_landmarker.task")

    def stop(self):
        self.is_running = False

    def run(self):
        total_tasks = len(self.task_queue)
        self.log.emit(f"ChronosWorker TURBO started. {total_tasks} task(s).")
        
        if not os.path.exists(self.model_path):
            self.error.emit(f"Model not found: {self.model_path}")
            self.all_finished.emit()
            return
        
        for i, task in enumerate(self.task_queue):
            if not self.is_running:
                self.log.emit("ChronosWorker stopped.")
                break
                
            fpath = task['file_path']
            logic = task['logic']
            
            self.log.emit(f"[{i+1}/{total_tasks}] {os.path.basename(fpath)} | {logic}")
            
            try:
                if logic == 'OWL':
                    completed = self._process_owl(fpath)
                elif logic in ('LIZ', 'EYE'):
                    completed = self._process_liz_eye(fpath, logic)
                else:
                    self.log.emit(f"Unknown logic: {logic}")
                    continue

                if not completed:
                    # Stop requested or processing aborted; do not save or continue
                    break

                self.progress.emit(int(((i + 1) / total_tasks) * 100))
                self.finished_task.emit(fpath)  # Emit full path for tree update

            except Exception as e:
                import traceback
                self.error.emit(f"{os.path.basename(fpath)}: {e}")
                traceback.print_exc()

        self.all_finished.emit()

    def _process_owl(self, file_path):
        """Head pose estimation - TURBO (no FPS throttle)."""
        import cv2 as cv
        import numpy as np
        if not hasattr(np, 'bool'): np.bool = bool
        if not hasattr(np, 'float'): np.float = float
        if not hasattr(np, 'int'): np.int = int
        import mediapipe as mp
        from mediapipe.tasks.python import vision
        from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions

        cap = cv.VideoCapture(file_path)
        if not cap.isOpened():
            raise Exception(f"Cannot open: {file_path}")
        
        total_frames = int(cap.get(cv.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv.CAP_PROP_FPS) or 30.0
        
        H_angles, V_angles, timestamps = [], [], []
        last_x, last_y = 0.0, 0.0
        frame_idx = 0
        frame_interval = 1.0 / fps
        proc_start = time.time()
        
        self.log.emit(f"  Frames: {total_frames} | FPS: {fps:.1f}")
        
        options = FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=self.model_path),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False
        )
        
        with FaceLandmarker.create_from_options(options) as landmarker:
            while cap.isOpened() and self.is_running:
                ret, frame = cap.read()
                if not ret:
                    break
                
                frame_idx += 1
                curr_t = frame_idx * frame_interval
                
                frame = cv.flip(frame, 1)
                frame_rgb = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
                
                result = landmarker.detect(mp_image)
                img_h, img_w = frame.shape[:2]
                
                if result.face_landmarks:
                    landmarks = result.face_landmarks[0]
                    
                    face_2d, face_3d = [], []
                    for idx in HEAD_POSE_LANDMARKS:
                        lm = landmarks[idx]
                        x, y = int(lm.x * img_w), int(lm.y * img_h)
                        face_2d.append([x, y])
                        face_3d.append([x, y, lm.z])
                    
                    face_2d = np.array(face_2d, dtype=np.float64)
                    face_3d = np.array(face_3d, dtype=np.float64)
                    
                    focal = img_w
                    cam_mat = np.array([[focal, 0, img_h/2], [0, focal, img_w/2], [0, 0, 1]])
                    dist = np.zeros((4, 1), dtype=np.float64)
                    
                    ok, rot_vec, _ = cv.solvePnP(face_3d, face_2d, cam_mat, dist)
                    if ok:
                        rmat, _ = cv.Rodrigues(rot_vec)
                        angles, _, _, _, _, _ = cv.RQDecomp3x3(rmat)
                        last_x = angles[0] * 360
                        last_y = angles[1] * 360
                    
                    self._draw_landmarks(frame, landmarks, img_w, img_h)
                
                H_angles.append(last_y)
                V_angles.append(last_x)
                timestamps.append(curr_t)
                
                # Throttled display + stats
                if frame_idx % self.FRAME_SKIP == 0:
                    self._emit_frame(frame)
                    elapsed = time.time() - proc_start
                    proc_fps = frame_idx / elapsed if elapsed > 0 else 0
                    self.stats.emit({
                        'engine': 'OWL',
                        'file': os.path.basename(file_path),
                        'frame': frame_idx,
                        'total_frames': total_frames,
                        'h_val': last_y,
                        'v_val': last_x,
                        'fps': proc_fps
                    })
        
        cap.release()
        if not self.is_running:
            self.log.emit("  Stop requested. Skipping save for current video.")
            return False
        elapsed = time.time() - proc_start
        self.log.emit(f"  Processed in {elapsed:.1f}s ({frame_idx/elapsed:.1f} fps)")
        self._save_mf4_owl(file_path, H_angles, V_angles, timestamps)
        return True

    def _process_liz_eye(self, file_path, logic):
        """Iris tracking - TURBO (no FPS throttle)."""
        import cv2 as cv
        import numpy as np
        if not hasattr(np, 'bool'): np.bool = bool
        if not hasattr(np, 'float'): np.float = float
        if not hasattr(np, 'int'): np.int = int
        import mediapipe as mp
        from mediapipe.tasks.python import vision
        from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions

        cap = cv.VideoCapture(file_path)
        if not cap.isOpened():
            raise Exception(f"Cannot open: {file_path}")
        
        total_frames = int(cap.get(cv.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv.CAP_PROP_FPS) or 30.0
        
        H_ratios, V_ratios, timestamps = [], [], []
        last_H, last_V = 0.0, 0.0
        frame_idx = 0
        frame_interval = 1.0 / fps
        proc_start = time.time()
        
        engine_name = "LIZARD" if logic == "LIZ" else "EYE"
        self.log.emit(f"  Frames: {total_frames} | FPS: {fps:.1f}")
        
        options = FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=self.model_path),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False
        )
        
        with FaceLandmarker.create_from_options(options) as landmarker:
            while cap.isOpened() and self.is_running:
                ret, frame = cap.read()
                if not ret:
                    break
                
                frame_idx += 1
                curr_t = frame_idx * frame_interval
                
                frame = cv.flip(frame, 1)
                frame_rgb = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
                
                result = landmarker.detect(mp_image)
                img_h, img_w = frame.shape[:2]
                
                if result.face_landmarks:
                    landmarks = result.face_landmarks[0]
                    
                    iris_pts = [landmarks[i] for i in RIGHT_IRIS]
                    iris_x = np.mean([p.x for p in iris_pts]) * img_w
                    iris_y = np.mean([p.y for p in iris_pts]) * img_h
                    iris_center = (iris_x, iris_y)
                    
                    right_pt = (landmarks[R_H_RIGHT].x * img_w, landmarks[R_H_RIGHT].y * img_h)
                    left_pt = (landmarks[R_H_LEFT].x * img_w, landmarks[R_H_LEFT].y * img_h)
                    brown_pt = (landmarks[R_V_EYE_BROWN].x * img_w, landmarks[R_V_EYE_BROWN].y * img_h)
                    pomulo_pt = (landmarks[R_V_POMULO].x * img_w, landmarks[R_V_POMULO].y * img_h)
                    
                    last_H = iris_position(iris_center, right_pt, left_pt)
                    last_V = iris_v_position(iris_center, brown_pt, pomulo_pt)
                    
                    cv.circle(frame, (int(iris_x), int(iris_y)), 3, (0, 0, 255), -1)
                    cv.circle(frame, (int(right_pt[0]), int(right_pt[1])), 2, (255, 255, 0), -1)
                    cv.circle(frame, (int(left_pt[0]), int(left_pt[1])), 2, (0, 255, 255), -1)
                
                H_ratios.append(last_H)
                V_ratios.append(last_V)
                timestamps.append(curr_t)
                
                if frame_idx % self.FRAME_SKIP == 0:
                    self._emit_frame(frame)
                    elapsed = time.time() - proc_start
                    proc_fps = frame_idx / elapsed if elapsed > 0 else 0
                    self.stats.emit({
                        'engine': engine_name,
                        'file': os.path.basename(file_path),
                        'frame': frame_idx,
                        'total_frames': total_frames,
                        'h_val': last_H,
                        'v_val': last_V,
                        'fps': proc_fps
                    })
        
        cap.release()
        if not self.is_running:
            self.log.emit("  Stop requested. Skipping save for current video.")
            return False
        elapsed = time.time() - proc_start
        self.log.emit(f"  Processed in {elapsed:.1f}s ({frame_idx/elapsed:.1f} fps)")
        self._save_mf4_liz(file_path, H_ratios, V_ratios, timestamps)
        return True

    def _draw_landmarks(self, frame, landmarks, img_w, img_h):
        import cv2 as cv
        for lm in landmarks:
            x, y = int(lm.x * img_w), int(lm.y * img_h)
            cv.circle(frame, (x, y), 1, (0, 255, 0), -1)

    def _emit_frame(self, frame):
        try:
            h, w, ch = frame.shape
            bpl = ch * w
            qimg = QImage(frame.data, w, h, bpl, QImage.Format_BGR888).copy()
            self.new_frame.emit(qimg)
        except Exception as e:
            print(f"emit_frame error: {e}")

    def _finalize_tracking_file(self, orig_path, tracking_path):
        """Transfers metadata from original to new file and deletes original."""
        try:
            # 1. Capture original metadata
            orig_stat = os.stat(orig_path)
            orig_ctime = orig_stat.st_ctime
            orig_mtime = orig_stat.st_mtime
            orig_atime = orig_stat.st_atime
            
            # 2. Transfer metadata to new file (atime and mtime)
            os.utime(tracking_path, (orig_atime, orig_mtime))
            
            # Transfer creation time on Windows
            try:
                import ctypes
                import ctypes.wintypes
                
                def unix_to_filetime(seconds):
                    return int((seconds + 11644473600.0) * 10000000)
                
                ctime = unix_to_filetime(orig_ctime)
                creation_time = ctypes.wintypes.FILETIME(ctime & 0xFFFFFFFF, ctime >> 32)
                
                GENERIC_WRITE = 0x40000000
                FILE_SHARE_WRITE = 0x00000002
                OPEN_EXISTING = 3
                FILE_ATTRIBUTE_NORMAL = 0x80
                
                handle = ctypes.windll.kernel32.CreateFileW(
                    tracking_path, GENERIC_WRITE, FILE_SHARE_WRITE, None, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, None
                )
                if handle != -1: 
                    ctypes.windll.kernel32.SetFileTime(handle, ctypes.byref(creation_time), None, None)
                    ctypes.windll.kernel32.CloseHandle(handle)
            except Exception as e:
                self.log.emit(f"  ⚠ Could not copy creation time: {e}")
                
            # 3. Delete original file
            try:
                os.remove(orig_path)
            except Exception as e:
                self.log.emit(f"  ⚠ Could not delete original file ({os.path.basename(orig_path)}): {e}")
                
        except Exception as e:
            self.log.emit(f"  ⚠ Metadata transfer error: {e}")

    def _save_mf4_owl(self, src_path, h_ang, v_ang, times):
        from asammdf import MDF, Signal
        import numpy as np
        if not hasattr(np, 'bool'): np.bool = bool
        if not hasattr(np, 'float'): np.float = float
        if not hasattr(np, 'int'): np.int = int
        mf4_path = self._get_mf4_path(src_path)
        if not os.path.exists(mf4_path):
            self.log.emit(f"  ⚠ MF4 not found: {os.path.basename(mf4_path)}")
            return
        
        out = mf4_path.replace(".mf4", "_tracking.mf4")
        try:
            mdf = MDF(mf4_path)
            mdf.append([
                Signal(np.array(h_ang), np.array(times), name='Head_H_Angle', unit='deg'),
                Signal(np.array(v_ang), np.array(times), name='Head_V_Angle', unit='deg')
            ])
            mdf.save(out, overwrite=True)
            self._finalize_tracking_file(mf4_path, out)
            self.log.emit(f"  ✓ Saved: {os.path.basename(out)}")
        except Exception as e:
            self.error.emit(f"Save error: {e}")

    def _save_mf4_liz(self, src_path, h_rat, v_rat, times):
        from asammdf import MDF, Signal
        import numpy as np
        if not hasattr(np, 'bool'): np.bool = bool
        if not hasattr(np, 'float'): np.float = float
        if not hasattr(np, 'int'): np.int = int
        mf4_path = self._get_mf4_path(src_path)
        if not os.path.exists(mf4_path):
            self.log.emit(f"  ⚠ MF4 not found: {os.path.basename(mf4_path)}")
            return
        
        out = mf4_path.replace(".mf4", "_tracking.mf4")
        try:
            mdf = MDF(mf4_path)
            mdf.append([
                Signal(np.array(h_rat), np.array(times), name='H_Ratio', unit='%'),
                Signal(np.array(v_rat), np.array(times), name='V_Ratio', unit='%')
            ])
            mdf.save(out, overwrite=True)
            self._finalize_tracking_file(mf4_path, out)
            self.log.emit(f"  ✓ Saved: {os.path.basename(out)}")
        except Exception as e:
            self.error.emit(f"Save error: {e}")

    def _get_mf4_path(self, video_path):
        base = video_path.replace(".avi", "")
        base = re.sub(r'_cam\d+$', '', base)
        return base + ".mf4"
