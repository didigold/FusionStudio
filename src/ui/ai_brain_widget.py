"""
AImark Pro - ML Training Suite for FusionStudio.
Redesigned with a premium dashboard aesthetic.
"""
import os
import json
import pandas as pd
import numpy as np
import pyqtgraph as pg
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                             QPushButton, QTreeWidget, QTreeWidgetItem, QProgressBar, 
                             QTextEdit, QFrame, QSplitter, QGroupBox, QDoubleSpinBox, QSpinBox, QGridLayout, QFileDialog)
from PySide6.QtCore import Qt, QSize, Signal, Slot
from PySide6.QtGui import QIcon, QFont, QColor
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
        # Main container with dark background
        self.setStyleSheet("background-color: #1e1e1e; color: #eee;")
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(15, 15, 15, 15)
        main_layout.setSpacing(10)

        # Header: Premium Style
        header_frame = QFrame()
        header_frame.setFixedHeight(65)
        header_frame.setStyleSheet("background-color: #252525; border-radius: 8px; border: 1px solid #333;")
        h_header = QHBoxLayout(header_frame)
        h_header.setContentsMargins(20, 0, 20, 0)
        
        lbl_title = QLabel("AImark PRO | ML TRAINING SUITE")
        lbl_title.setFont(QFont("Switzer", 15, QFont.Bold))
        lbl_title.setStyleSheet(f"color: {IDIADA_ORANGE}; letter-spacing: 1.5px;")
        
        h_header.addWidget(lbl_title)
        h_header.addStretch()
        
        # Help and Settings icons
        btn_help = QPushButton()
        btn_help.setIcon(QIcon(resource_path("assets/icons/info_16dp_666666_FILL0_wght400_GRAD0_opsz20.png")))
        btn_help.setIconSize(QSize(20, 20))
        btn_help.setStyleSheet("background: transparent; border: none;")
        btn_help.setCursor(Qt.PointingHandCursor)
        h_header.addWidget(btn_help)
        
        main_layout.addWidget(header_frame)

        # Main Content Area (3 Columns)
        content_splitter = QSplitter(Qt.Horizontal)
        
        # --- COLUMN 1: TRAINING PROJECTS ---
        col1 = QFrame()
        col1.setFixedWidth(300)
        col1.setStyleSheet("background-color: #252525; border-radius: 8px; border: 1px solid #333;")
        l_col1 = QVBoxLayout(col1)
        
        lbl_col1 = QLabel("TRAINING PROJECTS")
        lbl_col1.setFont(QFont("Switzer", 10, QFont.Bold))
        lbl_col1.setStyleSheet("color: #aaa; letter-spacing: 1px; margin-bottom: 5px;")
        l_col1.addWidget(lbl_col1)
        
        self.btn_add_project = QPushButton("  Add Project")
        self.btn_add_project.setIcon(QIcon(resource_path("assets/icons/add_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_add_project.setCursor(Qt.PointingHandCursor)
        self.btn_add_project.setStyleSheet(f"""
            QPushButton {{
                background-color: #2d2d2d; 
                border: 1px solid #444; 
                border-radius: 6px; 
                padding: 10px; 
                color: #fff;
                font-weight: bold;
                text-align: left;
                padding-left: 15px;
            }}
            QPushButton:hover {{ 
                background-color: #383838; 
                border: 1px solid {IDIADA_ORANGE};
            }}
        """)
        l_col1.addWidget(self.btn_add_project)
        
        sep_col1 = QFrame()
        sep_col1.setFrameShape(QFrame.HLine)
        sep_col1.setFrameShadow(QFrame.Sunken)
        sep_col1.setStyleSheet("border-top: 1px solid #444;")
        l_col1.addWidget(sep_col1)
        
        self.tree_projects = QTreeWidget()
        self.tree_projects.setHeaderHidden(True)
        self.tree_projects.setIndentation(20)
        self.tree_projects.setStyleSheet("""
            QTreeWidget { background: transparent; border: none; }
            QTreeWidget::item { padding: 8px; border-radius: 4px; }
            QTreeWidget::item:selected { background-color: #333; color: orange; }
        """)
        l_col1.addWidget(self.tree_projects)
        
        content_splitter.addWidget(col1)
        
        # --- COLUMN 2: SIGNAL PREVIEW ---
        col2 = QFrame()
        col2.setStyleSheet("background-color: #252525; border-radius: 8px; border: 1px solid #333;")
        l_col2 = QVBoxLayout(col2)
        l_col2.setContentsMargins(15, 15, 15, 15)
        
        lbl_col2 = QLabel("SESSION DATA & ANNOTATIONS")
        lbl_col2.setFont(QFont("Switzer", 10, QFont.Bold))
        lbl_col2.setStyleSheet("color: #aaa; letter-spacing: 1px; margin-bottom: 5px;")
        l_col2.addWidget(lbl_col2)
        
        self.preview_plot = pg.PlotWidget()
        self.preview_plot.setBackground('#1e1e1e')
        self.preview_plot.showGrid(x=True, y=True, alpha=0.3)
        l_col2.addWidget(self.preview_plot)
        
        # Playback bar (no background)
        playback_frame = QWidget()
        h_pb = QHBoxLayout(playback_frame)
        h_pb.setContentsMargins(0, 10, 0, 0)
        btn_play = QPushButton()
        btn_play.setIcon(QIcon(resource_path("assets/icons/play_circle_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        btn_play.setIconSize(QSize(24, 24))
        btn_play.setStyleSheet("background: transparent; border: none;")
        btn_play.setCursor(Qt.PointingHandCursor)
        slider_pb = QProgressBar()
        slider_pb.setFixedHeight(6)
        slider_pb.setTextVisible(False)
        slider_pb.setStyleSheet(f"QProgressBar::chunk {{ background-color: {IDIADA_ORANGE}; }}")
        h_pb.addWidget(btn_play)
        h_pb.addWidget(slider_pb)
        l_col2.addWidget(playback_frame)
        
        content_splitter.addWidget(col2)
        
        # --- COLUMN 3: CONFIG & METRICS ---
        col3 = QFrame()
        col3.setFixedWidth(320)
        col3.setStyleSheet("background-color: #252525; border-radius: 8px; border: 1px solid #333;")
        l_col3 = QVBoxLayout(col3)
        l_col3.setContentsMargins(15, 15, 15, 15)
        
        # Config Section
        lbl_cfg = QLabel("Training Configuration")
        lbl_cfg.setFont(QFont("Switzer", 10, QFont.Bold))
        lbl_cfg.setStyleSheet("color: #aaa; letter-spacing: 1px;")
        l_col3.addWidget(lbl_cfg)
        
        cfg_grid = QGridLayout()
        cfg_grid.setSpacing(15)
        cfg_grid.setContentsMargins(5, 10, 5, 10)
        
        # Helper to create styled labels
        def make_field(label_text, value_text):
            lbl = QLabel(label_text)
            lbl.setStyleSheet("color: #ccc; font-weight: bold;")
            val = QLabel(value_text)
            val.setStyleSheet("color: #fff; background-color: transparent; border: none;")
            return lbl, val

        lbl_m, val_m = make_field("Model:", "Distraction Detector")
        cfg_grid.addWidget(lbl_m, 0, 0)
        cfg_grid.addWidget(val_m, 0, 1)
        
        lbl_e, val_e = make_field("Epochs:", "100")
        cfg_grid.addWidget(lbl_e, 1, 0)
        cfg_grid.addWidget(val_e, 1, 1)
        
        lbl_lr, val_lr = make_field("Learning Rate:", "0.0001")
        cfg_grid.addWidget(lbl_lr, 2, 0)
        cfg_grid.addWidget(val_lr, 2, 1)
        
        l_col3.addLayout(cfg_grid)
        
        l_col3.addSpacing(20)
        
        # Metrics Charts
        lbl_metrics = QLabel("MODEL METRICS")
        lbl_metrics.setFont(QFont("Switzer", 10, QFont.Bold))
        lbl_metrics.setStyleSheet("color: #aaa; letter-spacing: 1px;")
        l_col3.addWidget(lbl_metrics)
        
        h_mini_plots = QHBoxLayout()
        self.plot_loss = pg.PlotWidget()
        self.plot_loss.setFixedHeight(120)
        self.plot_loss.setBackground('#1e1e1e')
        self.plot_loss.setLabel('left', 'Loss')
        self.plot_loss.getAxis('bottom').setTicks([])
        self.plot_loss.getAxis('bottom').setStyle(showValues=False)
        self.plot_loss.getAxis('left').setStyle(tickLength=2)
        
        self.plot_acc = pg.PlotWidget()
        self.plot_acc.setFixedHeight(120)
        self.plot_acc.setBackground('#1e1e1e')
        self.plot_acc.setLabel('left', 'Acc')
        self.plot_acc.getAxis('bottom').setTicks([])
        self.plot_acc.getAxis('bottom').setStyle(showValues=False)
        self.plot_acc.getAxis('left').setStyle(tickLength=2)
        
        h_mini_plots.addWidget(self.plot_loss)
        h_mini_plots.addWidget(self.plot_acc)
        l_col3.addLayout(h_mini_plots)
        
        l_col3.addSpacing(10)
        
        # Precision comparison
        comp_frame = QFrame()
        comp_frame.setStyleSheet("background-color: #1e1e1e; border-radius: 6px; border: 1px solid #444;")
        h_comp = QHBoxLayout(comp_frame)
        h_comp.setContentsMargins(15, 15, 15, 15)
        
        v_old = QVBoxLayout()
        v_old.setSpacing(5)
        lbl_old_title = QLabel("Current Model")
        lbl_old_title.setStyleSheet("color: #aaa; font-weight: bold; background: transparent; border: none;")
        v_old.addWidget(lbl_old_title, alignment=Qt.AlignCenter)
        self.lbl_old_prec = QLabel("-- %")
        self.lbl_old_prec.setStyleSheet(f"color: {IDIADA_ORANGE}; font-size: 18pt; font-weight: bold; background: transparent; border: none;")
        v_old.addWidget(self.lbl_old_prec, alignment=Qt.AlignCenter)
        
        v_new = QVBoxLayout()
        v_new.setSpacing(5)
        lbl_new_title = QLabel("New Model")
        lbl_new_title.setStyleSheet("color: #aaa; font-weight: bold; background: transparent; border: none;")
        v_new.addWidget(lbl_new_title, alignment=Qt.AlignCenter)
        self.lbl_new_prec = QLabel("-- %")
        self.lbl_new_prec.setStyleSheet("color: #4caf50; font-size: 18pt; font-weight: bold; background: transparent; border: none;")
        v_new.addWidget(self.lbl_new_prec, alignment=Qt.AlignCenter)
        
        lbl_vs = QLabel("VS")
        lbl_vs.setStyleSheet("color: #666; font-size: 12pt; font-weight: bold; background: transparent; border: none;")
        
        h_comp.addLayout(v_old)
        h_comp.addWidget(lbl_vs)
        h_comp.addLayout(v_new)
        l_col3.addWidget(comp_frame)
        
        l_col3.addStretch()
        
        self.btn_train = QPushButton(" START RETRAINING")
        self.btn_train.setMinimumHeight(55)
        self.btn_train.setCursor(Qt.PointingHandCursor)
        self.btn_train.setIcon(QIcon(resource_path("assets/icons/star_shine_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_train.setIconSize(QSize(20, 20))
        self.btn_train.setStyleSheet("""
            QPushButton {
                background-color: #2da44e; 
                color: white; 
                font-weight: bold; 
                font-size: 11pt; 
                border-radius: 8px;
                border: 1px solid #238636;
            }
            QPushButton:hover { 
                background-color: #3fb950; 
                border: 1px solid #2ea043;
            }
            QPushButton:disabled { 
                background-color: #333; 
                color: #666; 
                border: 1px solid #444;
            }
        """)
        l_col3.addWidget(self.btn_train)
        
        content_splitter.addWidget(col3)
        content_splitter.setStretchFactor(0, 0)
        content_splitter.setStretchFactor(1, 1)
        content_splitter.setStretchFactor(2, 0)
        content_splitter.setSizes([300, 800, 320])
        
        main_layout.addWidget(content_splitter)

        # Footer Status
        footer_status = QFrame()
        footer_status.setFixedHeight(30)
        h_footer = QHBoxLayout(footer_status)
        h_footer.setContentsMargins(5,0,5,0)
        
        self.lbl_footer_status = QLabel("● AI Ready")
        self.lbl_footer_status.setStyleSheet("color: #4caf50; font-weight: bold;")
        h_footer.addWidget(self.lbl_footer_status)
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setFixedWidth(300)
        self.progress_bar.setFixedHeight(8)
        self.progress_bar.setTextVisible(False)
        self.progress_bar.setStyleSheet(f"QProgressBar::chunk {{ background-color: {IDIADA_ORANGE}; }}")
        h_footer.addWidget(self.progress_bar)
        
        self.lbl_task_info = QLabel("IDLE")
        self.lbl_task_info.setStyleSheet("color: #888;")
        h_footer.addWidget(self.lbl_task_info)
        h_footer.addStretch()
        
        main_layout.addWidget(footer_status)

    def setup_connections(self):
        self.btn_add_project.clicked.connect(self.add_project)
        self.btn_train.clicked.connect(self.start_training)
        self.tree_projects.itemClicked.connect(self.on_item_clicked)
        
        self.dataset_builder.log.connect(self.log_status)
        self.dataset_builder.progress.connect(self.update_progress)
        self.dataset_builder.finished.connect(self.on_dataset_ready)

    def add_project(self):
        d = QFileDialog.getExistingDirectory(self, "Select Project Folder")
        if d:
            self._add_project_to_tree(d)

    def _add_project_to_tree(self, path):
        project_name = os.path.basename(path)
        item = QTreeWidgetItem(self.tree_projects)
        item.setText(0, project_name)
        item.setData(0, Qt.UserRole, path)
        item.setIcon(0, QIcon(resource_path("assets/icons/folder_open_16dp_FFFF55_FILL1_wght400_GRAD0_opsz20.png")))
        
        # Scan for marks.json
        marks_file = os.path.join(path, "marks.json")
        if os.path.exists(marks_file):
            child = QTreeWidgetItem(item)
            child.setText(0, "marks.json")
            child.setData(0, Qt.UserRole, marks_file)
            child.setIcon(0, QIcon(resource_path("assets/icons/account_tree_16dp_FD4949_FILL1_wght400_GRAD0_opsz20.png")))
            item.setExpanded(True)

    def on_item_clicked(self, item, col):
        path = item.data(0, Qt.UserRole)
        if path and path.endswith("marks.json"):
            self.preview_marks(path)

    def preview_marks(self, marks_path):
        """Loads first available case from marks.json into the central plot."""
        try:
            with open(marks_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not data: return
            
            first_case = list(data.keys())[0]
            timestamps = data[first_case]
            
            # Find matching MF4
            root = os.path.dirname(marks_path)
            mf4_path = self.dataset_builder._resolve_mf4_path(root, first_case)
            
            if mf4_path and os.path.exists(mf4_path):
                self.lbl_task_info.setText(f"Visualizing: {first_case}")
                self._plot_mf4_with_markers(mf4_path, timestamps)
        except Exception as e:
            self.log_status(f"Preview error: {e}")

    def _plot_mf4_with_markers(self, mf4_path, markers):
        from asammdf import MDF
        mdf = MDF(mf4_path)
        engine = "OWL" if "Head_H_Angle" in mdf else "LIZ"
        sig_name = "Head_H_Angle" if engine == "OWL" else "H_Ratio"
        sig = mdf.get(sig_name)
        
        self.preview_plot.clear()
        self.preview_plot.plot(sig.timestamps, sig.samples, pen=pg.mkPen(IDIADA_ORANGE, width=1))
        
        # Add shaded regions
        for i in range(0, len(markers), 2):
            if i+1 < len(markers):
                lr = pg.LinearRegionItem([markers[i], markers[i+1]], movable=False, brush=pg.mkBrush(255, 152, 0, 80))
                self.preview_plot.addItem(lr)

    def log_status(self, msg):
        self.lbl_task_info.setText(msg)

    def update_progress(self, val):
        self.progress_bar.setValue(int(val * 100))

    def start_training(self):
        # Implementation for training...
        pass

    def on_dataset_ready(self, csv_path):
        # Implementation for model training...
        pass
