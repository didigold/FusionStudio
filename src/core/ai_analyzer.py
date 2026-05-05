"""
AI Analyzer for FusionStudio - Automated Event Detection.
v3.0: High-fidelity signal tracking, precise pulse segmentation, and low-latency fixation detection.
"""
import os
import numpy as np
import cv2
from asammdf import MDF
from PySide6.QtCore import QThread, Signal, QObject

class AIAnalyzerSignals(QObject):
    log = Signal(str)
    progress = Signal(float)
    finished = Signal(list)
    error = Signal(str)

class AIAnalyzer:
    def __init__(self, signals_handler):
        self.signals = signals_handler

    def analyze(self, tracking_mf4, video_path):
        try:
            self.signals.log.emit("Starting High-Fidelity Signal Analysis...")
            
            if not os.path.exists(tracking_mf4):
                raise Exception("Tracking file missing.")
            
            mdf = MDF(tracking_mf4)
            engine = "OWL" if "Head_H_Angle" in mdf else "LIZ"
            
            if engine == "OWL":
                h_sig, v_sig = mdf.get("Head_H_Angle"), mdf.get("Head_V_Angle")
            else:
                h_sig, v_sig = mdf.get("H_Ratio"), mdf.get("V_Ratio")

            t, h, v = h_sig.timestamps, h_sig.samples, v_sig.samples

            # 1. Precise Segmentation
            self.signals.progress.emit(0.2)
            event_windows = self._find_event_windows(t, h, v)
            
            if not event_windows:
                self.signals.log.emit("No clear events found.")
                return []

            self.signals.log.emit(f"Detected {len(event_windows)} discrete distraction pulses.")
            
            final_markers = []
            for i, (s_idx, e_idx) in enumerate(event_windows):
                # A. Start Fixation: Where the 'climb' ends
                m_start = self._find_fixation_point(t, h, v, s_idx, direction="forward")
                
                # B. End Departure: Where the 'drop' begins
                m_end = self._find_fixation_point(t, h, v, e_idx, direction="backward")
                
                final_markers.extend([m_start, m_end])
                self.signals.progress.emit(0.2 + (0.8 * (i + 1) / len(event_windows)))

            return sorted(list(set(final_markers)))

        except Exception as e:
            self.signals.error.emit(str(e))
            return []

    def _find_event_windows(self, t, h, v):
        """
        Segment pulses without merging them.
        """
        # Establish baseline from first 1s
        fs = 1.0 / (t[1] - t[0])
        base_n = int(1.0 * fs)
        h_base, v_base = np.mean(h[:base_n]), np.mean(v[:base_n])
        h_std, v_std = np.std(h[:base_n]) + 0.2, np.std(v[:base_n]) + 0.2
        
        # Combined Z-score
        z = np.sqrt(((h - h_base)/h_std)**2 + ((v - v_base)/v_std)**2)
        
        # Pulse detection: Threshold is lower but more selective
        is_active = z > 3.5
        
        # Minimal morphological cleaning to preserve gaps
        from scipy.ndimage import binary_closing, binary_opening
        is_active = binary_opening(is_active, structure=np.ones(3)) 
        is_active = binary_closing(is_active, structure=np.ones(5)) # Tight closing
        
        diff = np.diff(is_active.astype(int))
        starts = np.where(diff == 1)[0]
        ends = np.where(diff == -1)[0]
        
        if is_active[0]: starts = np.insert(starts, 0, 0)
        if is_active[-1]: ends = np.append(ends, len(is_active)-1)
        
        events = []
        for s, e in zip(starts, ends):
            if t[e] - t[s] > 0.2: # 200ms minimum pulse
                events.append((s, e))
        return events

    def _find_fixation_point(self, t, h, v, pivot, direction="forward"):
        """
        Finds the exact corner of the signal where the shift ends (forward) or return starts (backward).
        """
        fs = 1.0 / (t[1] - t[0])
        # Look 0.5s around the pivot
        w_size = int(0.5 * fs)
        
        if direction == "forward":
            # Finding start of fixation (after rising edge)
            search_indices = np.arange(pivot, min(len(t), pivot + w_size))
        else:
            # Finding start of return (at beginning of falling edge)
            search_indices = np.arange(max(0, pivot - w_size), pivot)

        if len(search_indices) < 2: return t[pivot]
        
        # Calculate signal 'speed' (magnitude of derivative)
        h_d = np.abs(np.gradient(h[search_indices]))
        v_d = np.abs(np.gradient(v[search_indices]))
        speed = h_d + v_d
        
        if direction == "forward":
            # The 'fixation' is where the speed drops after the peak
            # We find the peak speed in this window, then find where it drops to 10% of peak
            peak_idx = np.argmax(speed)
            peak_val = speed[peak_idx]
            
            tail = speed[peak_idx:]
            # First index where speed < 15% of peak (the bend)
            bend = np.where(tail < (peak_val * 0.15))[0]
            if len(bend) > 0:
                final_idx = search_indices[peak_idx + bend[0]]
            else:
                final_idx = search_indices[peak_idx]
        else:
            # The 'departure' is where the speed starts increasing before the drop
            # We reverse the search to find the onset of movement
            rev_speed = speed[::-1]
            peak_idx = np.argmax(rev_speed)
            peak_val = rev_speed[peak_idx]
            
            tail = rev_speed[peak_idx:]
            bend = np.where(tail < (peak_val * 0.15))[0]
            if len(bend) > 0:
                # relative from end
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
