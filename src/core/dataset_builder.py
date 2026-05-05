"""
Dataset Builder for FusionStudio ML Training.
Orchestrates the conversion of manual marks and signal data into training datasets.
"""
import os
import json
import pandas as pd
import numpy as np
from asammdf import MDF
from PySide6.QtCore import QObject, Signal

class DatasetBuilder(QObject):
    progress = Signal(float)
    log = Signal(str)
    finished = Signal(str) # Path to generated CSV
    error = Signal(str)

    def __init__(self):
        super().__init__()

    def build_from_folders(self, root_folders, output_csv):
        """
        root_folders: List of project paths containing marks.json and _tracking.mf4 files.
        """
        all_data = []
        
        try:
            total_folders = len(root_folders)
            for f_idx, folder in enumerate(root_folders):
                self.log.emit(f"Scanning folder: {os.path.basename(folder)}")
                marks_path = os.path.join(folder, "marks.json")
                if not os.path.exists(marks_path):
                    self.log.emit(f"Skipping {folder}: No marks.json found.")
                    continue
                
                with open(marks_path, "r", encoding="utf-8") as f:
                    marks_data = json.load(f)
                
                total_cases = len(marks_data)
                for c_idx, (case_key, timestamps) in enumerate(marks_data.items()):
                    # case_key is usually "Subject/Case"
                    # We need to find the _tracking.mf4. 
                    # Structure usually: root/Subject/Case_tracking.mf4
                    # or root/Subject/Case/Case_tracking.mf4
                    
                    self.log.emit(f"  Processing case: {case_key}")
                    mf4_path = self._resolve_mf4_path(folder, case_key)
                    
                    if not mf4_path or not os.path.exists(mf4_path):
                        self.log.emit(f"    Warning: Could not find MF4 for {case_key}")
                        continue
                        
                    case_df = self._extract_features_and_labels(mf4_path, timestamps)
                    if case_df is not None:
                        all_data.append(case_df)
                    
                    # Update progress
                    p = (f_idx / total_folders) + ((c_idx / total_cases) / total_folders)
                    self.progress.emit(p)

            if not all_data:
                raise Exception("No valid data points collected.")
                
            final_df = pd.concat(all_data, ignore_index=True)
            
            # Save CSV
            os.makedirs(os.path.dirname(output_csv), exist_ok=True)
            final_df.to_csv(output_csv, index=False)
            self.log.emit(f"Dataset created successfully: {len(final_df)} samples.")
            self.finished.emit(output_csv)
            return True
            
        except Exception as e:
            import traceback
            self.log.emit(f"Error building dataset: {str(e)}")
            traceback.print_exc()
            self.error.emit(str(e))
            return False

    def _resolve_mf4_path(self, root, case_key):
        """
        Attempts to locate the tracking file based on the key.
        """
        # 1. Try direct relative to root (where marks.json is)
        direct_root_path = os.path.normpath(os.path.join(root, case_key))
        if os.path.exists(direct_root_path):
            return direct_root_path
            
        # 2. Try treating case_key as a direct relative path from root's parent
        parent_dir = os.path.dirname(root)
        direct_parent_path = os.path.normpath(os.path.join(parent_dir, case_key))
        if os.path.exists(direct_parent_path):
            return direct_parent_path
            
        # 3. Fallback logic for older formats
        parts = case_key.split('/')
        if len(parts) >= 2:
            subject, case = parts[0], parts[1]
            patterns = [
                os.path.join(root, subject, f"{case}_tracking.mf4"),
                os.path.join(root, subject, case, f"{case}_tracking.mf4"),
                os.path.join(root, f"{case}_tracking.mf4")
            ]
            for p in patterns:
                if os.path.exists(p): return p
                
        return None

    def _extract_features_and_labels(self, mf4_path, ground_truth_ts):
        """
        Extracts signals and creates binary labels.
        """
        try:
            mdf = MDF(mf4_path)
            engine = "OWL" if "Head_H_Angle" in mdf else "LIZ"
            
            if engine == "OWL":
                h_sig = mdf.get("Head_H_Angle")
                v_sig = mdf.get("Head_V_Angle")
            else:
                h_sig = mdf.get("H_Ratio")
                v_sig = mdf.get("V_Ratio")
                
            t = h_sig.timestamps
            h = h_sig.samples
            v = v_sig.samples
            
            df = pd.DataFrame({
                't': t,
                'h': h,
                'v': v,
                'label': 0
            })
            
            # Feature Engineering: Derivatives
            df['h_d'] = df['h'].diff().fillna(0)
            df['v_d'] = df['v'].diff().fillna(0)
            df['speed'] = np.sqrt(df['h_d']**2 + df['v_d']**2)
            
            # Rolling window stats (0.5s window)
            fs = 1.0 / (t[1] - t[0])
            win = int(0.5 * fs)
            df['h_var'] = df['h'].rolling(window=win).var().fillna(0)
            df['v_var'] = df['v'].rolling(window=win).var().fillna(0)
            
            # Labeling
            # ground_truth_ts is [start1, end1, start2, end2, ...]
            for i in range(0, len(ground_truth_ts), 2):
                if i + 1 >= len(ground_truth_ts): break
                start, end = ground_truth_ts[i], ground_truth_ts[i+1]
                df.loc[(df['t'] >= start) & (df['t'] <= end), 'label'] = 1
                
            return df
        except Exception:
            return None
