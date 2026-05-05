"""
ML Engine for FusionStudio - Model training and inference.
"""
import os
import joblib
import json
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score, log_loss
from PySide6.QtCore import QObject, Signal

class MLEngine(QObject):
    log = Signal(str)
    trained = Signal(bool)
    epoch_progress = Signal(int, float, float) # epoch, loss, acc

    def __init__(self, base_models_dir="models"):
        super().__init__()
        self.base_models_dir = base_models_dir
        self.model = None
        self.metadata = {"projects": [], "history": {"loss": [], "acc": []}, "name": "Distraction Detector"}

    def load_model(self, model_path):
        if os.path.exists(model_path):
            try:
                data = joblib.load(model_path)
                self.model = data.get("model")
                self.metadata = data.get("metadata", {"projects": [], "history": {"loss": [], "acc": []}, "name": "Distraction Detector"})
                self.model_path = model_path
                self.log.emit(f"AI Brain loaded from {os.path.basename(os.path.dirname(model_path))}")
                return True
            except Exception as e:
                self.log.emit(f"Error loading model: {e}")
        return False

    def find_latest_model(self, model_name="distraction_detector"):
        """
        Scans the models folder for the most recent build of a specific model.
        """
        model_root = os.path.join(self.base_models_dir, model_name)
        if not os.path.exists(model_root):
            return None
            
        builds = [d for d in os.listdir(model_root) if os.path.isdir(os.path.join(model_root, d)) and d.startswith("build_")]
        if not builds:
            return None
            
        # Sort by timestamp (build_YYYYMMDD_HHMMSS)
        latest_build = sorted(builds)[-1]
        latest_path = os.path.join(model_root, latest_build, "model.pkl")
        
        if os.path.exists(latest_path):
            return latest_path
        return None

    def train(self, dataset_csv, model_name, epochs, lr, project_paths):
        """
        Trains the model using MLPClassifier to simulate real epochs and updates.
        """
        try:
            self.log.emit("Preparing dataset...")
            df = pd.read_csv(dataset_csv)
            
            features = ['h', 'v', 'h_d', 'v_d', 'speed', 'h_var', 'v_var']
            X = df[features].values
            y = df['label'].values
            
            # If model is new or we want to overwrite, init MLP
            if self.model is None or not isinstance(self.model, MLPClassifier):
                self.log.emit("Initializing new Multi-Layer Perceptron...")
                self.model = MLPClassifier(hidden_layer_sizes=(64, 32), learning_rate_init=lr, random_state=42, max_iter=1)
                
            classes = np.array([0, 1])
            
            # Reset history for this session
            self.metadata["history"] = {"loss": [], "acc": []}
            # Update tracked projects (union)
            self.metadata["projects"] = list(set(self.metadata.get("projects", []) + project_paths))
            self.metadata["name"] = model_name

            self.log.emit(f"Training AI Brain '{model_name}' for {epochs} epochs...")
            
            for epoch in range(1, epochs + 1):
                self.model.partial_fit(X, y, classes=classes)
                
                # Calculate metrics
                y_pred = self.model.predict(X)
                y_prob = self.model.predict_proba(X)
                
                acc = accuracy_score(y, y_pred)
                loss = log_loss(y, y_prob)
                
                self.metadata["history"]["loss"].append(float(loss))
                self.metadata["history"]["acc"].append(float(acc))
                
                self.epoch_progress.emit(epoch, loss, acc)
                
            # Save Model with Versioning
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = model_name.replace(" ", "_").lower()
            version_dir = os.path.join(self.base_models_dir, safe_name, f"build_{timestamp}")
            os.makedirs(version_dir, exist_ok=True)
            
            save_path = os.path.join(version_dir, "model.pkl")
            
            joblib.dump({"model": self.model, "metadata": self.metadata}, save_path)
            
            # Also save metadata as a readable JSON
            with open(os.path.join(version_dir, "metadata.json"), "w") as f:
                json.dump(self.metadata, f, indent=4)
            
            self.log.emit(f"Training complete. Model saved to: {version_dir}")
            self.trained.emit(True)
            return True
        except Exception as e:
            import traceback
            self.log.emit(f"Training failed: {e}")
            traceback.print_exc()
            return False

    def predict_intervals(self, timestamps, h, v):
        """
        Takes signals and returns start/end timestamps of predicted distraction.
        """
        if self.model is None:
            return []
            
        # 1. Prepare Features
        df = pd.DataFrame({
            't': timestamps,
            'h': h,
            'v': v
        })
        df['h_d'] = df['h'].diff().fillna(0)
        df['v_d'] = df['v'].diff().fillna(0)
        df['speed'] = np.sqrt(df['h_d']**2 + df['v_d']**2)
        
        fs = 1.0 / (timestamps[1] - timestamps[0])
        win = int(0.5 * fs)
        df['h_var'] = df['h'].rolling(window=win).var().fillna(0)
        df['v_var'] = df['v'].rolling(window=win).var().fillna(0)
        
        features = ['h', 'v', 'h_d', 'v_d', 'speed', 'h_var', 'v_var']
        
        # 2. Inference
        probs = self.model.predict_proba(df[features])[:, 1]
        
        # 3. Process Probabilities into Intervals
        # Threshold: 0.5 (Standard)
        is_active = probs > 0.5
        
        # Morphological cleanup
        from scipy.ndimage import binary_closing, binary_opening
        is_active = binary_opening(is_active, structure=np.ones(10))
        is_active = binary_closing(is_active, structure=np.ones(20))
        
        diff = np.diff(is_active.astype(int))
        starts = np.where(diff == 1)[0]
        ends = np.where(diff == -1)[0]
        
        if is_active[0]: starts = np.insert(starts, 0, 0)
        if is_active[-1]: ends = np.append(ends, len(is_active)-1)
        
        results = []
        for s, e in zip(starts, ends):
            # Return pairs
            results.append(timestamps[s])
            results.append(timestamps[e])
            
        return results
