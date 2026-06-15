"""
ML Engine for FusionStudio - Legacy MLPClassifier model training and inference.
NOTE: This module is superseded by multimodal_engine.py for new training.
Kept for backward compatibility with existing .pkl models.
For new models, use MultimodalTrainer (CNN+LSTM with video + signal fusion).
"""
import os
import joblib
import json
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score, log_loss


class MLEngine:
    def __init__(self, base_models_dir="models",
                 on_log=None, on_trained=None, on_epoch_progress=None):
        self.base_models_dir = os.path.join(base_models_dir, "distraction_detector", "mlp")
        self.model = None
        self.metadata = {"projects": [], "history": {"loss": [], "acc": []}, "name": "Distraction Detector"}
        self.model_path = None

        self.on_log = on_log
        self.on_trained = on_trained
        self.on_epoch_progress = on_epoch_progress

    def load_model(self, model_path):
        if os.path.exists(model_path):
            try:
                data = joblib.load(model_path)
                self.model = data.get("model")
                self.metadata = data.get("metadata", {"projects": [], "history": {"loss": [], "acc": []}, "name": "Distraction Detector"})
                self.model_path = model_path
                if self.on_log:
                    self.on_log(f"AI Brain loaded from {os.path.basename(os.path.dirname(model_path))}")
                return True
            except Exception as e:
                if self.on_log:
                    self.on_log(f"Error loading model: {e}")
        return False

    def find_latest_model(self, model_name="distraction_detector"):
        candidates = []
        if not os.path.exists(self.base_models_dir):
            return None
        for root, dirs, files in os.walk(self.base_models_dir):
            for f in files:
                if f == "model.pkl":
                    build_dir = os.path.basename(root)
                    if build_dir.startswith("build_"):
                        candidates.append((root, build_dir))
        if not candidates:
            return None
        candidates.sort(key=lambda x: x[1], reverse=True)
        for root, _ in candidates:
            pkl_path = os.path.join(root, "model.pkl")
            if os.path.exists(pkl_path):
                return pkl_path
        return None

    def train(self, dataset_csv, model_name, epochs, lr, project_paths, check_running_callback=None):
        try:
            if self.on_log:
                self.on_log("Preparing dataset...")
            df = pd.read_csv(dataset_csv)

            features = ['h', 'v', 'h_d', 'v_d', 'speed', 'h_var', 'v_var']
            X = df[features].values
            y = df['label'].values

            if self.model is None or not isinstance(self.model, MLPClassifier):
                if self.on_log:
                    self.on_log("Initializing new Multi-Layer Perceptron...")
                self.model = MLPClassifier(hidden_layer_sizes=(64, 32), learning_rate_init=lr, random_state=42, max_iter=1)

            classes = np.array([0, 1])

            self.metadata["history"] = {"loss": [], "acc": []}
            self.metadata["projects"] = list(set(self.metadata.get("projects", []) + project_paths))
            self.metadata["name"] = model_name

            if self.on_log:
                self.on_log(f"Training AI Brain '{model_name}' for {epochs} epochs...")

            for epoch in range(1, epochs + 1):
                if check_running_callback and not check_running_callback():
                    if self.on_log:
                        self.on_log("Training stopped by user.")
                    break

                self.model.partial_fit(X, y, classes=classes)

                y_pred = self.model.predict(X)
                y_prob = self.model.predict_proba(X)

                acc = accuracy_score(y, y_pred)
                loss = log_loss(y, y_prob)

                self.metadata["history"]["loss"].append(float(loss))
                self.metadata["history"]["acc"].append(float(acc))

                if self.on_epoch_progress:
                    self.on_epoch_progress(epoch, loss, acc)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = model_name.replace(" ", "_").lower()
            version_dir = os.path.join(self.base_models_dir, safe_name, f"build_{timestamp}")
            os.makedirs(version_dir, exist_ok=True)

            save_path = os.path.join(version_dir, "model.pkl")
            joblib.dump({"model": self.model, "metadata": self.metadata}, save_path)

            with open(os.path.join(version_dir, "metadata.json"), "w") as f:
                json.dump(self.metadata, f, indent=4)

            if self.on_log:
                self.on_log(f"Training complete. Model saved to: {version_dir}")
            if self.on_trained:
                self.on_trained(True)
            return True
        except Exception as e:
            import traceback
            if self.on_log:
                self.on_log(f"Training failed: {e}")
            traceback.print_exc()
            return False

    def predict_intervals(self, timestamps, h, v):
        if self.model is None:
            return []

        df = pd.DataFrame({
            't': timestamps,
            'h': h,
            'v': v
        })
        df['h_d'] = df['h'].diff().fillna(0)
        df['v_d'] = df['v'].diff().fillna(0)
        df['speed'] = np.sqrt(df['h_d'] ** 2 + df['v_d'] ** 2)

        fs = 1.0 / (timestamps[1] - timestamps[0])
        win = int(0.5 * fs)
        df['h_var'] = df['h'].rolling(window=win).var().fillna(0)
        df['v_var'] = df['v'].rolling(window=win).var().fillna(0)

        features = ['h', 'v', 'h_d', 'v_d', 'speed', 'h_var', 'v_var']

        probs = self.model.predict_proba(df[features])[:, 1]

        is_active = probs > 0.5

        from scipy.ndimage import binary_closing, binary_opening
        is_active = binary_opening(is_active, structure=np.ones(10))
        is_active = binary_closing(is_active, structure=np.ones(20))

        diff = np.diff(is_active.astype(int))
        starts = np.where(diff == 1)[0]
        ends = np.where(diff == -1)[0]

        if is_active[0]:
            starts = np.insert(starts, 0, 0)
        if is_active[-1]:
            ends = np.append(ends, len(is_active) - 1)

        results = []
        for s, e in zip(starts, ends):
            results.append(timestamps[s])
            results.append(timestamps[e])

        return results