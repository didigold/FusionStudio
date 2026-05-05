"""
ML Engine for FusionStudio - Model training and inference.
"""
import os
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from PySide6.QtCore import QObject, Signal

class MLEngine(QObject):
    log = Signal(str)
    trained = Signal(bool)

    def __init__(self, model_path="models/gaze_model.pkl"):
        super().__init__()
        self.model_path = model_path
        self.model = None
        self.load_model()

    def load_model(self):
        if os.path.exists(self.model_path):
            try:
                self.model = joblib.load(self.model_path)
                self.log.emit("AI Brain loaded successfully.")
                return True
            except Exception as e:
                self.log.emit(f"Error loading model: {e}")
        return False

    def train(self, dataset_csv):
        """
        Trains the model using the provided CSV.
        """
        try:
            self.log.emit("Training AI Brain... this may take a moment.")
            df = pd.read_csv(dataset_csv)
            
            # Features to use
            features = ['h', 'v', 'h_d', 'v_d', 'speed', 'h_var', 'v_var']
            X = df[features]
            y = df['label']
            
            # Train Random Forest
            self.model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
            self.model.fit(X, y)
            
            # Save
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            joblib.dump(self.model, self.model_path)
            
            self.log.emit("AI Brain update complete. Model saved.")
            self.trained.emit(True)
            return True
        except Exception as e:
            self.log.emit(f"Training failed: {e}")
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
