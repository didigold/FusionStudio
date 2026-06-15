"""
MultimodalEngine for FusionStudio - PyTorch-based multimodal distraction detector.
Architecture: SignalBranch (1D Conv + LSTM) | VideoBranch (LSTM) → Fusion → Binary classifier.
Training uses 70/30 project-level split to prevent data leakage.
"""
import os
import time as _time
import json
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from datetime import datetime


class SignalBranch:

    class _Impl(nn.Module):
        def __init__(self, input_dim=7, hidden_dim=128):
            super().__init__()
            self.conv1 = nn.Conv1d(input_dim, 64, kernel_size=3, padding=1)
            self.relu1 = nn.ReLU()
            self.conv2 = nn.Conv1d(64, 128, kernel_size=3, padding=1)
            self.relu2 = nn.ReLU()
            self.lstm = nn.LSTM(128, hidden_dim, batch_first=True, num_layers=1)
            self.fc = nn.Linear(hidden_dim, hidden_dim)

        def forward(self, x):
            x = x.permute(0, 2, 1)
            x = self.relu1(self.conv1(x))
            x = self.relu2(self.conv2(x))
            x = x.permute(0, 2, 1)
            _, (hn, _) = self.lstm(x)
            out = self.fc(hn.squeeze(0))
            return out


class VideoBranch:

    class _Impl(nn.Module):
        def __init__(self, input_dim=1284, hidden_dim=128):
            super().__init__()
            self.lstm = nn.LSTM(input_dim, hidden_dim, batch_first=True, num_layers=1)
            self.fc = nn.Linear(hidden_dim, hidden_dim)

        def forward(self, x):
            _, (hn, _) = self.lstm(x)
            out = self.fc(hn.squeeze(0))
            return out


class MultimodalDetector:

    class _Impl(nn.Module):
        def __init__(self, signal_dim=7, video_dim=1284, hidden_dim=128):
            super().__init__()
            self.signal_branch = SignalBranch._Impl(signal_dim, hidden_dim)
            self.video_branch = VideoBranch._Impl(video_dim, hidden_dim)
            self.fusion = nn.Sequential(
                nn.Linear(hidden_dim * 2, 128),
                nn.ReLU(),
                nn.Dropout(0.3),
                nn.Linear(128, 64),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(64, 1),
            )

        def forward(self, sig, vid):
            sig_out = self.signal_branch(sig)
            vid_out = self.video_branch(vid)
            combined = torch.cat([sig_out, vid_out], dim=1)
            return self.fusion(combined)


class MultimodalDataset:

    class _Impl(Dataset):
        def __init__(self, signal_windows, video_windows, labels):
            self.signal_windows = signal_windows
            self.video_windows = video_windows
            self.labels = labels

        def __len__(self):
            return len(self.labels)

        def __getitem__(self, idx):
            sig = torch.FloatTensor(self.signal_windows[idx])
            vid = torch.FloatTensor(self.video_windows[idx])
            lbl = torch.FloatTensor([self.labels[idx]])
            return sig, vid, lbl


class MultimodalTrainer:
    def __init__(self, base_models_dir="models",
                 on_log=None, on_metrics=None, on_finished=None,
                 on_extraction_progress=None,
                 # Aliases accepted from brain.py router
                 on_epoch=None, on_phase_change=None,
                 cam_config=None, on_start_extraction=None):
        self.base_models_dir = os.path.join(base_models_dir, "distraction_detector", "multimodal")
        self.model = None
        self.scaler_mean = None
        self.scaler_std = None
        self.metadata = {
            "architecture": "multimodal",
            "projects": [],
            "history": {"train_loss": [], "train_acc": [], "train_f1": [], "val_loss": [], "val_acc": [], "val_f1": []},
            "name": "Distraction Detector",
        }
        self.model_path = None
        self._camera_config = cam_config or {}

        self.on_log = on_log
        # on_epoch is an alias for on_metrics (brain.py uses on_epoch)
        self.on_metrics = on_metrics or on_epoch
        self.on_finished = on_finished
        self.on_extraction_progress = on_extraction_progress
        self.on_phase_change = on_phase_change

    def load_model(self, model_path):
        import torch
        if os.path.exists(model_path):
            try:
                checkpoint = torch.load(model_path, map_location="cpu", weights_only=False)
                config = checkpoint.get("config", {})
                sig_dim = config.get("signal_dim", 7)
                vid_dim = config.get("video_dim", 1284)
                hidden = config.get("hidden_dim", 128)
                self.model = MultimodalDetector._Impl(signal_dim=sig_dim, video_dim=vid_dim, hidden_dim=hidden)
                self.model.load_state_dict(checkpoint["model_state_dict"])
                self.model.eval()
                self.scaler_mean = checkpoint.get("scaler_mean")
                self.scaler_std = checkpoint.get("scaler_std")
                meta_path = os.path.join(os.path.dirname(model_path), "metadata.json")
                if os.path.exists(meta_path):
                    with open(meta_path, "r") as f:
                        self.metadata = json.load(f)
                else:
                    self.metadata = checkpoint.get("metadata", self.metadata)
                self.model_path = model_path
                if self.on_log:
                    self.on_log(f"Multimodal model loaded from {os.path.basename(os.path.dirname(model_path))}")
                return True
            except Exception as e:
                if self.on_log:
                    self.on_log(f"Error loading multimodal model: {e}")
                return False
        return False

    def find_latest_model(self, model_name="distraction_detector"):
        candidates = []
        if not os.path.exists(self.base_models_dir):
            return None
        for root, dirs, files in os.walk(self.base_models_dir):
            for f in files:
                if f == "model.pt" or f == "model.pkl":
                    build_dir = os.path.basename(root)
                    if build_dir.startswith("build_"):
                        candidates.append((root, build_dir))
            dirs[:] = [d for d in dirs if d != "video_cache"]
        if not candidates:
            return None
        candidates.sort(key=lambda x: x[1], reverse=True)
        for root, _ in candidates:
            pt_path = os.path.join(root, "model.pt")
            if os.path.exists(pt_path):
                return pt_path
            pkl_path = os.path.join(root, "model.pkl")
            if os.path.exists(pkl_path):
                return pkl_path
        return None

    def _split_projects(self, project_paths, train_ratio=0.7):
        n = len(project_paths)
        n_train = max(1, int(n * train_ratio))
        indices = np.arange(n)
        np.random.seed(42)
        np.random.shuffle(indices)
        train_idx = sorted(indices[:n_train])
        val_idx = sorted(indices[n_train:])
        train_projects = [project_paths[i] for i in train_idx]
        val_projects = [project_paths[i] for i in val_idx]
        return train_projects, val_projects

    def train(self, signal_windows, video_windows, labels, project_ids, model_name, epochs, lr, project_paths, early_stop_patience=15, base_model_path=None, batch_size=32, weight_decay=1e-4, check_running_callback=None):
        from sklearn.metrics import f1_score, accuracy_score

        try:
            if base_model_path and os.path.exists(base_model_path):
                if self.on_log:
                    self.on_log(f"Loading weights from base model: {base_model_path}")
                self.load_model(base_model_path)

            if self.on_log:
                self.on_log("Preparing multimodal dataset...")

            project_ids = np.array(project_ids)
            unique_projects = list(set(project_ids))
            train_projects, val_projects = self._split_projects(unique_projects, train_ratio=0.7)

            train_mask = np.isin(project_ids, train_projects)
            val_mask = ~train_mask

            if val_mask.sum() == 0 and len(train_projects) > 1:
                val_mask[:max(1, len(val_mask) // 3)] = True
                train_mask = ~val_mask

            train_sig = [signal_windows[i] for i in range(len(signal_windows)) if train_mask[i]]
            train_vid = [video_windows[i] for i in range(len(video_windows)) if train_mask[i]]
            train_lbl = [labels[i] for i in range(len(labels)) if train_mask[i]]
            val_sig = [signal_windows[i] for i in range(len(signal_windows)) if val_mask[i]]
            val_vid = [video_windows[i] for i in range(len(video_windows)) if val_mask[i]]
            val_lbl = [labels[i] for i in range(len(labels)) if val_mask[i]]

            if self.on_log:
                self.on_log(f"Train: {len(train_sig)} windows from {len(train_projects)} projects")
                self.on_log(f"Val: {len(val_sig)} windows from {len(val_projects)} projects")

            mean_vals = [np.mean(s) for s in train_sig if len(s) > 0]
            std_vals = [np.std(s) for s in train_sig if len(s) > 0]
            overall_mean = np.mean(mean_vals) if mean_vals else 0.0
            overall_std = np.mean(std_vals) if std_vals else 1.0
            self.scaler_mean = overall_mean
            self.scaler_std = max(overall_std, 1e-8)

            train_sig_norm = [self._normalize_window(w, overall_mean, overall_std) for w in train_sig]
            val_sig_norm = [self._normalize_window(w, overall_mean, overall_std) for w in val_sig]

            train_dataset = MultimodalDataset._Impl(train_sig_norm, train_vid, train_lbl)
            train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, drop_last=False)
            val_dataset = MultimodalDataset._Impl(val_sig_norm, val_vid, val_lbl) if val_sig else None
            val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False) if val_dataset else None

            pos_count = sum(train_lbl)
            neg_count = len(train_lbl) - pos_count
            pos_weight = torch.tensor([neg_count / max(pos_count, 1)], dtype=torch.float32)

            sig_dim = train_sig_norm[0].shape[1] if train_sig_norm else 7
            vid_dim = train_vid[0].shape[1] if train_vid else 1284

            if self.model is None:
                if self.on_log:
                    self.on_log(f"Initializing MultimodalDetector (signal_dim={sig_dim}, video_dim={vid_dim})...")
                self.model = MultimodalDetector._Impl(signal_dim=sig_dim, video_dim=vid_dim)
            else:
                if self.on_log:
                    self.on_log("Resuming training with loaded model weights.")
            criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
            optimizer = torch.optim.AdamW(self.model.parameters(), lr=lr, weight_decay=weight_decay)
            scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", patience=5, factor=0.5)

            if "history" not in self.metadata or not self.metadata["history"] or not self.metadata["history"].get("train_loss"):
                self.metadata["history"] = {"train_loss": [], "train_acc": [], "train_f1": [], "val_loss": [], "val_acc": [], "val_f1": []}

            best_val_loss = float("inf")
            best_state = None
            patience_counter = 0

            if self.on_log:
                self.on_log(f"Training multimodal model '{model_name}' for {epochs} epochs (batch_size={batch_size}, weight_decay={weight_decay})...")

            # Emit dataset stats for frontend display
            dataset_stats = {
                "total_windows": len(train_lbl) + len(val_lbl),
                "train_windows": len(train_lbl),
                "val_windows": len(val_lbl),
                "train_positive": int(sum(train_lbl)),
                "train_negative": int(len(train_lbl) - sum(train_lbl)),
                "val_positive": int(sum(val_lbl)) if val_lbl else 0,
                "val_negative": int(len(val_lbl) - sum(val_lbl)) if val_lbl else 0,
                "class_balance_ratio": float(sum(train_lbl) / max(len(train_lbl), 1)),
            }
            if self.on_metrics:
                self.on_metrics({"type": "dataset_stats", **dataset_stats})

            for epoch in range(1, epochs + 1):
                if check_running_callback and not check_running_callback():
                    if self.on_log:
                        self.on_log("Training stopped by user.")
                    break

                epoch_start = _time.time()
                self.model.train()
                train_losses, train_preds, train_targets = [], [], []
                for sig_batch, vid_batch, lbl_batch in train_loader:
                    if check_running_callback and not check_running_callback():
                        break
                    optimizer.zero_grad()
                    output = self.model(sig_batch, vid_batch)
                    loss = criterion(output, lbl_batch)
                    loss.backward()
                    optimizer.step()
                    train_losses.append(loss.item())
                    preds = (torch.sigmoid(output).detach().cpu().numpy() > 0.5).astype(int).flatten()
                    targets = lbl_batch.detach().cpu().numpy().astype(int).flatten()
                    train_preds.extend(preds)
                    train_targets.extend(targets)

                train_loss = np.mean(train_losses)
                train_acc = accuracy_score(train_targets, train_preds)
                train_f1 = f1_score(train_targets, train_preds, zero_division=0)

                val_loss, val_acc, val_f1 = 0.0, 0.0, 0.0
                if val_loader is not None:
                    self.model.eval()
                    val_losses_l, val_preds_l, val_targets_l = [], [], []
                    with torch.no_grad():
                        for sig_batch, vid_batch, lbl_batch in val_loader:
                            output = self.model(sig_batch, vid_batch)
                            loss = criterion(output, lbl_batch)
                            val_losses_l.append(loss.item())
                            preds = (torch.sigmoid(output).cpu().numpy() > 0.5).astype(int).flatten()
                            targets = lbl_batch.cpu().numpy().astype(int).flatten()
                            val_preds_l.extend(preds)
                            val_targets_l.extend(targets)
                    val_loss = np.mean(val_losses_l)
                    val_acc = accuracy_score(val_targets_l, val_preds_l)
                    val_f1 = f1_score(val_targets_l, val_preds_l, zero_division=0)
                    scheduler.step(val_loss)

                    if val_loss < best_val_loss:
                        best_val_loss = val_loss
                        best_state = {k: v.clone() for k, v in self.model.state_dict().items()}
                        patience_counter = 0
                    else:
                        patience_counter += 1
                        if patience_counter >= early_stop_patience:
                            if self.on_log:
                                self.on_log(f"Early stopping at epoch {epoch} (no improvement for {early_stop_patience} epochs)")
                            break

                epoch_time = _time.time() - epoch_start
                current_lr = optimizer.param_groups[0]['lr']

                self.metadata["history"]["train_loss"].append(float(train_loss))
                self.metadata["history"]["train_acc"].append(float(train_acc))
                self.metadata["history"]["train_f1"].append(float(train_f1))
                self.metadata["history"]["val_loss"].append(float(val_loss))
                self.metadata["history"]["val_acc"].append(float(val_acc))
                self.metadata["history"]["val_f1"].append(float(val_f1))

                if self.on_metrics:
                    self.on_metrics({
                        "epoch": epoch,
                        "loss": float(train_loss),
                        "acc": float(train_acc),
                        "val_loss": float(val_loss),
                        "val_acc": float(val_acc),
                        "val_f1": float(val_f1),
                        "train_f1": float(train_f1),
                        "lr": float(current_lr),
                        "epoch_time": round(epoch_time, 2),
                    })

            if best_state is not None:
                self.model.load_state_dict(best_state)
                if self.on_log:
                    self.on_log(f"Restored best model (val_loss={best_val_loss:.4f})")

            self.model.eval()
            self.metadata["projects"] = list(set(self.metadata.get("projects", []) + project_paths))
            self.metadata["name"] = model_name
            self.metadata["train_projects"] = train_projects
            self.metadata["val_projects"] = val_projects
            self.metadata["best_val_loss"] = float(best_val_loss)
            self.metadata["signal_dim"] = sig_dim
            self.metadata["video_dim"] = vid_dim
            self.metadata["scaler_mean"] = float(self.scaler_mean)
            self.metadata["scaler_std"] = float(self.scaler_std)

            self.metadata["training_config"] = {
                "epochs_requested": epochs,
                "epochs_completed": epoch,
                "learning_rate": lr,
                "batch_size": batch_size,
                "weight_decay": weight_decay,
                "early_stop_patience": early_stop_patience,
                "timestamp": datetime.now().isoformat(),
                "pytorch_version": torch.__version__,
            }
            self.metadata["project_details"] = {}
            import glob as _glob
            for p in project_paths:
                mf4s = _glob.glob(os.path.join(p, "**", "*_tracking.mf4"), recursive=True)
                avis = _glob.glob(os.path.join(p, "**", "*.avi"), recursive=True)
                marks = os.path.join(p, "marks.json")
                n_cases = 0
                if os.path.exists(marks):
                    try:
                        with open(marks) as f:
                            n_cases = len(json.load(f))
                    except Exception:
                        pass
                self.metadata["project_details"][p] = {
                    "n_tracking_mf4": len(mf4s),
                    "n_avi": len(avis),
                    "n_cases": n_cases,
                    "camera_config": self._camera_config.get(p, "auto"),
                }
            self.metadata["dataset_stats"] = {
                "total_windows": len(train_lbl) + len(val_lbl),
                "train_windows": len(train_lbl),
                "val_windows": len(val_lbl),
                "train_positive": int(sum(train_lbl)),
                "train_negative": int(len(train_lbl) - sum(train_lbl)),
                "val_positive": int(sum(val_lbl)) if val_lbl else 0,
                "val_negative": int(len(val_lbl) - sum(val_lbl)) if val_lbl else 0,
                "class_balance_ratio": float(sum(train_lbl) / max(len(train_lbl), 1)),
            }

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = model_name.replace(" ", "_").lower() if model_name and model_name not in ("No model loaded", "no_model_loaded") else "distraction_detector"
            version_dir = os.path.join(self.base_models_dir, safe_name, f"build_{timestamp}")
            os.makedirs(version_dir, exist_ok=True)

            config = {
                "signal_dim": sig_dim,
                "video_dim": vid_dim,
                "hidden_dim": 128,
            }
            checkpoint = {
                "model_state_dict": self.model.state_dict(),
                "config": config,
                "scaler_mean": self.scaler_mean,
                "scaler_std": self.scaler_std,
                "metadata": self.metadata,
            }
            save_path = os.path.join(version_dir, "model.pt")
            torch.save(checkpoint, save_path)

            with open(os.path.join(version_dir, "metadata.json"), "w") as f:
                json.dump(self.metadata, f, indent=4)

            self.model_path = save_path
            if self.on_log:
                self.on_log(f"Training complete. Model saved to: {version_dir}")
            if self.on_finished:
                self.on_finished()
            return True

        except Exception as e:
            import traceback
            if self.on_log:
                self.on_log(f"Multimodal training failed: {e}")
            traceback.print_exc()
            if self.on_finished:
                self.on_finished()
            return False

    def _normalize_window(self, window, mean, std):
        return ((np.array(window) - mean) / std).astype(np.float32)

    def predict_intervals(self, signal_seq, video_embeddings):
        import torch
        from scipy.ndimage import binary_closing, binary_opening

        if self.model is None:
            return []

        if self.scaler_mean is not None and self.scaler_std is not None:
            signal_seq = ((np.array(signal_seq) - self.scaler_mean) / self.scaler_std).astype(np.float32)

        sig_dim = self.metadata.get("signal_dim", 7)
        vid_dim = self.metadata.get("video_dim", 1284)
        timestamps = signal_seq[:, 0] if signal_seq.shape[1] > sig_dim else np.arange(len(signal_seq))
        signal_data = signal_seq[:, :sig_dim] if signal_seq.shape[1] > sig_dim else signal_seq

        video_data = np.array(video_embeddings)[:, :vid_dim]

        WINDOW = 60
        STRIDE = 15

        total_len = min(len(signal_data), len(video_data))
        if total_len < WINDOW:
            return []

        probabilities = []
        for start in range(0, total_len - WINDOW + 1, STRIDE):
            sig_win = signal_data[start:start + WINDOW]
            vid_win = video_data[start:start + WINDOW]
            sig_t = torch.FloatTensor(sig_win).unsqueeze(0)
            vid_t = torch.FloatTensor(vid_win).unsqueeze(0)
            with torch.no_grad():
                out = torch.sigmoid(self.model(sig_t, vid_t))
            probabilities.append(out.item())

        if not probabilities:
            return []

        probs = np.array(probabilities)
        is_active = probs > 0.5
        is_active = binary_opening(is_active, structure=np.ones(3))
        is_active = binary_closing(is_active, structure=np.ones(5))

        diff = np.diff(is_active.astype(int))
        starts = np.where(diff == 1)[0]
        ends = np.where(diff == -1)[0]
        if is_active[0]:
            starts = np.insert(starts, 0, 0)
        if is_active[-1]:
            ends = np.append(ends, len(is_active) - 1)

        results = []
        t = timestamps[:total_len]
        for s, e in zip(starts, ends):
            real_start = min(s * STRIDE, len(t) - 1)
            real_end = min(e * STRIDE + WINDOW, len(t) - 1)
            results.extend([float(t[real_start]), float(t[real_end])])
        return results