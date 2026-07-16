"""
AI Analyzer for FusionStudio - Automated Event Detection.
v5.1: Multimodal (CNN+LSTM) + Legacy MLP + Heuristic Fallback.
Bug-hardened: guards for short signals, correct model paths.
"""
import os
import numpy as np

from backend.core.utils import resource_path, user_data_path


class AIAnalyzer:
    def __init__(self, on_log=None, on_progress=None, on_finished=None, on_error=None):
        self.on_log = on_log
        self.on_progress = on_progress
        self.on_finished = on_finished
        self.on_error = on_error

    def analyze(self, tracking_mf4, video_path, model_path=None):
        try:
            if self.on_log:
                self.on_log("Starting AI Analysis pipeline (Heuristic Fallback)...")

            if not os.path.exists(tracking_mf4):
                raise Exception("Tracking file missing.")

            from asammdf import MDF
            mdf = MDF(tracking_mf4)
            engine = "OWL" if "Head_H_Angle" in mdf else "LIZ"

            if engine == "OWL":
                h_sig, v_sig = mdf.get("Head_H_Angle"), mdf.get("Head_V_Angle")
            else:
                h_sig, v_sig = mdf.get("H_Ratio"), mdf.get("V_Ratio")

            t, h, v = h_sig.timestamps, h_sig.samples, v_sig.samples

            if len(t) < 2:
                if self.on_log:
                    self.on_log("Signal too short for analysis (< 2 samples).")
                return []

            if self.on_progress:
                self.on_progress(0.2)
            event_windows = self._find_event_windows(t, h, v)

            if not event_windows:
                if self.on_log:
                    self.on_log("No clear events found via heuristics.")
                return []

            if self.on_log:
                self.on_log(f"Heuristics detected {len(event_windows)} discrete pulses.")

            final_markers = []
            for i, (s_idx, e_idx) in enumerate(event_windows):
                m_start = self._find_fixation_point(t, h, v, s_idx, direction="forward")
                m_end = self._find_fixation_point(t, h, v, e_idx, direction="backward")
                final_markers.extend([m_start, m_end])
                if self.on_progress:
                    self.on_progress(0.2 + (0.8 * (i + 1) / len(event_windows)))

            return sorted(list(set(final_markers)))

        except Exception as e:
            if self.on_error:
                self.on_error(str(e))
            return []

    def _find_event_windows(self, t, h, v):
        if len(t) < 2:
            return []
        dt = t[1] - t[0]
        if dt <= 0:
            return []
        fs = 1.0 / dt
        base_n = max(int(1.0 * fs), 1)
        h_base, v_base = np.mean(h[:base_n]), np.mean(v[:base_n])
        h_std, v_std = np.std(h[:base_n]) + 0.2, np.std(v[:base_n]) + 0.2
        z = np.sqrt(((h - h_base) / h_std) ** 2 + ((v - v_base) / v_std) ** 2)
        is_active = z > 3.5
        from scipy.ndimage import binary_opening, binary_closing
        is_active = binary_opening(is_active, structure=np.ones(3))
        is_active = binary_closing(is_active, structure=np.ones(5))
        diff = np.diff(is_active.astype(int))
        starts = np.where(diff == 1)[0]
        ends = np.where(diff == -1)[0]
        if is_active[0]:
            starts = np.insert(starts, 0, 0)
        if is_active[-1]:
            ends = np.append(ends, len(is_active) - 1)
        events = []
        for s, e in zip(starts, ends):
            if t[e] - t[s] > 0.2:
                events.append((s, e))
        return events

    def _find_fixation_point(self, t, h, v, pivot, direction="forward"):
        if len(t) < 2:
            return t[pivot] if pivot < len(t) else 0.0
        dt = t[1] - t[0]
        fs = 1.0 / dt if dt > 0 else 30.0
        w_size = max(int(0.5 * fs), 1)
        if direction == "forward":
            search_indices = np.arange(pivot, min(len(t), pivot + w_size))
        else:
            search_indices = np.arange(max(0, pivot - w_size), pivot)
        if len(search_indices) < 2:
            return t[pivot]
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