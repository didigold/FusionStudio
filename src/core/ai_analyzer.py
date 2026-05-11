"""
AI Analyzer for FusionStudio - Automated Event Detection.
v5.0: Multimodal (CNN+LSTM) + Legacy MLP + Heuristic Fallback.
"""
import os
import numpy as np
import cv2
from asammdf import MDF
from PySide6.QtCore import QThread, Signal, QObject
from src.core.ml_engine import MLEngine


class AIAnalyzerSignals(QObject):
    log = Signal(str)
    progress = Signal(float)
    finished = Signal(list)
    error = Signal(str)


class AIAnalyzer:
    def __init__(self, signals_handler):
        self.signals = signals_handler
        self.ml_engine = MLEngine()

    def analyze(self, tracking_mf4, video_path):
        try:
            self.signals.log.emit("Starting AI Analysis pipeline...")

            if not os.path.exists(tracking_mf4):
                raise Exception("Tracking file missing.")

            mdf = MDF(tracking_mf4)
            engine = "OWL" if "Head_H_Angle" in mdf else "LIZ"

            if engine == "OWL":
                h_sig, v_sig = mdf.get("Head_H_Angle"), mdf.get("Head_V_Angle")
            else:
                h_sig, v_sig = mdf.get("H_Ratio"), mdf.get("V_Ratio")

            t, h, v = h_sig.timestamps, h_sig.samples, v_sig.samples

            # 1. Check if we have a multimodal model
            multimodal_result = self._try_multimodal(t, h, v, tracking_mf4, video_path)
            if multimodal_result is not None:
                return multimodal_result

            # 2. Check if we have a legacy ML model
            if self.ml_engine.model is not None:
                self.signals.log.emit("AI Brain (ML) is active. Using neural inference...")
                self.signals.progress.emit(0.3)
                ml_markers = self.ml_engine.predict_intervals(t, h, v)

                if ml_markers:
                    self.signals.log.emit(f"ML Brain detected {len(ml_markers)//2} distraction intervals.")
                    self.signals.progress.emit(1.0)
                    return ml_markers
                else:
                    self.signals.log.emit("ML Brain found no events. Falling back to heuristic v3.0...")

            # 3. Fallback to Heuristic Logic (v3.0)
            self.signals.progress.emit(0.2)
            event_windows = self._find_event_windows(t, h, v)

            if not event_windows:
                self.signals.log.emit("No clear events found via heuristics.")
                return []

            self.signals.log.emit(f"Heuristics detected {len(event_windows)} discrete pulses.")

            final_markers = []
            for i, (s_idx, e_idx) in enumerate(event_windows):
                m_start = self._find_fixation_point(t, h, v, s_idx, direction="forward")
                m_end = self._find_fixation_point(t, h, v, e_idx, direction="backward")
                final_markers.extend([m_start, m_end])
                self.signals.progress.emit(0.2 + (0.8 * (i + 1) / len(event_windows)))

            return sorted(list(set(final_markers)))

        except Exception as e:
            self.signals.error.emit(str(e))
            return []

    def _try_multimodal(self, timestamps, h_vals, v_vals, mf4_path, video_path):
        try:
            from src.core.multimodal_engine import MultimodalTrainer
            from src.core.video_feature_extractor import VideoFeatureExtractor

            trainer = MultimodalTrainer()
            model_path = trainer.find_latest_model()
            if model_path is None:
                return None

            if not model_path.endswith(".pt"):
                return None

            if not trainer.load_model(model_path):
                return None

            if not trainer.metadata.get("architecture") == "multimodal":
                return None

            if not video_path or not os.path.exists(video_path):
                self.signals.log.emit("Multimodal model requires video. Falling back...")
                return None

            self.signals.log.emit("Multimodal Brain active. Running joint inference...")
            self.signals.progress.emit(0.1)

            extractor = VideoFeatureExtractor()
            import pandas as pd
            df = pd.DataFrame({
                'h': h_vals, 'v': v_vals,
                'h_d': np.gradient(h_vals), 'v_d': np.gradient(v_vals),
                'speed': np.sqrt(np.gradient(h_vals)**2 + np.gradient(v_vals)**2),
            })
            fs = 1.0 / (timestamps[1] - timestamps[0]) if len(timestamps) > 1 else 30.0
            win = int(0.5 * fs)
            df['h_var'] = df['h'].rolling(window=win).var().fillna(0)
            df['v_var'] = df['v'].rolling(window=win).var().fillna(0)
            signal_seq = df[['h', 'v', 'h_d', 'v_d', 'speed', 'h_var', 'v_var']].values.astype(np.float32)

            case_key = os.path.splitext(os.path.basename(mf4_path))[0]
            total_duration = timestamps[-1] - timestamps[0] if len(timestamps) > 1 else 10.0
            video_embeddings = extractor.get_embeddings_for_interval(
                video_path, timestamps[0], timestamps[-1], case_key
            )
            if video_embeddings is None:
                self.signals.log.emit("Could not extract video features. Falling back...")
                return None

            self.signals.progress.emit(0.5)

            results = trainer.predict_intervals(signal_seq, video_embeddings)

            if results:
                self.signals.log.emit(f"Multimodal Brain detected {len(results)//2} intervals.")
                self.signals.progress.emit(1.0)
                return results
            else:
                self.signals.log.emit("Multimodal Brain found no events. Falling back...")
                return None

        except Exception as e:
            self.signals.log.emit(f"Multimodal inference error: {e}")
            return None

    def _find_event_windows(self, t, h, v):
        fs = 1.0 / (t[1] - t[0])
        base_n = int(1.0 * fs)
        h_base, v_base = np.mean(h[:base_n]), np.mean(v[:base_n])
        h_std, v_std = np.std(h[:base_n]) + 0.2, np.std(v[:base_n]) + 0.2
        z = np.sqrt(((h - h_base)/h_std)**2 + ((v - v_base)/v_std)**2)
        is_active = z > 3.5
        from scipy.ndimage import binary_closing, binary_opening
        is_active = binary_opening(is_active, structure=np.ones(3)) 
        is_active = binary_closing(is_active, structure=np.ones(5))
        diff = np.diff(is_active.astype(int))
        starts = np.where(diff == 1)[0]
        ends = np.where(diff == -1)[0]
        if is_active[0]: starts = np.insert(starts, 0, 0)
        if is_active[-1]: ends = np.append(ends, len(is_active)-1)
        events = []
        for s, e in zip(starts, ends):
            if t[e] - t[s] > 0.2:
                events.append((s, e))
        return events

    def _find_fixation_point(self, t, h, v, pivot, direction="forward"):
        fs = 1.0 / (t[1] - t[0])
        w_size = int(0.5 * fs)
        if direction == "forward":
            search_indices = np.arange(pivot, min(len(t), pivot + w_size))
        else:
            search_indices = np.arange(max(0, pivot - w_size), pivot)
        if len(search_indices) < 2: return t[pivot]
        h_d = np.abs(np.gradient(h[search_indices]))
        v_d = np.abs(np.gradient(v[search_indices]))
        speed = h_d + v_d
        if direction == "forward":
            peak_idx = np.argmax(speed)
            peak_val = speed[peak_idx]
            tail = speed[peak_idx:]
            bend = np.where(tail < (peak_val * 0.15))[0]
            final_idx = search_indices[peak_idx + bend[0]] if len(bend) > 0 else search_indices[peak_idx]
        else:
            rev_speed = speed[::-1]
            peak_idx = np.argmax(rev_speed)
            peak_val = rev_speed[peak_idx]
            tail = rev_speed[peak_idx:]
            bend = np.where(tail < (peak_val * 0.15))[0]
            if len(bend) > 0:
                rel_idx = len(speed) - 1 - (peak_idx + bend[0])
                final_idx = search_indices[rel_idx]
            else:
                final_idx = search_indices[-1]
        return t[final_idx]

class AIWorker(QThread):
    def __init__(self, tracking_mf4, video_path):
        super().__init__()
        self.tracking_mf4 = tracking_mf4
        self.video_path = video_path
        self.signals = AIAnalyzerSignals()
        self.analyzer = AIAnalyzer(self.signals)

    def run(self):
        try:
            results = self.analyzer.analyze(self.tracking_mf4, self.video_path)
            self.signals.finished.emit(results)
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.signals.error.emit(str(e))
