import os
import json
import logging
import numpy as np
from asammdf import MDF

logger = logging.getLogger("fusionstudio.logic")

def calculate_ncap_metrics(file_path, signal_map, marks=None, thresholds=None):
    """
    Calculates T_gaze, T_event and Pass/Fail status for a given recording.
    
    Args:
        file_path: Path to the MF4 file.
        signal_map: Dict mapping 'gaze', 'event', 'audio' to MF4 channel names.
        marks: Dict of manual/automatic marks (from marks.json).
        thresholds: Dict with 't_gaze_limit', 't_event_limit'.
        
    Returns:
        Dict with metrics or error.
    """
    if thresholds is None:
        thresholds = {"t_gaze_limit": 2.0, "t_event_limit": 1.5}
        
    try:
        with MDF(file_path) as mdf:
            # 1. Determine the Start Reference (T0)
            # Priority: Manual Mark -> Audio Peak -> Signal Edge
            t0 = None
            
            # If we have marks for this file, use them
            if marks:
                # Logic to find the relevant mark for this file
                # In FusionStudio, marks are often keyed by the filename
                file_name = os.path.basename(file_path)
                if file_name in marks:
                    m = marks[file_name]
                    if isinstance(m, list) and len(m) > 0:
                        t0 = m[0] # Take first mark as T0
                    elif isinstance(m, (int, float)):
                        t0 = m
            
            # 2. If no mark, try to detect T0 from audio signal if mapped
            if t0 is None and 'audio' in signal_map:
                from .audio_analysis import obtain_peak_frequency
                # Simple peak detection in a default window
                # This is a bit slow for a full scan, but good for single file
                # ... (integration logic)
                pass

            if t0 is None:
                return {"error": "No Start Mark (T0) found for this file."}

            results = {
                "t0": t0,
                "t_gaze": None,
                "t_event": None,
                "pass_gaze": False,
                "pass_event": False,
                "overall_pass": False
            }

            # 3. Calculate T_gaze
            gaze_ch = signal_map.get('gaze')
            if gaze_ch and gaze_ch in mdf:
                sig = mdf.get(gaze_ch)
                samples = np.asarray(sig.samples, dtype=float)
                times = np.asarray(sig.timestamps, dtype=float)
                
                # Find first index where gaze is active (usually > 0.5) after T0
                mask = (times >= t0) & (samples > 0.5)
                if np.any(mask):
                    t_eye = times[mask][0]
                    results["t_gaze"] = float(t_eye - t0)
                    results["pass_gaze"] = results["t_gaze"] <= thresholds["t_gaze_limit"]

            # 4. Calculate T_event
            event_ch = signal_map.get('event')
            if event_ch and event_ch in mdf:
                sig = mdf.get(event_ch)
                samples = np.asarray(sig.samples, dtype=float)
                times = np.asarray(sig.timestamps, dtype=float)
                
                # Find first index where event is active after T0
                mask = (times >= t0) & (samples > 0.5)
                if np.any(mask):
                    t_ev = times[mask][0]
                    results["t_event"] = float(t_ev - t0)
                    results["pass_event"] = results["t_event"] <= thresholds["t_event_limit"]

            results["overall_pass"] = results["pass_gaze"] and results["pass_event"]
            return results

    except Exception as e:
        logger.error(f"Error calculating metrics for {file_path}: {e}")
        return {"error": str(e)}
