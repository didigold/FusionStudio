"""
Dataset Builder for FusionStudio ML Training.
Orchestrates the conversion of manual marks, signal data, and video embeddings
into training datasets for both legacy MLP and multimodal CNN+LSTM models.
"""
import os
import json
import pandas as pd
import numpy as np
from asammdf import MDF


WINDOW_SIZE_SEC = 2.0
WINDOW_STRIDE_SEC = 0.5


class DatasetBuilder:
    def __init__(self, on_progress=None, on_log=None, on_finished=None, on_error=None, on_multimodal_finished=None):
        self.on_progress = on_progress
        self.on_log = on_log
        self.on_finished = on_finished
        self.on_error = on_error
        self.on_multimodal_finished = on_multimodal_finished

    def build_from_folders(self, root_folders, output_csv):
        all_data = []

        try:
            total_folders = len(root_folders)
            for f_idx, folder in enumerate(root_folders):
                if self.on_log:
                    self.on_log(f"Scanning folder: {os.path.basename(folder)}")
                marks_path = os.path.join(folder, "marks.json")
                if not os.path.exists(marks_path):
                    if self.on_log:
                        self.on_log(f"Skipping {folder}: No marks.json found.")
                    continue

                with open(marks_path, "r", encoding="utf-8") as f:
                    marks_data = json.load(f)

                total_cases = len(marks_data)
                for c_idx, (case_key, timestamps) in enumerate(marks_data.items()):
                    if self.on_log:
                        self.on_log(f"  Processing case: {case_key}")
                    mf4_path = self._resolve_mf4_path(folder, case_key)

                    if not mf4_path or not os.path.exists(mf4_path):
                        if self.on_log:
                            self.on_log(f"    Warning: Could not find MF4 for {case_key}")
                        continue

                    case_df = self._extract_features_and_labels(mf4_path, timestamps)
                    if case_df is not None:
                        all_data.append(case_df)

                    p = (f_idx / total_folders) + ((c_idx / total_cases) / total_folders)
                    if self.on_progress:
                        self.on_progress(p)

            if not all_data:
                raise Exception("No valid data points collected.")

            final_df = pd.concat(all_data, ignore_index=True)

            os.makedirs(os.path.dirname(output_csv), exist_ok=True)
            final_df.to_csv(output_csv, index=False)
            if self.on_log:
                self.on_log(f"Dataset created successfully: {len(final_df)} samples.")
            if self.on_finished:
                self.on_finished(output_csv)
            return True

        except Exception as e:
            import traceback
            if self.on_log:
                self.on_log(f"Error building dataset: {str(e)}")
            traceback.print_exc()
            if self.on_error:
                self.on_error(str(e))
            return False

    def _resolve_mf4_path(self, root, case_key):
        direct_root_path = os.path.normpath(os.path.join(root, case_key))
        if os.path.exists(direct_root_path):
            return direct_root_path

        parent_dir = os.path.dirname(root)
        direct_parent_path = os.path.normpath(os.path.join(parent_dir, case_key))
        if os.path.exists(direct_parent_path):
            return direct_parent_path

        parts = case_key.split('/')
        if len(parts) >= 2:
            subject, case = parts[0], parts[1]
            patterns = [
                os.path.join(root, subject, f"{case}_tracking.mf4"),
                os.path.join(root, subject, case, f"{case}_tracking.mf4"),
                os.path.join(root, f"{case}_tracking.mf4")
            ]
            for p in patterns:
                if os.path.exists(p):
                    return p

        return None

    def _extract_features_and_labels(self, mf4_path, ground_truth_ts):
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

            df['h_d'] = df['h'].diff().fillna(0)
            df['v_d'] = df['v'].diff().fillna(0)
            df['speed'] = np.sqrt(df['h_d'] ** 2 + df['v_d'] ** 2)

            fs = 1.0 / (t[1] - t[0])
            win = int(0.5 * fs)
            df['h_var'] = df['h'].rolling(window=win).var().fillna(0)
            df['v_var'] = df['v'].rolling(window=win).var().fillna(0)

            for i in range(0, len(ground_truth_ts), 2):
                if i + 1 >= len(ground_truth_ts):
                    break
                start, end = ground_truth_ts[i], ground_truth_ts[i + 1]
                df.loc[(df['t'] >= start) & (df['t'] <= end), 'label'] = 1

            return df
        except Exception:
            return None

    def build_multimodal_from_folders(self, root_folders, output_dir, video_extractor=None, project_camera_config=None):
        all_signal_windows = []
        all_video_windows = []
        all_labels = []
        all_project_ids = []

        os.makedirs(output_dir, exist_ok=True)

        try:
            total_folders = len(root_folders)
            for f_idx, folder in enumerate(root_folders):
                folder_name = os.path.basename(folder)
                if self.on_log:
                    self.on_log(f"[Multimodal] Scanning: {folder_name}")
                marks_path = os.path.join(folder, "marks.json")
                if not os.path.exists(marks_path):
                    if self.on_log:
                        self.on_log(f"  Skipping {folder_name}: No marks.json")
                    continue

                with open(marks_path, "r", encoding="utf-8") as f:
                    marks_data = json.load(f)

                total_cases = len(marks_data)
                camera_hint = None
                if project_camera_config:
                    norm_folder = os.path.normpath(folder)
                    camera_hint = project_camera_config.get(folder, project_camera_config.get(norm_folder, "auto"))

                for c_idx, (case_key, timestamps) in enumerate(marks_data.items()):
                    if len(timestamps) < 2:
                        continue

                    if self.on_log:
                        self.on_log(f"  Processing: {case_key}")
                    mf4_path = self._resolve_mf4_path(folder, case_key)
                    if not mf4_path or not os.path.exists(mf4_path):
                        if self.on_log:
                            self.on_log(f"    No MF4 for {case_key}, skipping")
                        continue

                    signal_data = self._extract_signal_array(mf4_path)
                    if signal_data is None:
                        continue

                    video_data = None
                    if video_extractor is not None:
                        video_path = self._resolve_video_path(mf4_path, folder, case_key, camera_hint=camera_hint)
                        if video_path and os.path.exists(video_path):
                            if self.on_log:
                                self.on_log(f"    Loading video features: {os.path.basename(video_path)}")
                            total_span = timestamps[-1] - timestamps[0] if len(timestamps) >= 2 else signal_data[-1, 0] - signal_data[0, 0]
                            video_cache_key = os.path.splitext(os.path.basename(mf4_path))[0]
                            video_data = video_extractor.get_embeddings_for_interval(
                                video_path, timestamps[0] - 1.0, timestamps[-2] + 1.0 if len(timestamps) >= 2 else signal_data[-1, 0], video_cache_key
                            )
                            if video_data is None:
                                if self.on_log:
                                    self.on_log(f"    Video extraction failed for {case_key} (cache key: {video_cache_key})")
                                continue
                        else:
                            if self.on_log:
                                self.on_log(f"    No video found for {case_key}, skipping")
                            continue

                    windows = self._create_windows(
                        signal_data, timestamps, folder_name,
                        video_data=video_data
                    )

                    for win in windows:
                        all_signal_windows.append(win["signal"])
                        all_video_windows.append(win["video"])
                        all_labels.append(win["label"])
                        all_project_ids.append(win["project_id"])

                    p = (f_idx / total_folders) + ((c_idx / max(total_cases, 1)) / total_folders)
                    if self.on_progress:
                        self.on_progress(p)

            if not all_signal_windows:
                raise Exception("No valid multimodal windows collected. Ensure projects have both video and tracking data.")

            if self.on_log:
                self.on_log(f"Multimodal dataset: {len(all_signal_windows)} windows from {len(set(all_project_ids))} projects")

            result = {
                "signal_windows": all_signal_windows,
                "video_windows": all_video_windows,
                "labels": all_labels,
                "project_ids": all_project_ids,
            }
            if self.on_multimodal_finished:
                self.on_multimodal_finished(result)
            return result

        except Exception as e:
            import traceback
            if self.on_log:
                self.on_log(f"Error building multimodal dataset: {str(e)}")
            traceback.print_exc()
            if self.on_error:
                self.on_error(str(e))
            return None

    def _extract_signal_array(self, mf4_path):
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

            df = pd.DataFrame({'t': t, 'h': h, 'v': v})
            df['h_d'] = df['h'].diff().fillna(0)
            df['v_d'] = df['v'].diff().fillna(0)
            df['speed'] = np.sqrt(df['h_d'] ** 2 + df['v_d'] ** 2)
            fs = 1.0 / (t[1] - t[0]) if len(t) > 1 else 30.0
            win = int(0.5 * fs)
            df['h_var'] = df['h'].rolling(window=win).var().fillna(0)
            df['v_var'] = df['v'].rolling(window=win).var().fillna(0)

            arr = df[['h', 'v', 'h_d', 'v_d', 'speed', 'h_var', 'v_var']].values.astype(np.float32)
            timestamps = t
            return np.column_stack([timestamps, arr])
        except Exception as e:
            if self.on_log:
                self.on_log(f"    Error extracting signals: {e}")
            return None

    def _create_windows(self, signal_data, ground_truth_ts, project_id, video_data=None):
        timestamps = signal_data[:, 0]
        fs = 1.0 / (timestamps[1] - timestamps[0]) if len(timestamps) > 1 else 30.0
        window_samples = int(WINDOW_SIZE_SEC * fs)
        stride_samples = int(WINDOW_STRIDE_SEC * fs)

        if window_samples < 2 or stride_samples < 1:
            window_samples = max(window_samples, 2)
            stride_samples = max(stride_samples, 1)

        vid_dim = video_data.shape[1] - 1 if video_data is not None else 1284
        if video_data is not None and vid_dim != 1284:
            if self.on_log:
                self.on_log(f"    Warning: Video embedding dim={vid_dim}, expected 1284. Truncating/padding.")
            if vid_dim > 1284:
                vid_dim = 1284
        vid_timestamps = video_data[:, -1] if video_data is not None else None

        windows = []
        if len(signal_data) < window_samples:
            if self.on_log:
                self.on_log(f"    Warning: Signal too short ({len(signal_data)} samples) for window ({window_samples}). Skipping.")
            return windows

        i = 0
        while i + window_samples <= len(signal_data):
            sig_window = signal_data[i:i + window_samples, 1:]
            win_start_t = timestamps[i]
            win_end_t = timestamps[min(i + window_samples - 1, len(timestamps) - 1)]

            label = 0
            for j in range(0, len(ground_truth_ts), 2):
                if j + 1 >= len(ground_truth_ts):
                    break
                gt_start, gt_end = ground_truth_ts[j], ground_truth_ts[j + 1]
                if (win_start_t <= gt_end) and (win_end_t >= gt_start):
                    label = 1
                    break

            vid_window = np.zeros((window_samples, vid_dim), dtype=np.float32)
            if video_data is not None and vid_timestamps is not None:
                mask = (vid_timestamps >= win_start_t) & (vid_timestamps <= win_end_t)
                matching = video_data[mask]
                if len(matching) > 0:
                    vid_features = matching[:, :-1][:, :1284]
                    target_len = min(len(vid_features), window_samples)
                    vid_window[:target_len, :vid_features.shape[1]] = vid_features[:target_len]

            windows.append({
                "signal": sig_window.astype(np.float32),
                "video": vid_window.astype(np.float32),
                "label": label,
                "project_id": project_id,
            })

            i += stride_samples

        return windows

    def _resolve_video_path(self, mf4_path, folder, case_key, camera_hint=None):
        from backend.core.video_feature_extractor import VideoFeatureExtractor
        direct = VideoFeatureExtractor.find_video_for_mf4(mf4_path, camera_hint=camera_hint)
        if direct and os.path.exists(direct):
            return direct

        case_base = os.path.splitext(os.path.basename(mf4_path))[0].replace("_tracking", "")
        mf4_dir = os.path.dirname(mf4_path)
        candidates = []
        if camera_hint and camera_hint not in ("auto", "Auto"):
            cam = camera_hint.lstrip("_")
            candidates.extend([
                os.path.join(mf4_dir, f"{case_base}_{cam}.avi"),
                os.path.join(mf4_dir, f"{case_base}_{cam}.AVI"),
            ])
        candidates.extend([
            os.path.join(mf4_dir, f"{case_base}.avi"),
            os.path.join(mf4_dir, f"{case_base}.AVI"),
            os.path.join(mf4_dir, f"{case_base}_cam1.avi"),
            os.path.join(mf4_dir, f"{case_base}_cam1.AVI"),
            os.path.join(mf4_dir, f"{case_base}_cam2.avi"),
            os.path.join(mf4_dir, f"{case_base}_cam2.AVI"),
        ])
        for c in candidates:
            if os.path.exists(c):
                return c

        parts = case_key.split('/')
        for i in range(1, len(parts)):
            subpath = os.path.join(folder, *parts[:i])
            for ext in ['.avi', '.AVI']:
                for suffix in ['', '_cam1', '_cam2']:
                    c = os.path.join(subpath, f"{case_base}{suffix}{ext}")
                    if os.path.exists(c):
                        return c

        if self.on_log:
            self.on_log(f"    Could not locate video for {case_key}")
        return None