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
                             QTextEdit, QFrame, QSplitter, QGroupBox, QDoubleSpinBox, QSpinBox, QGridLayout, QFileDialog, QLineEdit)
from PySide6.QtCore import Qt, QSize, Signal, Slot, QTimer, Property, QEasingCurve, QPropertyAnimation
from PySide6.QtGui import QIcon, QFont, QColor, QPainter, QLinearGradient, QImage, QFontMetrics
from src.core.dataset_builder import DatasetBuilder
from src.core.ml_engine import MLEngine
from src.core.utils import resource_path
from src.ui.styles import IDIADA_ORANGE, LOGIC_INPUT_STYLE
from src.ui.widgets import AnimatedExpandButton

class MarqueeLabel(QWidget):
    def __init__(self, text, parent=None):
        super().__init__(parent)
        self.text = text
        self.offset = 0
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.scroll_text)
        self.font_obj = QFont("Switzer", 10, QFont.Normal)
        self.setAttribute(Qt.WA_TransparentForMouseEvents)

    def showEvent(self, event):
        fm = QFontMetrics(self.font_obj)
        if fm.horizontalAdvance(self.text) > self.width():
            self.timer.start(30)
        super().showEvent(event)

    def scroll_text(self):
        self.offset -= 1
        fm = QFontMetrics(self.font_obj)
        if self.offset < -fm.horizontalAdvance(self.text) - 20:
            self.offset = self.width()
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        fm = QFontMetrics(self.font_obj)
        text_width = fm.horizontalAdvance(self.text)

        if text_width <= self.width():
            painter.setFont(self.font_obj)
            painter.setPen(QColor(255, 255, 255))
            painter.drawText(self.rect(), Qt.AlignLeft | Qt.AlignVCenter, self.text)
            return

        img = QImage(self.size(), QImage.Format_ARGB32_Premultiplied)
        img.fill(Qt.transparent)
        
        img_painter = QPainter(img)
        img_painter.setFont(self.font_obj)
        img_painter.setPen(QColor(255, 255, 255))
        
        y = (self.height() + fm.ascent() - fm.descent()) // 2
        img_painter.drawText(self.offset, y, self.text)
        
        img_painter.setCompositionMode(QPainter.CompositionMode_DestinationIn)
        gradient = QLinearGradient(0, 0, self.width(), 0)
        gradient.setColorAt(0, QColor(0, 0, 0, 0))
        gradient.setColorAt(0.1, QColor(0, 0, 0, 255))
        gradient.setColorAt(0.9, QColor(0, 0, 0, 255))
        gradient.setColorAt(1, QColor(0, 0, 0, 0))
        img_painter.fillRect(self.rect(), gradient)
        img_painter.end()

        painter.drawImage(0, 0, img)

class ProjectExpandButton(QPushButton):
    _icon_rotation = Property(int, lambda self: self.__icon_rotation, lambda self, val: self.set_icon_rotation(val))

    def __init__(self, text, parent=None):
        super().__init__(parent)
        self.setCursor(Qt.PointingHandCursor)
        self.setFixedHeight(45)
        self.setStyleSheet("""
            QPushButton {
                background-color: transparent; border: none; border-radius: 6px;
            }
            QPushButton:hover { background-color: #333; }
        """)
        
        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 0, 10, 0)
        
        self.lbl_icon = QLabel()
        self.lbl_icon.setPixmap(QIcon(resource_path("assets/icons/folder_open_16dp_FFFF55_FILL1_wght400_GRAD0_opsz20.png")).pixmap(16, 16))
        layout.addWidget(self.lbl_icon)
        
        self.marquee = MarqueeLabel(text)
        layout.addWidget(self.marquee, 1)
        
        self.lbl_arrow = QLabel()
        self.arrow_pixmap = QIcon(resource_path("assets/icons/keyboard_arrow_up_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")).pixmap(16, 16)
        self.lbl_arrow.setPixmap(self.arrow_pixmap)
        layout.addWidget(self.lbl_arrow)
        
        self.__icon_rotation = 180
        self.set_icon_rotation(180)
        self.is_expanded = True
        
        self.anim = QPropertyAnimation(self, b"_icon_rotation")
        self.anim.setDuration(300)
        self.anim.setEasingCurve(QEasingCurve.InOutQuad)

    def set_icon_rotation(self, val):
        self.__icon_rotation = val
        from PySide6.QtGui import QTransform
        transform = QTransform().rotate(val)
        self.lbl_arrow.setPixmap(self.arrow_pixmap.transformed(transform, Qt.SmoothTransformation))

    def toggle(self):
        self.anim.stop()
        if self.is_expanded:
            self.anim.setStartValue(self.__icon_rotation)
            self.anim.setEndValue(0)
            self.is_expanded = False
        else:
            self.anim.setStartValue(self.__icon_rotation)
            self.anim.setEndValue(180)
            self.is_expanded = True
        self.anim.start()

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

        # Header Removed

        # Main Content Area (3 Columns)
        content_splitter = QSplitter(Qt.Horizontal)
        
        # --- COLUMN 1: TRAINING PROJECTS ---
        col1 = QFrame()
        col1.setMinimumWidth(250)
        col1.setStyleSheet("background-color: transparent; border: none;")
        l_col1 = QVBoxLayout(col1)
        
        lbl_col1 = QLabel("Training projects")
        lbl_col1.setFont(QFont("Switzer", 10, QFont.DemiBold))
        lbl_col1.setStyleSheet("color: white; margin-bottom: 5px;")
        l_col1.addWidget(lbl_col1)
        
        self.btn_add_project = QPushButton("  Add Project")
        self.btn_add_project.setIcon(QIcon(resource_path("assets/icons/add_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_add_project.setCursor(Qt.PointingHandCursor)
        self.btn_add_project.setStyleSheet("""
            QPushButton {
                background-color: #2d2d2d; 
                border: 1px solid #444; 
                border-radius: 6px; 
                padding: 10px; 
                color: #d3d3d3;
                font-family: Switzer;
                font-weight: 600;
                text-align: left;
                padding-left: 15px;
            }
            QPushButton:hover { 
                background-color: #383838; 
                border: 1px solid #888;
            }
        """)
        l_col1.addWidget(self.btn_add_project)
        
        sep_col1 = QFrame()
        sep_col1.setFrameShape(QFrame.HLine)
        sep_col1.setFrameShadow(QFrame.Sunken)
        sep_col1.setStyleSheet("border-top: 1px solid rgba(255,255,255,40); background: transparent;")
        l_col1.addWidget(sep_col1)
        
        # We will use a scroll area for custom animated folders
        from PySide6.QtWidgets import QScrollArea
        self.scroll_projects = QScrollArea()
        self.scroll_projects.setWidgetResizable(True)
        self.scroll_projects.setStyleSheet("background: transparent; border: none;")
        
        self.container_projects = QWidget()
        self.container_projects.setStyleSheet("background: transparent; border: none;")
        self.layout_projects = QVBoxLayout(self.container_projects)
        self.layout_projects.setAlignment(Qt.AlignTop)
        self.layout_projects.setContentsMargins(0,0,0,0)
        self.layout_projects.setSpacing(0)
        
        self.scroll_projects.setWidget(self.container_projects)
        l_col1.addWidget(self.scroll_projects)
        
        content_splitter.addWidget(col1)
        
        # --- COLUMN 2: SIGNAL PREVIEW ---
        col2 = QFrame()
        col2.setStyleSheet("background-color: transparent; border: none;")
        l_col2 = QVBoxLayout(col2)
        l_col2.setContentsMargins(15, 15, 15, 15)
        
        lbl_col2 = QLabel("Session data & annotations")
        lbl_col2.setFont(QFont("Switzer", 10, QFont.DemiBold))
        lbl_col2.setStyleSheet("color: white; margin-bottom: 5px;")
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
        col3.setMinimumWidth(250)
        col3.setStyleSheet("background-color: transparent; border: none;")
        l_col3 = QVBoxLayout(col3)
        l_col3.setContentsMargins(15, 15, 15, 15)
        
        # Config Section
        lbl_cfg = QLabel("Training configuration")
        lbl_cfg.setFont(QFont("Switzer", 10, QFont.DemiBold))
        lbl_cfg.setStyleSheet("color: white;")
        l_col3.addWidget(lbl_cfg)
        
        cfg_grid = QGridLayout()
        cfg_grid.setSpacing(15)
        cfg_grid.setContentsMargins(5, 10, 5, 10)
        
        MODERN_INPUT = """
            QWidget {
                background-color: #2b2b2b;
                color: white;
                border: 1px solid #444;
                border-radius: 4px;
                padding: 6px;
            }
            QWidget:focus { border: 1px solid #888; }
            QSpinBox::up-button, QSpinBox::down-button, QDoubleSpinBox::up-button, QDoubleSpinBox::down-button { width: 0px; }
        """
        
        lbl_m = QLabel("Model Name:")
        lbl_m.setStyleSheet("color: #ccc;")
        self.txt_model = QLineEdit("Distraction Detector")
        self.txt_model.setStyleSheet(MODERN_INPUT)
        cfg_grid.addWidget(lbl_m, 0, 0)
        cfg_grid.addWidget(self.txt_model, 0, 1)
        
        lbl_e = QLabel("Epochs:")
        lbl_e.setStyleSheet("color: #ccc;")
        self.spin_epochs = QSpinBox()
        self.spin_epochs.setRange(1, 1000)
        self.spin_epochs.setValue(100)
        self.spin_epochs.setStyleSheet(MODERN_INPUT)
        cfg_grid.addWidget(lbl_e, 1, 0)
        cfg_grid.addWidget(self.spin_epochs, 1, 1)
        
        lbl_lr = QLabel("Learning Rate:")
        lbl_lr.setStyleSheet("color: #ccc;")
        self.spin_lr = QDoubleSpinBox()
        self.spin_lr.setRange(0.0001, 1.0)
        self.spin_lr.setSingleStep(0.0001)
        self.spin_lr.setDecimals(4)
        self.spin_lr.setValue(0.0001)
        self.spin_lr.setStyleSheet(MODERN_INPUT)
        cfg_grid.addWidget(lbl_lr, 2, 0)
        cfg_grid.addWidget(self.spin_lr, 2, 1)
        
        l_col3.addLayout(cfg_grid)
        
        l_col3.addSpacing(20)
        
        # Metrics Charts
        lbl_metrics = QLabel("Model metrics")
        lbl_metrics.setFont(QFont("Switzer", 10, QFont.DemiBold))
        lbl_metrics.setStyleSheet("color: white;")
        l_col3.addWidget(lbl_metrics)
        
        h_mini_plots = QHBoxLayout()
        
        font_light = QFont("Switzer", 8, QFont.Light)
        
        self.plot_loss = pg.PlotWidget()
        self.plot_loss.setMinimumHeight(180)
        self.plot_loss.setBackground('#1e1e1e')
        self.plot_loss.setLabel('left', 'Loss')
        self.plot_loss.getAxis('left').setTickFont(font_light)
        self.plot_loss.getAxis('bottom').setTicks([])
        self.plot_loss.getAxis('bottom').setStyle(showValues=False)
        self.plot_loss.getAxis('left').setStyle(tickLength=2)
        try:
            self.plot_loss.getViewBox().setDefaultPadding(0.2)
        except Exception:
            pass
        
        self.plot_acc = pg.PlotWidget()
        self.plot_acc.setMinimumHeight(180)
        self.plot_acc.setBackground('#1e1e1e')
        self.plot_acc.setLabel('left', 'Acc')
        self.plot_acc.getAxis('left').setTickFont(font_light)
        self.plot_acc.getAxis('bottom').setTicks([])
        self.plot_acc.getAxis('bottom').setStyle(showValues=False)
        self.plot_acc.getAxis('left').setStyle(tickLength=2)
        try:
            self.plot_acc.getViewBox().setDefaultPadding(0.2)
        except Exception:
            pass
        
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
        h_comp.addWidget(lbl_vs, alignment=Qt.AlignCenter)
        h_comp.addLayout(v_new)
        l_col3.addWidget(comp_frame)
        
        l_col3.addStretch()
        
        self.btn_train = QPushButton(" START RETRAINING")
        self.btn_train.setMinimumHeight(55)
        self.btn_train.setCursor(Qt.PointingHandCursor)
        self.btn_train.setIcon(QIcon(resource_path("assets/icons/model_training_24dp_2B2B2B_FILL0_wght400_GRAD0_opsz24.png")))
        self.btn_train.setIconSize(QSize(24, 24))
        self.btn_train.setStyleSheet("""
            QPushButton {
                background-color: #2da44e; 
                color: #2b2b2b; 
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
        content_splitter.setStretchFactor(0, 1)
        content_splitter.setStretchFactor(1, 2)
        content_splitter.setStretchFactor(2, 1)
        content_splitter.setSizes([350, 600, 350])
        
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
        
        self.dataset_builder.log.connect(self.log_status)
        self.dataset_builder.progress.connect(self.update_progress)
        self.dataset_builder.finished.connect(self.on_dataset_ready)

    def add_project(self):
        d = QFileDialog.getExistingDirectory(self, "Select Project Folder")
        if d:
            self._add_project_to_tree(d)

    def _add_project_to_tree(self, path):
        parts = os.path.normpath(path).split(os.sep)
        project_name = os.sep.join(parts[-5:]) if len(parts) >= 5 else path
        
        # Project Container
        proj_container = QWidget()
        proj_layout = QVBoxLayout(proj_container)
        proj_layout.setContentsMargins(0, 5, 0, 0)
        proj_layout.setSpacing(0)
        
        # Expand Button
        btn_expand = ProjectExpandButton(project_name)
        proj_layout.addWidget(btn_expand)
        
        # Content Area
        content_widget = QWidget()
        content_layout = QVBoxLayout(content_widget)
        content_layout.setContentsMargins(30, 0, 0, 0)
        content_layout.setSpacing(5)
        
        # Scan for marks.json
        marks_file = os.path.join(path, "marks.json")
        if os.path.exists(marks_file):
            btn_file = QPushButton("  marks.json")
            btn_file.setIcon(QIcon(resource_path("assets/icons/account_tree_16dp_FD4949_FILL1_wght400_GRAD0_opsz20.png")))
            btn_file.setStyleSheet("""
                QPushButton {
                    background: transparent; color: #aaa; text-align: left; padding: 5px; border: none; border-radius: 4px;
                    font-weight: normal;
                }
                QPushButton:hover { color: orange; background-color: #333; }
            """)
            btn_file.setCursor(Qt.PointingHandCursor)
            btn_file.clicked.connect(lambda: self.preview_marks(marks_file))
            content_layout.addWidget(btn_file)
            
        proj_layout.addWidget(content_widget)
        
        # Connection for smooth animation
        # Create an animation for the content height
        anim_height = QPropertyAnimation(content_widget, b"maximumHeight")
        anim_height.setDuration(300)
        anim_height.setEasingCurve(QEasingCurve.InOutQuad)
        
        # We need to set an initial high maximum height for normal layout constraints
        content_widget.setMaximumHeight(500)
        
        def toggle_content():
            anim_height.stop()
            if btn_expand.is_expanded:
                content_widget.setVisible(True)
                anim_height.setStartValue(0)
                anim_height.setEndValue(100) # Enough height for the marks file button
            else:
                anim_height.setStartValue(content_widget.height())
                anim_height.setEndValue(0)
            anim_height.start()
            
        def on_anim_finished():
            if not btn_expand.is_expanded:
                content_widget.setVisible(False)
            else:
                # restore maximum height so it's not constrained if more items are added
                content_widget.setMaximumHeight(500)
                
        anim_height.finished.connect(on_anim_finished)

        btn_expand.clicked.connect(btn_expand.toggle)
        btn_expand.clicked.connect(toggle_content)

        
        self.layout_projects.addWidget(proj_container)

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
