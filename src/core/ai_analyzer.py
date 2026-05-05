"""
AI Analyzer for FusionStudio - Automated Event Detection.
v4.0: Integrated Machine Learning (RandomForest) with Heuristic Fallback.
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
        self.ml_engine = MLEngine() # Automatically loads models/gaze_model.pkl if exists

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

            # 1. Check if we have an ML model trained
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

            # 2. Fallback to Heuristic Logic (v3.0)
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
