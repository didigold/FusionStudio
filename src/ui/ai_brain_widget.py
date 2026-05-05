"""
AI Brain Widget for FusionStudio.
A professional training center for Machine Learning models.
"""
import os
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                             QPushButton, QListWidget, QFileDialog, QProgressBar, 
                             QTextEdit, QFrame)
from PySide6.QtCore import Qt, QSize
from PySide6.QtGui import QIcon, QFont
from src.core.dataset_builder import DatasetBuilder
from src.core.ml_engine import MLEngine
from src.core.utils import resource_path
from src.ui.styles import IDIADA_ORANGE, LOGIC_INPUT_STYLE

class AIBrainWidget(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.dataset_builder = DatasetBuilder()
        self.ml_engine = MLEngine()
        self.init_ui()
        self.setup_connections()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)

        # Header
        header = QLabel("AI Training Center")
        header.setFont(QFont("Segoe UI", 16, QFont.Bold))
        header.setStyleSheet(f"color: {IDIADA_ORANGE};")
        layout.addWidget(header)

        # Description
        desc = QLabel("Feed the AI with your manual marks from past projects to improve detection accuracy.")
        desc.setWordWrap(True)
        desc.setStyleSheet("color: #aaa;")
        layout.addWidget(desc)

        # Main Split
        main_h = QHBoxLayout()
        
        # Left Side: Dataset Management
        left_v = QVBoxLayout()
        left_v.addWidget(QLabel("<b>Training Datasets:</b>"))
        self.list_paths = QListWidget()
        self.list_paths.setStyleSheet("background: #1e1e1e; border: 1px solid #333; border-radius: 4px; color: #ccc;")
        left_v.addWidget(self.list_paths)

        btn_row = QHBoxLayout()
        self.btn_add_folder = QPushButton(" Add Folder")
        self.btn_add_folder.setIcon(QIcon(resource_path("assets/icons/folder_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_remove_folder = QPushButton(" Remove")
        btn_row.addWidget(self.btn_add_folder)
        btn_row.addWidget(self.btn_remove_folder)
        left_v.addLayout(btn_row)
        
        main_h.addLayout(left_v, 2)

        # Right Side: Controls
        right_v = QVBoxLayout()
        right_v.setSpacing(10)
        
        self.frame_status = QFrame()
        self.frame_status.setStyleSheet("background: #252525; border-radius: 8px; border: 1px solid #333;")
        status_l = QVBoxLayout(self.frame_status)
        
        self.lbl_status = QLabel("Model: <b>Not Trained</b>")
        self.lbl_samples = QLabel("Samples: 0")
        status_l.addWidget(self.lbl_status)
        status_l.addWidget(self.lbl_samples)
        
        right_v.addWidget(self.frame_status)
        
        self.btn_train = QPushButton("  RETRAIN AI BRAIN")
        self.btn_train.setMinimumHeight(50)
        self.btn_train.setIcon(QIcon(resource_path("assets/icons/star_shine_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_train.setStyleSheet(f"""
            QPushButton {{
                background-color: {IDIADA_ORANGE};
                color: black;
                font-weight: bold;
                font-size: 11pt;
                border-radius: 6px;
            }}
            QPushButton:hover {{ background-color: #ffb74d; }}
            QPushButton:disabled {{ background-color: #333; color: #666; }}
        """)
        right_v.addWidget(self.btn_train)
        
        right_v.addStretch()
        main_h.addLayout(right_v, 1)
        
        layout.addLayout(main_h)

        # Progress
        self.progress = QProgressBar()
        self.progress.setStyleSheet("QProgressBar { height: 8px; }")
        self.progress.hide()
        layout.addWidget(self.progress)

        # Console
        self.console = QTextEdit()
        self.console.setReadOnly(True)
        self.console.setMaximumHeight(150)
        self.console.setStyleSheet("background: #000; color: #0f0; font-family: Consolas; border: 1px solid #333;")
        layout.addWidget(self.console)
        
        self.update_ui_state()

    def setup_connections(self):
        self.btn_add_folder.clicked.connect(self.add_folder)
        self.btn_remove_folder.clicked.connect(self.remove_selected)
        self.btn_train.clicked.connect(self.start_training)
        
        self.dataset_builder.log.connect(self.log)
        self.dataset_builder.progress.connect(self.progress.setValue)
        self.dataset_builder.finished.connect(self.on_dataset_ready)
        self.dataset_builder.error.connect(lambda e: self.log(f"Error: {e}"))
        
        self.ml_engine.log.connect(self.log)

    def add_folder(self):
        d = QFileDialog.getExistingDirectory(self, "Select Project Folder")
        if d:
            self.list_paths.addItem(d)

    def remove_selected(self):
        for item in self.list_paths.selectedItems():
            self.list_paths.takeItem(self.list_paths.row(item))

    def update_ui_state(self):
        has_model = self.ml_engine.model is not None
        self.lbl_status.setText(f"Model: <b style='color: {'#4caf50' if has_model else '#f44336'}'>{'Active' if has_model else 'Not Trained'}</b>")

    def log(self, msg):
        self.console.append(f"> {msg}")
        sb = self.console.verticalScrollBar()
        sb.setValue(sb.maximum())

    def start_training(self):
        paths = [self.list_paths.item(i).text() for i in range(self.list_paths.count())]
        if not paths:
            self.log("Error: No training folders added.")
            return
            
        self.btn_train.setEnabled(False)
        self.progress.show()
        self.progress.setValue(0)
        
        # Build dataset in background
        import threading
        t = threading.Thread(target=self.dataset_builder.build_from_folders, 
                           args=(paths, "temp/training_data.csv"))
        t.start()

    def on_dataset_ready(self, csv_path):
        self.log("Dataset ready. Starting ML training...")
        success = self.ml_engine.train(csv_path)
        self.btn_train.setEnabled(True)
        self.progress.hide()
        self.update_ui_state()
        if success:
            from PySide6.QtWidgets import QMessageBox
            QMessageBox.information(self, "AI Update", "Your AI Brain has been updated successfully with new data!")
