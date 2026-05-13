"""
AImark Pro - ML Training Suite for FusionStudio.
v3.0: Multimodal (CNN+LSTM) + Legacy MLP support.
Redesigned with a premium dashboard aesthetic.
"""
import os
import json
import re
import glob
import pandas as pd
import numpy as np
import pyqtgraph as pg
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                             QPushButton, QTreeWidget, QTreeWidgetItem, QProgressBar, 
                             QTextEdit, QFrame, QSplitter, QGroupBox, QDoubleSpinBox, QSpinBox, 
                             QGridLayout, QFileDialog, QLineEdit, QComboBox, QScrollArea, QTabWidget, QSlider)
from PySide6.QtCore import Qt, QSize, Signal, Slot, QTimer, Property, QEasingCurve, QPropertyAnimation, QThread, QMimeData, QPoint
from PySide6.QtGui import QIcon, QFont, QColor, QPainter, QLinearGradient, QImage, QFontMetrics, QDrag, QDragEnterEvent, QDropEvent
from src.core.dataset_builder import DatasetBuilder
from src.core.ml_engine import MLEngine
from src.core.multimodal_engine import MultimodalTrainer
from src.core.video_feature_extractor import VideoFeatureExtractor, VideoExtractionWorker
from src.core.utils import resource_path
from src.ui.styles import IDIADA_ORANGE, LOGIC_INPUT_STYLE
from src.ui.widgets import AnimatedExpandButton, AnimatedToggle, PulsingProgressBar, setup_tab_icon_switching
import time

class ClickableLineEdit(QLineEdit):
    clicked = Signal()
    def mousePressEvent(self, event):
        super().mousePressEvent(event)
        self.clicked.emit()

class TrainingWorker(QThread):
    finished_ok = Signal()
    failed = Signal(str)

    def __init__(self, builder, engine, root_folders, csv_path, model_name, epochs, lr, parent=None):
        super().__init__(parent)
        self.builder = builder
        self.engine = engine
        self.root_folders = root_folders
        self.csv_path = csv_path
        self.model_name = model_name
        self.epochs = epochs
        self.lr = lr

    def run(self):
        try:
            built_ok = self.builder.build_from_folders(self.root_folders, self.csv_path)
            if not built_ok:
                self.failed.emit("Failed to generate training dataset. Check if mf4 tracking files exist.")
                return
                
            success = self.engine.train(self.csv_path, self.model_name, self.epochs, self.lr, self.root_folders)
            if success:
                self.finished_ok.emit()
            else:
                self.failed.emit("Model training failed.")
        except Exception as e:
            self.failed.emit(str(e))


class MultimodalTrainingWorker(QThread):
    phase_changed = Signal(str)
    extraction_progress = Signal(float)
    current_video = Signal(str)
    dataset_progress = Signal(float)

    def __init__(self, builder, trainer, extractor, root_folders, output_dir, model_name, epochs, lr, camera_config=None, patience=15, parent=None):
        super().__init__(parent)
        self.builder = builder
        self.trainer = trainer
        self.extractor = extractor
        self.root_folders = root_folders
        self.output_dir = output_dir
        self.model_name = model_name
        self.epochs = epochs
        self.lr = lr
        self.camera_config = camera_config or {}
        self.patience = patience
        self._result = None

    def run(self):
        try:
            self.phase_changed.emit("extracting")
            video_tasks = []
            for folder in self.root_folders:
                marks_path = os.path.join(folder, "marks.json")
                if not os.path.exists(marks_path):
                    continue
                import glob
                mf4_files = glob.glob(os.path.join(folder, "**", "*_tracking.mf4"), recursive=True)
                norm_folder = os.path.normpath(folder)
                cam_hint = self.camera_config.get(folder, self.camera_config.get(norm_folder, "auto"))
                for mf4 in mf4_files:
                    case_key = os.path.splitext(os.path.basename(mf4))[0]
                    video_path = VideoFeatureExtractor.find_video_for_mf4(mf4, camera_hint=cam_hint)
                    if video_path and os.path.exists(video_path):
                        video_tasks.append((video_path, case_key))
                    else:
                        base = mf4.replace("_tracking.mf4", ".mf4").replace("_tracking.MF4", ".MF4")
                        video_path = VideoFeatureExtractor.find_video_for_mf4(base, camera_hint=cam_hint) if os.path.exists(base) else None
                        if video_path and os.path.exists(video_path):
                            video_tasks.append((video_path, case_key))

            for i, (vpath, ckey) in enumerate(video_tasks):
                self.current_video.emit(os.path.basename(vpath))
                self.extractor.extract_to_cache(vpath, ckey)
                self.extraction_progress.emit((i + 1) / max(len(video_tasks), 1))

            self.phase_changed.emit("building")
            self._result = self.builder.build_multimodal_from_folders(
                self.root_folders, self.output_dir, video_extractor=self.extractor, project_camera_config=self.camera_config
            )
            if self._result is None:
                self.phase_changed.emit("failed")
                return

            self.phase_changed.emit("training")
            success = self.trainer.train(
                self._result["signal_windows"],
                self._result["video_windows"],
                self._result["labels"],
                self._result["project_ids"],
                self.model_name, self.epochs, self.lr,
                self.root_folders, self.patience
            )
            if not success:
                self.phase_changed.emit("failed")
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.phase_changed.emit(f"error:{str(e)}")

class MarqueeLabel(QWidget):
    def __init__(self, text, parent=None):
        super().__init__(parent)
        self.text = text
        self.offset = 0
        self.is_running = False
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.scroll_text)
        self.font_obj = QFont("Switzer", 10, QFont.Normal)
        self.setAttribute(Qt.WA_TransparentForMouseEvents, True)
        
        self.hover_timer = QTimer(self)
        self.hover_timer.setSingleShot(True)
        self.hover_timer.timeout.connect(self.start)

    def start(self):
        fm = QFontMetrics(self.font_obj)
        if fm.horizontalAdvance(self.text) > self.width():
            self.is_running = True
            self.timer.start(30)

    def stop(self):
        self.is_running = False
        self.timer.stop()
        self.offset = 0
        self.update()

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
        
        if self.is_running:
            img_painter.drawText(self.offset, y, self.text)
        else:
            img_painter.drawText(0, y, self.text)
        
        img_painter.setCompositionMode(QPainter.CompositionMode_DestinationIn)
        gradient = QLinearGradient(0, 0, self.width(), 0)
        
        if self.is_running:
            gradient.setColorAt(0, QColor(0, 0, 0, 0))
            gradient.setColorAt(0.1, QColor(0, 0, 0, 255))
            gradient.setColorAt(0.9, QColor(0, 0, 0, 255))
            gradient.setColorAt(1, QColor(0, 0, 0, 0))
        else:
            # Fade only right when static
            gradient.setColorAt(0, QColor(0, 0, 0, 255))
            gradient.setColorAt(0.85, QColor(0, 0, 0, 255))
            gradient.setColorAt(1, QColor(0, 0, 0, 0))
            
        img_painter.fillRect(self.rect(), gradient)
        img_painter.end()

        painter.drawImage(0, 0, img)

class RotatingIconLabel(QLabel):
    def __init__(self, pixmap, parent=None):
        super().__init__(parent)
        self.orig_pixmap = pixmap
        self.rotation = 0
        self.setFixedSize(16, 16)

    def set_rotation(self, angle):
        self.rotation = angle
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setRenderHint(QPainter.SmoothPixmapTransform)
        
        painter.translate(self.width()/2, self.height()/2)
        painter.rotate(self.rotation)
        painter.drawPixmap(-self.orig_pixmap.width()/2, -self.orig_pixmap.height()/2, self.orig_pixmap)

class ProjectExpandButton(QPushButton):
    _icon_rotation = Property(int, lambda self: self.__icon_rotation, lambda self, val: self.set_icon_rotation(val))

    def __init__(self, text, full_path, parent=None):
        super().__init__(parent)
        self.full_path = full_path
        self.setCheckable(True)
        self.setCursor(Qt.PointingHandCursor)
        self.setFixedHeight(45)
        self.setStyleSheet("""
            QPushButton {
                background-color: transparent; border: none; border-radius: 6px;
            }
            QPushButton:hover { background-color: #333; }
            QPushButton:checked { background-color: #3a3a3a; }
        """)
        
        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 0, 10, 0)
        
        self.lbl_icon = QLabel()
        layout.addWidget(self.lbl_icon)
        
        self.marquee = MarqueeLabel(text)
        layout.addWidget(self.marquee, 1)
        
        self.arrow_pixmap = QIcon(resource_path("assets/icons/keyboard_arrow_up_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")).pixmap(16, 16)
        self.lbl_arrow = RotatingIconLabel(self.arrow_pixmap)
        layout.addWidget(self.lbl_arrow)
        
        self.__icon_rotation = 180
        self.lbl_arrow.set_rotation(180)
        self.is_expanded = True
        
        self.anim = QPropertyAnimation(self, b"_icon_rotation")
        self.anim.setDuration(300)
        self.anim.setEasingCurve(QEasingCurve.InOutQuad)
        
        self.clicked.connect(self.handle_click)

    def enterEvent(self, event):
        self.marquee.hover_timer.start(1000)
        super().enterEvent(event)

    def leaveEvent(self, event):
        self.marquee.hover_timer.stop()
        self.marquee.stop()
        super().leaveEvent(event)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self._drag_start_pos = event.pos()
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.LeftButton and hasattr(self, '_drag_start_pos'):
            if (event.pos() - self._drag_start_pos).manhattanLength() >= 10:
                drag = QDrag(self)
                mime = QMimeData()
                mime.setText(self.full_path)
                drag.setMimeData(mime)
                drag.exec(Qt.CopyAction)
        super().mouseMoveEvent(event)

    def handle_click(self):
        # We don't necessarily need the checkable logic for marquee anymore 
        # since it's hover-based now. But we can keep it for the bg color.
        pass

    def set_icon_rotation(self, val):
        self.__icon_rotation = val
        self.lbl_arrow.set_rotation(val)

    def toggle_expand(self):
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
        self.ml_engine = MLEngine(resource_path("models"))
        self.mm_trainer = MultimodalTrainer(resource_path("models"))
        self.video_extractor = VideoFeatureExtractor()
        self.added_projects = []
        self.selected_projects = set()
        self.project_camera_config = {}
        self.mm_phase = None
        self.training_thread = None
        self.mm_training_thread = None
        self.loss_data = []
        self.acc_data = []
        self.val_loss_data = []
        self.f1_data = []
        self.loss_curve = None
        self.acc_curve = None
        self.val_loss_curve = None
        self.f1_curve = None
        self.val_loss_overlay = None
        self.training_mode = "multimodal"
        
        self.braille_frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
        self.braille_idx = 0
        self.braille_timer = QTimer(self)
        self.braille_timer.timeout.connect(self.update_braille)
        self.training_start_time = 0
        self.training_active = False
        self._training_paused = False
        self._current_video_name = ""
        
        self.eta_timer = QTimer(self)
        self.eta_timer.timeout.connect(self._update_eta)
        
        self.setAcceptDrops(True)
        
        self.init_ui()
        self.setup_connections()
        self._auto_detect_and_load_model()
        self._init_system_monitor()

    def update_braille(self):
        self.braille_idx = (self.braille_idx + 1) % len(self.braille_frames)
        self.lbl_braille.setText(self.braille_frames[self.braille_idx])

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
        
        l_col1.addSpacing(10)
        
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
        
        # --- COLUMN 2: ANALYSIS TABS ---
        col2 = QFrame()
        col2.setStyleSheet("background-color: transparent; border: none;")
        l_col2 = QVBoxLayout(col2)
        l_col2.setContentsMargins(10, 10, 10, 10)
        l_col2.setSpacing(0)

        self.col2_tabs = QTabWidget()
        self.col2_tabs.setIconSize(QSize(18, 18))
        self.col2_tabs.tabBar().setCursor(Qt.PointingHandCursor)
        self.col2_tabs.setStyleSheet(f"""
            QTabWidget::pane {{ border: 1px solid #444; background: #1e1e1e; top: -1px; border-radius: 0px 0px 4px 4px; }}
            QTabBar::tab {{ 
                background: #222; color: rgba(255, 255, 255, 0.55); padding: 10px 20px; 
                border-top-left-radius: 6px; border-top-right-radius: 6px; 
                font-family: Switzer; font-size: 9pt; font-weight: bold; margin-right: 2px;
            }}
            QTabBar::tab:selected {{ 
                background: #1e1e1e; color: white; 
                border-bottom: 3px solid {IDIADA_ORANGE}; 
            }}
            QTabBar::tab:hover {{ background: #2a2a2a; color: white; }}
        """)

        # Tab: Preview - drag-and-drop + navigation
        preview_tab = QWidget()
        preview_layout = QVBoxLayout(preview_tab)
        preview_layout.setContentsMargins(5, 5, 5, 5)
        preview_layout.setSpacing(5)

        self.preview_drop_zone = QLabel()
        self.preview_drop_zone.setAlignment(Qt.AlignCenter)
        drop_icon = resource_path("assets/icons/preview_16dp_FFFFFF_FILL1_wght400_GRAD0_opsz20.png")
        self.preview_drop_zone.setText(
            f'<html><center><img src="{drop_icon}" width="32" height="32"><br><br>'
            f'<span style="color:#888; font-size:11pt;">Drag &amp; Drop a project here</span><br>'
            f'<span style="color:#555; font-size:9pt;">to preview marks vs model predictions</span>'
            f'</center></html>'
        )
        self.preview_drop_zone.setStyleSheet("""
            QLabel { color: #888; padding: 40px; border: 2px dashed #444;
                     border-radius: 10px; background-color: #222; }
        """)
        self.preview_drop_zone.setMinimumHeight(100)
        preview_layout.addWidget(self.preview_drop_zone)

        self.preview_plot = pg.PlotWidget()
        self.preview_plot.setBackground('#111111')
        self.preview_plot.showGrid(x=True, y=True, alpha=0.2)
        self.preview_plot.setLabel('bottom', 'Time (s)')
        preview_layout.addWidget(self.preview_plot, 1)

        # Reorganized Nav to bottom
        self.preview_nav = QWidget()
        self.preview_nav.setStyleSheet("background: #1a1a1a; border-top: 1px solid #333;")
        nav_layout = QHBoxLayout(self.preview_nav)
        nav_layout.setContentsMargins(10, 8, 10, 8)
        nav_layout.setSpacing(12)
        
        self.btn_prev_case = QPushButton("\u25C0")
        self.btn_prev_case.setFixedSize(30, 26)
        self.btn_prev_case.setCursor(Qt.PointingHandCursor)
        self.btn_prev_case.setStyleSheet("QPushButton { background: #333; color: #aaa; border: 1px solid #444; border-radius: 4px; } QPushButton:hover { background: #444; color: white; border: 1px solid #F39200; }")
        self.btn_prev_case.clicked.connect(self.preview_prev)
        
        # Player-like seekbar placeholder
        self.preview_seekbar = QSlider(Qt.Horizontal)
        self.preview_seekbar.setStyleSheet("""
            QSlider::groove:horizontal { border: 1px solid #444; height: 4px; background: #222; border-radius: 2px; }
            QSlider::handle:horizontal { background: #F39200; border: 1px solid #F39200; width: 10px; height: 10px; margin: -4px 0; border-radius: 5px; }
        """)
        
        self.lbl_preview_title = QLabel("No project loaded")
        self.lbl_preview_title.setStyleSheet("color: #bbb; font-size: 8pt; font-weight: bold;")
        self.lbl_preview_title.setAlignment(Qt.AlignCenter)
        
        self.btn_next_case = QPushButton("\u25B6")
        self.btn_next_case.setFixedSize(30, 26)
        self.btn_next_case.setCursor(Qt.PointingHandCursor)
        self.btn_next_case.setStyleSheet("QPushButton { background: #333; color: #aaa; border: 1px solid #444; border-radius: 4px; } QPushButton:hover { background: #444; color: white; border: 1px solid #F39200; }")
        self.btn_next_case.clicked.connect(self.preview_next)
        
        nav_layout.addWidget(self.btn_prev_case)
        nav_layout.addWidget(self.preview_seekbar, 1)
        nav_layout.addWidget(self.lbl_preview_title)
        nav_layout.addWidget(self.btn_next_case)
        self.preview_nav.hide()
        preview_layout.addWidget(self.preview_nav)
        
        self.col2_tabs.addTab(preview_tab, "Preview")

        # Tab: History - enhanced
        history_tab = QWidget()
        history_layout = QVBoxLayout(history_tab)
        history_layout.setContentsMargins(5, 5, 5, 5)
        history_layout.setSpacing(5)
        self.lbl_history = QLabel("Build history will appear after training.")
        self.lbl_history.setStyleSheet("color: #666; font-size: 9pt;")
        self.lbl_history.setWordWrap(True)
        history_layout.addWidget(self.lbl_history)
        from PySide6.QtWidgets import QTableWidget, QTableWidgetItem, QHeaderView
        self.history_table = QTableWidget()
        self.history_table.setColumnCount(7)
        self.history_table.setHorizontalHeaderLabels(["Build", "Epochs", "Val Loss", "Acc", "F1", "Projects", "Date"])
        self.history_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.history_table.setStyleSheet("""
            QTableWidget { background-color: #1e1e1e; color: #ccc; border: none; gridline-color: #333;
                           alternate-background-color: #252525; selection-background-color: #F39200; selection-color: #1e1e1e; }
            QHeaderView::section { background-color: #2b2b2b; color: #aaa; border: none; padding: 4px; font-size: 9pt; font-weight: bold; }
            QTableWidget::item:hover { background-color: #333; }
        """)
        self.history_table.setAlternatingRowColors(True)
        self.history_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.history_table.setEditTriggers(QTableWidget.NoEditTriggers)
        self.history_table.setCursor(Qt.PointingHandCursor)
        self.history_table.doubleClicked.connect(self._on_history_double_click)
        history_layout.addWidget(self.history_table)
        self.col2_tabs.addTab(history_tab, "History")

        # Tab: Export - enhanced with model info + archive
        export_tab = QWidget()
        export_tab_layout = QVBoxLayout(export_tab)
        export_tab_layout.setContentsMargins(5, 10, 5, 5)
        export_tab_layout.setSpacing(12)

        info_frame = QFrame()
        info_frame.setStyleSheet("QFrame { background-color: #252525; border-radius: 8px; border: 1px solid #333; }")
        info_fl = QVBoxLayout(info_frame)
        info_fl.setContentsMargins(15, 12, 15, 12)
        lbl_mi = QLabel("Model Summary")
        lbl_mi.setStyleSheet("color: white; font-weight: bold; font-size: 10pt; border: none;")
        info_fl.addWidget(lbl_mi)
        self.lbl_export_model_details = QLabel("No model loaded")
        self.lbl_export_model_details.setStyleSheet("color: #888; font-size: 9pt; border: none;")
        self.lbl_export_model_details.setWordWrap(True)
        info_fl.addWidget(self.lbl_export_model_details)
        export_tab_layout.addWidget(info_frame)

        self.btn_export_onnx = QPushButton("  Export ONNX")
        self.btn_export_onnx.setIcon(QIcon(resource_path("assets/icons/file_download_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")) if os.path.exists(resource_path("assets/icons/file_download_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")) else QIcon())
        self.btn_export_onnx.setStyleSheet("""
            QPushButton { background-color: #2b2b2b; color: #ccc; padding: 12px; border: 1px solid #555;
                          border-radius: 6px; font-weight: bold; font-size: 10pt; }
            QPushButton:hover { background-color: #333; border: 1px solid #F39200; }
        """)
        self.btn_export_onnx.setCursor(Qt.PointingHandCursor)
        self.btn_export_onnx.clicked.connect(self.export_onnx)
        export_tab_layout.addWidget(self.btn_export_onnx)

        self.btn_export_archive = QPushButton("  Export Model Archive (.zip)")
        self.btn_export_archive.setIcon(QIcon(resource_path("assets/icons/drive_export_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")) if os.path.exists(resource_path("assets/icons/drive_export_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")) else QIcon())
        self.btn_export_archive.setStyleSheet("""
            QPushButton { background-color: #2b2b2b; color: #ccc; padding: 12px; border: 1px solid #555;
                          border-radius: 6px; font-weight: bold; font-size: 10pt; }
            QPushButton:hover { background-color: #333; border: 1px solid #F39200; }
        """)
        self.btn_export_archive.setCursor(Qt.PointingHandCursor)
        self.btn_export_archive.clicked.connect(self._export_model_archive)
        export_tab_layout.addWidget(self.btn_export_archive)

        self.lbl_export_result = QLabel("")
        self.lbl_export_result.setStyleSheet("color: #aaa; font-size: 9pt;")
        self.lbl_export_result.setWordWrap(True)
        export_tab_layout.addWidget(self.lbl_export_result)
        export_tab_layout.addStretch()
        self.col2_tabs.addTab(export_tab, "Export")

        setup_tab_icon_switching(self.col2_tabs, [
            ("preview_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png", "preview_16dp_FFFFFF_FILL1_wght400_GRAD0_opsz20.png"),
            ("history_2_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png", "history_2_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png"),
            ("drive_export_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png", "drive_export_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png"),
        ])

        l_col2.addWidget(self.col2_tabs)
        content_splitter.addWidget(col2)
        
        # --- COLUMN 3: TABS (Train / Monitor / System) ---
        col3 = QFrame()
        col3.setMinimumWidth(250)
        col3.setStyleSheet("background-color: transparent; border: none;")
        l_col3 = QVBoxLayout(col3)
        l_col3.setContentsMargins(10, 10, 10, 10)
        l_col3.setSpacing(0)

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
        
        COMBO_INPUT = MODERN_INPUT + """
            QComboBox {
                background-color: #2b2b2b;
                color: white;
                border: 1px solid #444;
                border-radius: 4px;
                padding: 6px 30px 6px 10px;
                min-height: 23px;
            }
            QComboBox:focus { border: 1px solid #F39200; }
            QComboBox::drop-down {
                subcontrol-origin: padding;
                subcontrol-position: center right;
                width: 24px;
                border: none;
                border-left: 1px solid #555;
            }
            QComboBox::down-arrow {
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 6px solid #aaa;
                width: 0px;
                height: 0px;
            }
            QComboBox QAbstractItemView {
                background-color: #333;
                color: white;
                border: 1px solid #555;
                selection-background-color: #F39200;
                selection-color: #1e1e1e;
                outline: none;
            }
            QComboBox QAbstractItemView::item {
                padding: 6px 10px;
                min-height: 28px;
            }
        """
        self.COMBO_STYLE = COMBO_INPUT

        self.tab_widget = QTabWidget()
        self.tab_widget.setIconSize(QSize(18, 18))
        self.tab_widget.tabBar().setCursor(Qt.PointingHandCursor)
        self.tab_widget.setStyleSheet(f"""
            QTabWidget::pane {{ border: 1px solid #444; background: #1e1e1e; top: -1px; border-radius: 0px 0px 4px 4px; }}
            QTabBar::tab {{ 
                background: #222; color: rgba(255, 255, 255, 0.55); padding: 10px 20px; 
                border-top-left-radius: 6px; border-top-right-radius: 6px; 
                font-family: Switzer; font-size: 9pt; font-weight: bold; margin-right: 2px;
            }}
            QTabBar::tab:selected {{ 
                background: #1e1e1e; color: white; 
                border-bottom: 3px solid {IDIADA_ORANGE}; 
            }}
            QTabBar::tab:hover {{ background: #2a2a2a; color: white; }}
        """)

        # === TAB: TRAIN ===
        train_tab = QWidget()
        train_layout = QVBoxLayout(train_tab)
        train_layout.setContentsMargins(5, 10, 5, 5)
        train_layout.setSpacing(8)

        lbl_cfg = QLabel("Training configuration")
        lbl_cfg.setFont(QFont("Switzer", 10, QFont.DemiBold))
        lbl_cfg.setStyleSheet("color: white;")
        train_layout.addWidget(lbl_cfg)

        cfg_grid = QGridLayout()
        cfg_grid.setSpacing(15)
        cfg_grid.setContentsMargins(5, 10, 5, 10)

        lbl_arch = QLabel("Architecture:")
        lbl_arch.setStyleSheet("color: #ccc;")
        self.combo_arch = QComboBox()
        self.combo_arch.addItems(["Multimodal (CNN+LSTM)", "MLP (Legacy)"])
        self.combo_arch.setStyleSheet(COMBO_INPUT)
        self.combo_arch.setFixedHeight(35)
        cfg_grid.addWidget(lbl_arch, 0, 0)
        cfg_grid.addWidget(self.combo_arch, 0, 1)

        lbl_m = QLabel("Model:")
        lbl_m.setStyleSheet("color: #ccc;")
        self.combo_model = QComboBox()
        self.combo_model.setStyleSheet(COMBO_INPUT)
        self.combo_model.setFixedHeight(35)
        self.combo_model.addItem("No model loaded")
        cfg_grid.addWidget(lbl_m, 1, 0)
        cfg_grid.addWidget(self.combo_model, 1, 1)

        lbl_e = QLabel("Epochs:")
        lbl_e.setStyleSheet("color: #ccc;")
        self.spin_epochs = QSpinBox()
        self.spin_epochs.setRange(1, 1000)
        self.spin_epochs.setValue(100)
        self.spin_epochs.setStyleSheet(MODERN_INPUT)
        self.spin_epochs.setFixedHeight(35)
        cfg_grid.addWidget(lbl_e, 2, 0)
        cfg_grid.addWidget(self.spin_epochs, 2, 1)

        lbl_lr = QLabel("Learning Rate:")
        lbl_lr.setStyleSheet("color: #ccc;")
        self.spin_lr = QDoubleSpinBox()
        self.spin_lr.setRange(0.0001, 1.0)
        self.spin_lr.setSingleStep(0.0001)
        self.spin_lr.setDecimals(4)
        self.spin_lr.setValue(0.0001)
        self.spin_lr.setStyleSheet(MODERN_INPUT)
        self.spin_lr.setFixedHeight(35)
        cfg_grid.addWidget(lbl_lr, 3, 0)
        cfg_grid.addWidget(self.spin_lr, 3, 1)

        lbl_patience = QLabel("Early Stop Patience:")
        lbl_patience.setStyleSheet("color: #ccc;")
        self.spin_patience = QSpinBox()
        self.spin_patience.setRange(1, 100)
        self.spin_patience.setValue(15)
        self.spin_patience.setStyleSheet(MODERN_INPUT)
        self.spin_patience.setFixedHeight(35)
        cfg_grid.addWidget(lbl_patience, 4, 0)
        cfg_grid.addWidget(self.spin_patience, 4, 1)

        self.spin_lr.valueChanged.connect(self._on_lr_changed)

        train_layout.addLayout(cfg_grid)
        train_layout.addSpacing(10)

        # Training buttons row
        btn_row = QHBoxLayout()
        btn_row.setSpacing(8)

        self.btn_train = QPushButton(" START")
        self.btn_train.setMinimumHeight(45)
        self.btn_train.setCursor(Qt.PointingHandCursor)
        self.btn_train.setIcon(QIcon(resource_path("assets/icons/model_training_24dp_2B2B2B_FILL0_wght400_GRAD0_opsz24.png")))
        self.btn_train.setIconSize(QSize(20, 20))
        self.btn_train.setStyleSheet("""
            QPushButton {
                background-color: #2da44e; color: #2b2b2b; font-weight: bold; font-size: 10pt;
                border-radius: 6px; border: 1px solid #238636;
            }
            QPushButton:hover { background-color: #3fb950; border: 1px solid #2ea043; }
            QPushButton:disabled { background-color: #333; color: #666; border: 1px solid #444; }
        """)
        btn_row.addWidget(self.btn_train)

        self.btn_pause = QPushButton(" PAUSE")
        self.btn_pause.setMinimumHeight(45)
        self.btn_pause.setCursor(Qt.PointingHandCursor)
        self.btn_pause.setEnabled(False)
        self.btn_pause.setStyleSheet("""
            QPushButton {
                background-color: #e6a817; color: #2b2b2b; font-weight: bold; font-size: 10pt;
                border-radius: 6px; border: 1px solid #d49e15;
            }
            QPushButton:hover { background-color: #f0b429; }
            QPushButton:disabled { background-color: #333; color: #666; border: 1px solid #444; }
        """)
        btn_row.addWidget(self.btn_pause)

        self.btn_stop = QPushButton(" STOP")
        self.btn_stop.setMinimumHeight(45)
        self.btn_stop.setCursor(Qt.PointingHandCursor)
        self.btn_stop.setEnabled(False)
        self.btn_stop.setStyleSheet("""
            QPushButton {
                background-color: #d1242f; color: white; font-weight: bold; font-size: 10pt;
                border-radius: 6px; border: 1px solid #b91c1c;
            }
            QPushButton:hover { background-color: #e03131; }
            QPushButton:disabled { background-color: #333; color: #666; border: 1px solid #444; }
        """)
        btn_row.addWidget(self.btn_stop)

        train_layout.addLayout(btn_row)
        train_layout.addStretch()
        self.tab_widget.addTab(train_tab, "Train")

        # === TAB: MONITOR ===
        monitor_tab = QWidget()
        monitor_layout = QVBoxLayout(monitor_tab)
        monitor_layout.setContentsMargins(5, 5, 5, 5)
        monitor_layout.setSpacing(5)

        font_light = QFont("Switzer", 8, QFont.Light)

        self.plot_loss = pg.PlotWidget()
        self.plot_loss.setMinimumHeight(120)
        self.plot_loss.setBackground('#1e1e1e')
        self.plot_loss.setLabel('left', 'Loss')
        self.plot_loss.getAxis('left').setTickFont(font_light)
        self.plot_loss.getAxis('bottom').setTicks([])
        self.plot_loss.getAxis('bottom').setStyle(showValues=False)
        self.plot_loss.getAxis('left').setStyle(tickLength=2)
        self.plot_loss.showGrid(x=True, y=True, alpha=0.15)
        try:
            self.plot_loss.getViewBox().setDefaultPadding(0.2)
        except Exception:
            pass
        self.loss_curve = self.plot_loss.plot(pen=pg.mkPen('#e74c3c', width=2))
        self.val_loss_overlay = self.plot_loss.plot(pen=pg.mkPen('#ff9999', width=1))

        self.plot_acc = pg.PlotWidget()
        self.plot_acc.setMinimumHeight(120)
        self.plot_acc.setBackground('#1e1e1e')
        self.plot_acc.setLabel('left', 'Acc')
        self.plot_acc.getAxis('left').setTickFont(font_light)
        self.plot_acc.getAxis('bottom').setTicks([])
        self.plot_acc.getAxis('bottom').setStyle(showValues=False)
        self.plot_acc.getAxis('left').setStyle(tickLength=2)
        self.plot_acc.showGrid(x=True, y=True, alpha=0.15)
        self.plot_acc.setYRange(0, 1)
        try:
            self.plot_acc.getViewBox().setDefaultPadding(0.2)
        except Exception:
            pass
        self.acc_curve = self.plot_acc.plot(pen=pg.mkPen('#3498db', width=2))

        self.plot_f1 = pg.PlotWidget()
        self.plot_f1.setMinimumHeight(120)
        self.plot_f1.setBackground('#1e1e1e')
        self.plot_f1.setLabel('left', 'F1')
        self.plot_f1.getAxis('left').setTickFont(font_light)
        self.plot_f1.getAxis('bottom').setTicks([])
        self.plot_f1.getAxis('bottom').setStyle(showValues=False)
        self.plot_f1.getAxis('left').setStyle(tickLength=2)
        self.plot_f1.showGrid(x=True, y=True, alpha=0.15)
        self.plot_f1.setYRange(0, 1)
        try:
            self.plot_f1.getViewBox().setDefaultPadding(0.2)
        except Exception:
            pass
        self.f1_curve = self.plot_f1.plot(pen=pg.mkPen('#2ecc71', width=2))

        self.plot_val_loss = pg.PlotWidget()
        self.plot_val_loss.setMinimumHeight(120)
        self.plot_val_loss.setBackground('#1e1e1e')
        self.plot_val_loss.setLabel('left', 'Val Loss')
        self.plot_val_loss.getAxis('left').setTickFont(font_light)
        self.plot_val_loss.getAxis('bottom').setTicks([])
        self.plot_val_loss.getAxis('bottom').setStyle(showValues=False)
        self.plot_val_loss.getAxis('left').setStyle(tickLength=2)
        self.plot_val_loss.showGrid(x=True, y=True, alpha=0.15)
        try:
            self.plot_val_loss.getViewBox().setDefaultPadding(0.2)
        except Exception:
            pass
        self.val_loss_curve = self.plot_val_loss.plot(pen=pg.mkPen('#f39c12', width=2))

        plots_grid = QGridLayout()
        plots_grid.setSpacing(6)
        plots_grid.addWidget(self.plot_loss, 0, 0)
        plots_grid.addWidget(self.plot_acc, 0, 1)
        plots_grid.addWidget(self.plot_f1, 1, 0)
        plots_grid.addWidget(self.plot_val_loss, 1, 1)
        monitor_layout.addLayout(plots_grid)

        # Class distribution bar chart
        self.plot_class_dist = pg.PlotWidget()
        self.plot_class_dist.setMinimumHeight(100)
        self.plot_class_dist.setMaximumHeight(120)
        self.plot_class_dist.setBackground('#1e1e1e')
        self.plot_class_dist.setLabel('left', 'Samples')
        self.plot_class_dist.getAxis('bottom').setTicks([])
        self.plot_class_dist.getAxis('bottom').setStyle(showValues=False)
        self.plot_class_dist.showGrid(x=False, y=True, alpha=0.15)
        monitor_layout.addWidget(self.plot_class_dist)
        self.class_dist_bars = None

        # Model comparison with delta
        comp_frame = QFrame()
        comp_frame.setStyleSheet("background-color: #1e1e1e; border-radius: 6px; border: none;")
        h_comp = QHBoxLayout(comp_frame)
        h_comp.setContentsMargins(10, 10, 10, 10)

        v_old = QVBoxLayout()
        v_old.setSpacing(3)
        lbl_old_title = QLabel("Current Model")
        lbl_old_title.setStyleSheet("color: #aaa; font-weight: bold; background: transparent; border: none;")
        v_old.addWidget(lbl_old_title, alignment=Qt.AlignCenter)
        self.lbl_old_prec = QLabel("-- %")
        self.lbl_old_prec.setStyleSheet(f"color: {IDIADA_ORANGE}; font-size: 18pt; font-weight: bold; background: transparent; border: none;")
        v_old.addWidget(self.lbl_old_prec, alignment=Qt.AlignCenter)

        v_delta = QVBoxLayout()
        v_delta.setSpacing(3)
        lbl_vs = QLabel("VS")
        lbl_vs.setStyleSheet("color: #666; font-size: 12pt; font-weight: bold; background: transparent; border: none;")
        v_delta.addWidget(lbl_vs, alignment=Qt.AlignCenter)
        self.lbl_delta = QLabel("")
        self.lbl_delta.setStyleSheet("color: #4caf50; font-size: 10pt; font-weight: bold; background: transparent; border: none;")
        v_delta.addWidget(self.lbl_delta, alignment=Qt.AlignCenter)

        v_new = QVBoxLayout()
        v_new.setSpacing(3)
        lbl_new_title = QLabel("New Model")
        lbl_new_title.setStyleSheet("color: #aaa; font-weight: bold; background: transparent; border: none;")
        v_new.addWidget(lbl_new_title, alignment=Qt.AlignCenter)
        self.lbl_new_prec = QLabel("-- %")
        self.lbl_new_prec.setStyleSheet("color: #4caf50; font-size: 18pt; font-weight: bold; background: transparent; border: none;")
        v_new.addWidget(self.lbl_new_prec, alignment=Qt.AlignCenter)

        h_comp.addLayout(v_old)
        h_comp.addLayout(v_delta)
        h_comp.addLayout(v_new)
        monitor_layout.addWidget(comp_frame)

        monitor_layout.addStretch()
        self.tab_widget.addTab(monitor_tab, "Monitor")

        # === TAB: SYSTEM (Task Manager style) ===
        system_tab = QWidget()
        system_layout = QVBoxLayout(system_tab)
        system_layout.setContentsMargins(5, 5, 5, 5)
        system_layout.setSpacing(5)

        CARD_STYLE = """
            QFrame {{
                background-color: #1a1a2e; border-radius: 8px;
                border: 1px solid {border_color};
            }}
        """
        SYS_LABEL = "color: {color}; font-size: 8pt; background: transparent; border: none;"
        SYS_VALUE = "color: {color}; font-size: 16pt; font-weight: bold; background: transparent; border: none;"

        sys_splitter = QSplitter(Qt.Horizontal)
        sys_splitter.setStyleSheet("QSplitter { background: transparent; } QSplitter::handle { background: transparent; width: 4px; }")

        # Left: summary cards
        cards_widget = QWidget()
        cards_layout = QVBoxLayout(cards_widget)
        cards_layout.setContentsMargins(0, 0, 0, 0)
        cards_layout.setSpacing(6)

        self._sys_cards = {}
        card_defs = [
            ("CPU", "#3498db", "#2980b9"),
            ("RAM", "#2ecc71", "#27ae60"),
            ("GPU", "#f39c12", "#e67e22"),
            ("VRAM", "#e74c3c", "#c0392b"),
            ("Temp", "#9b59b6", "#8e44ad"),
        ]
        for card_name, color, border_color in card_defs:
            card = QFrame()
            card.setFixedHeight(68)
            card.setStyleSheet(CARD_STYLE.format(border_color=border_color))
            card.setCursor(Qt.PointingHandCursor)
            cl = QVBoxLayout(card)
            cl.setContentsMargins(10, 6, 10, 6)
            cl.setSpacing(1)
            lbl_title = QLabel(card_name)
            lbl_title.setStyleSheet(SYS_LABEL.format(color="#aaa"))
            cl.addWidget(lbl_title)
            lbl_val = QLabel("--")
            lbl_val.setStyleSheet(SYS_VALUE.format(color=color))
            cl.addWidget(lbl_val)
            lbl_sub = QLabel("")
            lbl_sub.setStyleSheet(SYS_LABEL.format(color="#666"))
            cl.addWidget(lbl_sub)
            card.mousePressEvent = lambda e, n=card_name: self._select_sys_card(n)
            cards_layout.addWidget(card)
            self._sys_cards[card_name] = {"card": card, "value": lbl_val, "subtitle": lbl_sub, "color": color}

        cards_layout.addStretch()
        sys_splitter.addWidget(cards_widget)

        # Right: detailed chart
        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(4)

        self.lbl_sys_chart_title = QLabel("CPU Usage")
        self.lbl_sys_chart_title.setStyleSheet("color: #aaa; font-size: 10pt; font-weight: bold;")
        right_layout.addWidget(self.lbl_sys_chart_title)

        self.plot_sys_main = pg.PlotWidget()
        self.plot_sys_main.setBackground('#1a1a2e')
        self.plot_sys_main.showGrid(x=True, y=True, alpha=0.15)
        self.plot_sys_main.setLabel('left', '%')
        self.plot_sys_main.setLabel('bottom', 'Time (s)')
        self.plot_sys_main.setYRange(0, 100)
        self.plot_sys_main.getAxis('bottom').setStyle(showValues=False)
        self.plot_sys_main.getAxis('left').setStyle(tickLength=2)
        self.sys_main_curve = self.plot_sys_main.plot(pen=pg.mkPen('#3498db', width=2))
        self.sys_main_fill = pg.FillBetweenItem(self.sys_main_curve, self.plot_sys_main.plot([]), brush=pg.mkBrush(52, 152, 219, 40))
        self.plot_sys_main.addItem(self.sys_main_fill)
        right_layout.addWidget(self.plot_sys_main, 1)

        self.lbl_sys_info = QLabel("System monitoring: waiting...")
        self.lbl_sys_info.setStyleSheet("color: #666; font-size: 8pt; background: transparent; border: none;")
        right_layout.addWidget(self.lbl_sys_info)

        sys_splitter.addWidget(right_widget)
        sys_splitter.setSizes([120, 300])

        system_layout.addWidget(sys_splitter)

        self.cpu_data = []
        self.ram_data = []
        self.gpu_data = []
        self.gpu_vram_data = []
        self.gpu_temp_data = []
        self._selected_sys_card = "CPU"

        self.tab_widget.addTab(system_tab, "System")

        setup_tab_icon_switching(self.tab_widget, [
            ("exercise_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png", "exercise_16dp_FFFFFF_FILL1_wght400_GRAD0_opsz20.png"),
            ("monitor_heart_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png", "monitor_heart_16dp_FFFFFF_FILL1_wght400_GRAD0_opsz20.png"),
            ("developer_board_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png", "developer_board_16dp_FFFFFF_FILL1_wght400_GRAD0_opsz20.png"),
        ])

        l_col3.addWidget(self.tab_widget)
        
        content_splitter.addWidget(col3)
        content_splitter.setStretchFactor(0, 1)
        content_splitter.setStretchFactor(1, 2)
        content_splitter.setStretchFactor(2, 1)
        content_splitter.setSizes([350, 600, 350])
        
        main_layout.addWidget(content_splitter)

        # Footer Status
        footer_status = QFrame()
        footer_status.setFixedHeight(30)
        footer_grid = QGridLayout(footer_status)
        footer_grid.setContentsMargins(15, 0, 15, 0)
        footer_grid.setColumnStretch(0, 1)
        footer_grid.setColumnStretch(1, 2)
        footer_grid.setColumnStretch(2, 1)

        left_w = QWidget()
        h_left = QHBoxLayout(left_w)
        h_left.setContentsMargins(0, 0, 0, 0)
        h_left.setSpacing(5)
        self.lbl_braille = QLabel("⠋")
        self.lbl_braille.setStyleSheet(f"color: {IDIADA_ORANGE}; font-weight: bold; font-size: 14pt;")
        self.lbl_braille.hide()
        h_left.addWidget(self.lbl_braille)
        self.lbl_footer_status = QLabel("AI Ready")
        self.lbl_footer_status.setStyleSheet("color: #4caf50; font-weight: bold; font-family: 'Switzer'; font-size: 10pt;")
        h_left.addWidget(self.lbl_footer_status)
        footer_grid.addWidget(left_w, 0, 0, Qt.AlignLeft)

        self.progress_bar = PulsingProgressBar()
        self.progress_bar.setFixedHeight(6)
        self.progress_bar.hide()
        footer_grid.addWidget(self.progress_bar, 0, 1, Qt.AlignCenter)

        self.lbl_task_info = QLabel("IDLE")
        self.lbl_task_info.setStyleSheet("color: #aaa; font-family: 'Switzer'; font-size: 10pt;")
        footer_grid.addWidget(self.lbl_task_info, 0, 2, Qt.AlignRight)

        main_layout.addWidget(footer_status)

    def setup_connections(self):
        self.btn_add_project.clicked.connect(self.add_project)
        self.btn_train.clicked.connect(self.toggle_training)
        self.btn_pause.clicked.connect(self.toggle_pause_training)
        self.btn_stop.clicked.connect(self.stop_training)
        
        self.dataset_builder.log.connect(self.log_status)
        self.dataset_builder.progress.connect(self.update_progress)
        self.dataset_builder.finished.connect(self.on_dataset_ready)
        self.dataset_builder.multimodal_finished.connect(self.on_multimodal_dataset_ready)
        self.ml_engine.epoch_progress.connect(self.on_epoch_progress)
        self.mm_trainer.epoch_progress.connect(self.on_epoch_progress)
        self.mm_trainer.log.connect(self.log_status)
        self.combo_arch.currentIndexChanged.connect(self.on_arch_changed)
        self.combo_model.currentIndexChanged.connect(self.on_model_changed)

    def _auto_detect_and_load_model(self):
        latest_pt = self.mm_trainer.find_latest_model()
        latest_pkl = self.ml_engine.find_latest_model()
        
        if latest_pt and latest_pt.endswith(".pt"):
            if self.mm_trainer.load_model(latest_pt):
                self.training_mode = "multimodal"
                self.combo_arch.setCurrentIndex(0)
                self._populate_model_combo()
                return
        
        if latest_pkl and latest_pkl.endswith(".pkl"):
            if self.ml_engine.load_model(latest_pkl):
                self.training_mode = "mlp"
                self.combo_arch.setCurrentIndex(1)
                self._populate_model_combo()
                return
        
        self.training_mode = "multimodal"
        self.combo_arch.setCurrentIndex(0)
        self._populate_model_combo()

    def _populate_model_combo(self):
        self.combo_model.blockSignals(True)
        self.combo_model.clear()

        if self.training_mode == "multimodal":
            model_dir = self.mm_trainer.base_models_dir
            if os.path.exists(model_dir):
                entries = []
                for model_name_dir in os.listdir(model_dir):
                    full = os.path.join(model_dir, model_name_dir)
                    if not os.path.isdir(full) or model_name_dir == "video_cache":
                        continue
                    for build_dir in os.listdir(full):
                        build_path = os.path.join(full, build_dir)
                        if not os.path.isdir(build_path) or not build_dir.startswith("build_"):
                            continue
                        pt_path = os.path.join(build_path, "model.pt")
                        if os.path.exists(pt_path):
                            entries.append((build_dir, f"{model_name_dir}/{build_dir}", pt_path))
                entries.sort(key=lambda x: x[0], reverse=True)
                for _, display, path in entries:
                    self.combo_model.addItem(display)
                    self.combo_model.setItemData(self.combo_model.count() - 1, path)
        else:
            model_dir = self.ml_engine.base_models_dir
            if os.path.exists(model_dir):
                entries = []
                for model_name_dir in os.listdir(model_dir):
                    full = os.path.join(model_dir, model_name_dir)
                    if not os.path.isdir(full):
                        continue
                    for build_dir in os.listdir(full):
                        build_path = os.path.join(full, build_dir)
                        if not os.path.isdir(build_path) or not build_dir.startswith("build_"):
                            continue
                        pkl_path = os.path.join(build_path, "model.pkl")
                        if os.path.exists(pkl_path):
                            entries.append((build_dir, f"{model_name_dir}/{build_dir}", pkl_path))
                entries.sort(key=lambda x: x[0], reverse=True)
                for _, display, path in entries:
                    self.combo_model.addItem(display)
                    self.combo_model.setItemData(self.combo_model.count() - 1, path)

        if self.combo_model.count() == 0:
            self.combo_model.addItem("No model loaded")

        self.combo_model.blockSignals(False)
        self.refresh_model_ui()

    def on_arch_changed(self, index):
        if index == 0:
            self.training_mode = "multimodal"
        else:
            self.training_mode = "mlp"
        self._populate_model_combo()

    def on_model_changed(self, index):
        if index < 0:
            return
        model_text = self.combo_model.itemText(index)
        if "incompatible" in model_text:
            return
        if "No model" in model_text:
            return

        model_path = self.combo_model.itemData(index)

        if self.training_mode == "multimodal":
            if model_path and os.path.exists(model_path):
                self.mm_trainer.load_model(model_path)
        else:
            if model_path and os.path.exists(model_path):
                self.ml_engine.load_model(model_path)

        self.refresh_model_ui()

    def refresh_model_ui(self):
        engine = self.mm_trainer if self.training_mode == "multimodal" else self.ml_engine
        hist = engine.metadata.get("history", {})
        self.loss_data = hist.get("loss", hist.get("train_loss", []))
        self.acc_data = hist.get("acc", hist.get("train_acc", []))
        if self.training_mode == "multimodal":
            self.val_loss_data = hist.get("val_loss", [])
            self.f1_data = hist.get("train_f1", [])
        else:
            self.val_loss_data = []
            self.f1_data = []
        
        if self.loss_data and self.acc_data:
            self.loss_curve.setData(self.loss_data)
            self.acc_curve.setData(self.acc_data)
            self.lbl_old_prec.setText(f"{self.acc_data[-1]*100:.1f} %")
        else:
            self.loss_curve.setData([])
            self.acc_curve.setData([])
            self.lbl_old_prec.setText("-- %")
        
        if self.f1_data:
            self.f1_curve.setData(self.f1_data)
        else:
            self.f1_curve.setData([])
        
        if self.val_loss_data:
            self.val_loss_curve.setData(self.val_loss_data)
            self.val_loss_overlay.setData(self.val_loss_data)
        else:
            self.val_loss_curve.setData([])
            self.val_loss_overlay.setData([])

        dataset_stats = engine.metadata.get("dataset_stats", {})
        if dataset_stats:
            self._update_class_distribution(dataset_stats)
        else:
            self.plot_class_dist.clear()

        self._populate_build_history()

        # Update export model details
        if hasattr(self, 'lbl_export_model_details'):
            meta = engine.metadata
            arch = meta.get("architecture", "MLP (legacy)")
            sig_dim = meta.get("signal_dim", "?")
            vid_dim = meta.get("video_dim", "?")
            best_val = meta.get("best_val_loss", None)
            n_proj = len(meta.get("projects", []))
            cfg = meta.get("training_config", {})
            epochs_done = cfg.get("epochs_completed", "?")
            date = cfg.get("timestamp", "N/A")
            details = f"Architecture: {arch}\n"
            details += f"Signal dim: {sig_dim}  |  Video dim: {vid_dim}\n"
            details += f"Epochs: {epochs_done}  |  Projects: {n_proj}\n"
            if best_val is not None:
                details += f"Best Val Loss: {best_val:.4f}\n"
            details += f"Date: {date}"
            self.lbl_export_model_details.setText(details)

        # Fix B8: properly clean up old project widgets
        for i in reversed(range(self.layout_projects.count())):
            w = self.layout_projects.itemAt(i).widget()
            if w:
                self.layout_projects.removeWidget(w)
                w.deleteLater()
        self.added_projects.clear()
        self.selected_projects.clear()
        self.project_camera_config.clear()
        
        meta_projects = engine.metadata.get("projects", [])
        meta_details = engine.metadata.get("project_details", {})
        for p in meta_projects:
            p_norm = os.path.normpath(p)
            if p_norm in meta_details or os.path.exists(p):
                if os.path.exists(p):
                    details = meta_details.get(p, meta_details.get(p_norm, {}))
                    if details:
                        self._add_project_to_tree_from_metadata(p, details, is_trained=True)
                    else:
                        self._add_project_to_tree(p, is_trained=True)
                else:
                    details = meta_details.get(p, meta_details.get(p_norm, {}))
                    self._add_project_to_tree_from_metadata(p, details, is_trained=True)

    def add_project(self):
        d = QFileDialog.getExistingDirectory(self, "Select Project Folder")
        if d:
            self._add_project_to_tree(d)

    def _add_project_to_tree(self, path, is_trained=False):
        norm_path = os.path.normpath(path)
        if norm_path in [os.path.normpath(p) for p in self.added_projects]:
            self.log_status(f"Project already added: {os.path.basename(path)}")
            return
        parts = os.path.normpath(path).split(os.sep)
        project_name = os.sep.join(parts[-5:]) if len(parts) >= 5 else path
        
        current_engine = self.mm_trainer if self.training_mode == "multimodal" else self.ml_engine
        trained_projects = current_engine.metadata.get("projects", [])
        if not is_trained:
            is_trained = norm_path in [os.path.normpath(p) for p in trained_projects]
        
        proj_container = QWidget()
        proj_layout = QVBoxLayout(proj_container)
        proj_layout.setContentsMargins(0, 5, 0, 0)
        proj_layout.setSpacing(0)
        
        header_widget = QWidget()
        header_layout = QHBoxLayout(header_widget)
        header_layout.setContentsMargins(2, 0, 0, 0)
        header_layout.setSpacing(6)
        
        btn_expand = ProjectExpandButton(project_name, path)
        folder_icon_path = "assets/icons/folder_check_16dp_CCCCCC_FILL1_wght400_GRAD0_opsz20.png" if is_trained else "assets/icons/folder_open_16dp_FFFF55_FILL1_wght400_GRAD0_opsz20.png"
        btn_expand.lbl_icon.setPixmap(QIcon(resource_path(folder_icon_path)).pixmap(16, 16))
        btn_expand.lbl_icon.setToolTip("Already in current model" if is_trained else "New project (not yet trained)")
        
        # Add status text like in image 3
        status_text = " (Entrenado)" if is_trained else " (Listo)"
        status_color = "#4caf50" if is_trained else "#888"
        btn_expand.marquee.text += f"<span style='color:{status_color}; font-size:8pt;'>{status_text}</span>"
        
        header_layout.addWidget(btn_expand, 1)

        if not is_trained:
            toggle = AnimatedToggle(active_color=IDIADA_ORANGE)
            toggle.setChecked(True)
            toggle.setFixedSize(35, 20)
            header_layout.addWidget(toggle)
            toggle.toggled.connect(lambda checked, p=norm_path: self._on_project_toggle(p, checked))
        
        proj_layout.addWidget(header_widget)
        
        self.added_projects.append(path)
        # Both trained and new projects are selectable for retraining
        self.selected_projects.add(norm_path)
        self.project_camera_config[norm_path] = "auto"
        
        content_widget = QWidget()
        content_layout = QVBoxLayout(content_widget)
        content_layout.setContentsMargins(28, 4, 0, 4)
        content_layout.setSpacing(4)
        
        # Data rows with icons: marks, videos, mf4
        # --- Marks row ---
        marks_file = os.path.join(path, "marks.json")
        n_cases = 0
        if os.path.exists(marks_file):
            try:
                with open(marks_file, 'r', encoding='utf-8') as mf:
                    n_cases = len(json.load(mf))
            except Exception:
                n_cases = 0
        
        marks_row = QWidget()
        marks_hl = QHBoxLayout(marks_row)
        marks_hl.setContentsMargins(0, 0, 0, 0)
        marks_hl.setSpacing(6)
        marks_icon = QLabel()
        marks_icon.setPixmap(QIcon(resource_path("assets/icons/account_tree_16dp_FD4949_FILL1_wght400_GRAD0_opsz20.png")).pixmap(14, 14))
        marks_hl.addWidget(marks_icon)
        lbl_marks = QLabel(f"{n_cases} marks")
        lbl_marks.setStyleSheet("color: #aaa; font-size: 9pt; background: transparent; border: none;")
        marks_hl.addWidget(lbl_marks, 1)
        content_layout.addWidget(marks_row)
        
        # --- Videos row ---
        available_cams = self._scan_cameras(path)
        avi_files = glob.glob(os.path.join(path, "**", "*.avi"), recursive=True) + \
                    glob.glob(os.path.join(path, "**", "*.AVI"), recursive=True)
        
        vid_row = QWidget()
        vid_hl = QHBoxLayout(vid_row)
        vid_hl.setContentsMargins(0, 0, 0, 0)
        vid_hl.setSpacing(6)
        vid_icon = QLabel()
        vid_icon.setPixmap(QIcon(resource_path("assets/icons/video_call_16dp_E770F0_FILL1_wght400_GRAD0_opsz20.png")).pixmap(14, 14))
        vid_hl.addWidget(vid_icon)
        vid_count_lbl = QLabel(f"{len(avi_files)} videos")
        vid_count_lbl.setStyleSheet("color: #aaa; font-size: 9pt; background: transparent; border: none;")
        vid_hl.addWidget(vid_count_lbl)
        
        cam_combo = QComboBox()
        cam_combo.addItem("Auto")
        for cam in available_cams:
            cam_combo.addItem(cam.lstrip("_").capitalize())
        cam_combo.setFixedHeight(20) # Smaller height
        cam_combo.setFixedWidth(85)
        cam_combo.setStyleSheet(self.COMBO_STYLE + "QComboBox { padding: 2px 20px 2px 6px; font-size: 8pt; }")
        
        def _on_cam_changed(text, p=norm_path, lbl=vid_count_lbl, all_avis=avi_files):
            self._on_camera_change(p, text)
            if text.lower() == "auto":
                lbl.setText(f"{len(all_avis)} videos")
            else:
                suffix = f"_{text.lower()}"
                filtered = [f for f in all_avis if suffix in os.path.basename(f).lower()]
                lbl.setText(f"{len(filtered)} videos")
        
        cam_combo.currentTextChanged.connect(_on_cam_changed)
        vid_hl.addWidget(cam_combo)
        vid_hl.addStretch()
        content_layout.addWidget(vid_row)
        
        # --- MF4 row ---
        mf4_files = glob.glob(os.path.join(path, "**", "*_tracking.mf4"), recursive=True)
        
        mf4_row = QWidget()
        mf4_hl = QHBoxLayout(mf4_row)
        mf4_hl.setContentsMargins(0, 0, 0, 0)
        mf4_hl.setSpacing(6)
        mf4_icon = QLabel()
        mf4_icon.setPixmap(QIcon(resource_path("assets/icons/deployed_code_16dp_76CBC5_FILL1_wght400_GRAD0_opsz20.png")).pixmap(14, 14))
        mf4_hl.addWidget(mf4_icon)
        mf4_count_lbl = QLabel(f"{len(mf4_files)} tracking")
        mf4_count_lbl.setStyleSheet("color: #aaa; font-size: 9pt; background: transparent; border: none;")
        mf4_hl.addWidget(mf4_count_lbl)
        mf4_hl.addStretch()
        content_layout.addWidget(mf4_row)
        
        proj_layout.addWidget(content_widget)
        
        anim_height = QPropertyAnimation(content_widget, b"maximumHeight")
        anim_height.setDuration(300)
        anim_height.setEasingCurve(QEasingCurve.InOutQuad)
        content_widget.setMaximumHeight(500)
        
        def toggle_content():
            anim_height.stop()
            btn_expand.toggle_expand()
            if btn_expand.is_expanded:
                content_widget.setVisible(True)
                anim_height.setStartValue(0)
                anim_height.setEndValue(200)
            else:
                anim_height.setStartValue(content_widget.height())
                anim_height.setEndValue(0)
            anim_height.start()
            
        def on_anim_finished():
            if not btn_expand.is_expanded:
                content_widget.setVisible(False)
            else:
                content_widget.setMaximumHeight(500)
                
        anim_height.finished.connect(on_anim_finished)
        btn_expand.clicked.connect(toggle_content)
        
        self.layout_projects.addWidget(proj_container)

    def _add_project_to_tree_from_metadata(self, path, details, is_trained=True):
        norm_path = os.path.normpath(path)
        if norm_path in [os.path.normpath(p) for p in self.added_projects]:
            return
        parts = os.path.normpath(path).split(os.sep)
        project_name = os.sep.join(parts[-5:]) if len(parts) >= 5 else path
        
        proj_container = QWidget()
        proj_layout = QVBoxLayout(proj_container)
        proj_layout.setContentsMargins(0, 5, 0, 0)
        proj_layout.setSpacing(0)
        
        header_widget = QWidget()
        header_layout = QHBoxLayout(header_widget)
        header_layout.setContentsMargins(2, 0, 0, 0)
        header_layout.setSpacing(6)
        
        trained_icon = QLabel()
        trained_icon.setPixmap(QIcon(resource_path("assets/icons/folder_check_16dp_CCCCCC_FILL1_wght400_GRAD0_opsz20.png")).pixmap(16, 16))
        trained_icon.setToolTip("Already included in current model")
        header_layout.addWidget(trained_icon)
        
        btn_expand = ProjectExpandButton(project_name, path)
        header_layout.addWidget(btn_expand, 1)
        
        proj_layout.addWidget(header_widget)
        
        self.added_projects.append(path)
        if is_trained:
            self.selected_projects.add(norm_path)
        
        content_widget = QWidget()
        content_layout = QVBoxLayout(content_widget)
        content_layout.setContentsMargins(28, 0, 0, 0)
        content_layout.setSpacing(4)
        
        data_row = QWidget()
        data_hlayout = QHBoxLayout(data_row)
        data_hlayout.setContentsMargins(0, 0, 0, 0)
        data_hlayout.setSpacing(12)
        
        n_cases = details.get("n_cases", 0)
        n_avi = details.get("n_avi", 0)
        n_mf4 = details.get("n_tracking_mf4", 0)
        
        cases_lbl = QLabel(f"({n_cases} cases)")
        cases_lbl.setStyleSheet("color: #777; font-size: 9pt; background: transparent; border: none;")
        data_hlayout.addWidget(cases_lbl)
        
        vid_lbl = QLabel(f"({n_avi} videos)")
        vid_lbl.setStyleSheet("color: #777; font-size: 9pt; background: transparent; border: none;")
        data_hlayout.addWidget(vid_lbl)
        
        mf4_lbl = QLabel(f"({n_mf4} tracking)")
        mf4_lbl.setStyleSheet("color: #777; font-size: 9pt; background: transparent; border: none;")
        data_hlayout.addWidget(mf4_lbl)
        
        data_hlayout.addStretch()
        content_layout.addWidget(data_row)
        proj_layout.addWidget(content_widget)
        
        content_widget.setMaximumHeight(200)
        anim_height = QPropertyAnimation(content_widget, b"maximumHeight")
        anim_height.setDuration(300)
        anim_height.setEasingCurve(QEasingCurve.InOutQuad)
        
        def toggle_content():
            anim_height.stop()
            btn_expand.toggle_expand()
            if btn_expand.is_expanded:
                content_widget.setVisible(True)
                anim_height.setStartValue(0)
                anim_height.setEndValue(200)
            else:
                anim_height.setStartValue(content_widget.height())
                anim_height.setEndValue(0)
            anim_height.start()
        
        def on_anim_finished():
            if not btn_expand.is_expanded:
                content_widget.setVisible(False)
            else:
                content_widget.setMaximumHeight(500)
                
        anim_height.finished.connect(on_anim_finished)
        btn_expand.clicked.connect(toggle_content)
        
        self.layout_projects.addWidget(proj_container)

    def _scan_cameras(self, project_path):
        import glob as _glob
        cams = []
        seen = set()
        for pattern in ['*_cam*.avi', '*_cam*.AVI']:
            for avi in _glob.glob(os.path.join(project_path, "**", pattern), recursive=True):
                basename = os.path.basename(avi)
                m = re.search(r'(_cam\d+)', basename, re.IGNORECASE)
                if m:
                    cam = m.group(1).lower()
                    if cam not in seen:
                        seen.add(cam)
                        cams.append(cam)
        return sorted(cams)

    def _on_project_toggle(self, path, checked):
        if checked:
            self.selected_projects.add(path)
        else:
            self.selected_projects.discard(path)

    def _on_camera_change(self, path, text):
        if text == "Auto":
            self.project_camera_config[path] = "auto"
        else:
            self.project_camera_config[path] = text.lower()

    def _update_class_distribution(self, stats):
        self.plot_class_dist.clear()
        train_pos = stats.get("train_positive", 0)
        train_neg = stats.get("train_negative", 0)
        val_pos = stats.get("val_positive", 0)
        val_neg = stats.get("val_negative", 0)
        x = [0, 1, 2, 3]
        heights = [train_pos, train_neg, val_pos, val_neg]
        colors = ['#2ecc71', '#e74c3c', '#27ae60', '#c0392b']
        labels = ['Train+', 'Train-', 'Val+', 'Val-']
        bg = pg.BarGraphItem(x=x, height=heights, width=0.6, brushes=colors)
        self.plot_class_dist.addItem(bg)
        ax = self.plot_class_dist.getAxis('bottom')
        ax.setTicks([[(i, labels[i]) for i in range(4)]])

    def _populate_build_history(self):
        self.history_table.setRowCount(0)
        if self.training_mode == "multimodal":
            model_dir = self.mm_trainer.base_models_dir
            ext = "model.pt"
            engine_key = "mm"
        else:
            model_dir = self.ml_engine.base_models_dir
            ext = "model.pkl"
            engine_key = "mlp"

        if not os.path.exists(model_dir):
            return

        builds = []
        for root, dirs, files in os.walk(model_dir):
            if os.path.basename(root).startswith("build_") and ext in files:
                meta_path = os.path.join(root, "metadata.json")
                if os.path.exists(meta_path):
                    try:
                        with open(meta_path) as mf:
                            meta = json.load(mf)
                        builds.append((os.path.basename(root), meta))
                    except Exception:
                        pass

        builds.sort(key=lambda x: x[0], reverse=True)
        self.history_table.setRowCount(len(builds))
        for row, (build_name, meta) in enumerate(builds):
            hist = meta.get("history", {})
            epochs_completed = len(hist.get("train_loss", hist.get("loss", [])))
            best_val_loss = meta.get("best_val_loss", float("inf"))
            if best_val_loss == float("inf"):
                best_val_loss = "--"
            else:
                best_val_loss = f"{best_val_loss:.4f}"
            acc_list = hist.get("train_acc", hist.get("acc", []))
            final_acc = f"{acc_list[-1]*100:.1f}%" if acc_list else "--"
            f1_list = hist.get("train_f1", [])
            final_f1 = f"{f1_list[-1]*100:.1f}%" if f1_list else "--"
            n_projects = len(meta.get("projects", []))

            from PySide6.QtWidgets import QTableWidgetItem
            self.history_table.setItem(row, 0, QTableWidgetItem(build_name))
            self.history_table.setItem(row, 1, QTableWidgetItem(str(epochs_completed)))
            self.history_table.setItem(row, 2, QTableWidgetItem(str(best_val_loss)))
            self.history_table.setItem(row, 3, QTableWidgetItem(str(final_acc)))
            self.history_table.setItem(row, 4, QTableWidgetItem(str(final_f1)))
            self.history_table.setItem(row, 5, QTableWidgetItem(f"{n_projects}"))
            # Extract date from build name (build_YYYYMMDD_HHMMSS)
            date_str = build_name.replace("build_", "")
            try:
                from datetime import datetime
                dt = datetime.strptime(date_str, "%Y%m%d_%H%M%S")
                date_display = dt.strftime("%Y-%m-%d %H:%M")
            except Exception:
                cfg = meta.get("training_config", {})
                date_display = cfg.get("timestamp", "N/A")[:16]
            self.history_table.setItem(row, 6, QTableWidgetItem(date_display))

    def _init_system_monitor(self):
        try:
            from src.core.system_monitor import SystemMonitorWorker
            self.sys_monitor = SystemMonitorWorker(self)
            self.sys_monitor.stats.connect(self._on_system_stats)
            self.sys_monitor.start()
        except Exception:
            self.sys_monitor = None

    def _on_system_stats(self, data):
        self.cpu_data.append(data.get("cpu", 0))
        self.ram_data.append(data.get("ram_mb", 0))
        self.gpu_data.append(data.get("gpu_util", 0))
        self.gpu_vram_data.append(data.get("gpu_vram_mb", 0))
        self.gpu_temp_data.append(data.get("gpu_temp", 0))
        max_points = 120
        for lst_name in ['cpu_data', 'ram_data', 'gpu_data', 'gpu_vram_data', 'gpu_temp_data']:
            lst = getattr(self, lst_name)
            if len(lst) > max_points:
                setattr(self, lst_name, lst[-max_points:])

        # Update cards
        if hasattr(self, '_sys_cards'):
            self._sys_cards["CPU"]["value"].setText(f"{data.get('cpu', 0):.0f}%")
            self._sys_cards["RAM"]["value"].setText(f"{data.get('ram_mb', 0)} MB")
            self._sys_cards["GPU"]["value"].setText(f"{data.get('gpu_util', 0)}%")
            self._sys_cards["VRAM"]["value"].setText(f"{data.get('gpu_vram_mb', 0)} MB")
            self._sys_cards["Temp"]["value"].setText(f"{data.get('gpu_temp', 0)}\u00b0C")

        # Update the selected main chart
        self._update_sys_chart()

        info_parts = [f"CPU: {data.get('cpu', 0):.0f}%", f"RAM: {data.get('ram_mb', 0)} MB"]
        if "gpu_util" in data:
            info_parts.append(f"GPU: {data.get('gpu_util', 0)}%")
            info_parts.append(f"VRAM: {data.get('gpu_vram_mb', 0)} MB")
            info_parts.append(f"Temp: {data.get('gpu_temp', 0)}\u00b0C")
        self.lbl_sys_info.setText("  \u2502  ".join(info_parts))

    def _select_sys_card(self, name):
        self._selected_sys_card = name
        color = self._sys_cards[name]["color"]
        self.lbl_sys_chart_title.setText(f"{name} Usage")
        self.sys_main_curve.setPen(pg.mkPen(color, width=2))
        # Update fill color
        r, g, b = QColor(color).red(), QColor(color).green(), QColor(color).blue()
        self.plot_sys_main.removeItem(self.sys_main_fill)
        zero_curve = self.plot_sys_main.plot([])
        self.sys_main_fill = pg.FillBetweenItem(self.sys_main_curve, zero_curve, brush=pg.mkBrush(r, g, b, 40))
        self.plot_sys_main.addItem(self.sys_main_fill)
        if name in ("RAM", "VRAM"):
            self.plot_sys_main.setLabel('left', 'MB')
            self.plot_sys_main.enableAutoRange(axis='y')
        elif name == "Temp":
            self.plot_sys_main.setLabel('left', '\u00b0C')
            self.plot_sys_main.enableAutoRange(axis='y')
        else:
            self.plot_sys_main.setLabel('left', '%')
            self.plot_sys_main.setYRange(0, 100)
        self._update_sys_chart()

    def _update_sys_chart(self):
        data_map = {
            "CPU": self.cpu_data, "RAM": self.ram_data,
            "GPU": self.gpu_data, "VRAM": self.gpu_vram_data,
            "Temp": self.gpu_temp_data,
        }
        selected = getattr(self, '_selected_sys_card', 'CPU')
        chart_data = data_map.get(selected, self.cpu_data)
        self.sys_main_curve.setData(chart_data)

    def load_preview_project(self, marks_path):
        try:
            with open(marks_path, "r", encoding="utf-8") as f:
                self.preview_data = json.load(f)
            self.preview_cases = list(self.preview_data.keys())
            self.preview_root = os.path.dirname(marks_path)
            self.preview_idx = 0
            if self.preview_cases:
                # Hide drop zone, show navigation
                self.preview_drop_zone.hide()
                self.preview_nav.show()
                self.col2_tabs.setCurrentIndex(0)  # Switch to Preview tab
                self.show_preview_case()
        except Exception as e:
            self.log_status(f"Error loading project: {e}")

    def show_preview_case(self):
        if not hasattr(self, 'preview_cases') or self.preview_idx >= len(self.preview_cases):
            self.lbl_preview_title.setText("No cases to preview")
            return
        case = self.preview_cases[self.preview_idx]
        timestamps = self.preview_data[case]
        mf4_path = self.dataset_builder._resolve_mf4_path(self.preview_root, case)
        if mf4_path and os.path.exists(mf4_path):
            self.lbl_preview_title.setText(f"Case {self.preview_idx+1} / {len(self.preview_cases)}  \u2502  {os.path.basename(case)}")
            self._plot_mf4_with_markers(mf4_path, timestamps)
        else:
            self.lbl_preview_title.setText(f"Case {self.preview_idx+1} / {len(self.preview_cases)}  \u2502  MF4 not found")
            
    def preview_next(self):
        if hasattr(self, 'preview_cases') and self.preview_idx < len(self.preview_cases) - 1:
            self.preview_idx += 1
            self.show_preview_case()

    def preview_prev(self):
        if hasattr(self, 'preview_cases') and self.preview_idx > 0:
            self.preview_idx -= 1
            self.show_preview_case()

    def dragEnterEvent(self, event):
        if event.mimeData().hasText():
            event.acceptProposedAction()

    def closeEvent(self, event):
        if hasattr(self, 'sys_monitor') and self.sys_monitor is not None:
            self.sys_monitor.stop_monitor()
        super().closeEvent(event)

    def dropEvent(self, event):
        path = event.mimeData().text()
        if os.path.isdir(path):
            marks_path = os.path.join(path, "marks.json")
            if os.path.exists(marks_path):
                self.load_preview_project(marks_path)

    def _plot_mf4_with_markers(self, mf4_path, ground_truth):
        from asammdf import MDF
        mdf = MDF(mf4_path)
        engine = "OWL" if "Head_H_Angle" in mdf else "LIZ"
        
        if engine == "OWL":
            h = mdf.get("Head_H_Angle")
            v = mdf.get("Head_V_Angle")
        else:
            h = mdf.get("H_Ratio")
            v = mdf.get("V_Ratio")
        
        self.preview_plot.clear()
        self.preview_plot.plot(h.timestamps, h.samples, pen=pg.mkPen('#555', width=1))
        
        # Ground truth (yellow background)
        for i in range(0, len(ground_truth), 2):
            if i+1 < len(ground_truth):
                lr = pg.LinearRegionItem([ground_truth[i], ground_truth[i+1]], movable=False, brush=pg.mkBrush(255, 255, 0, 50))
                self.preview_plot.addItem(lr)
                
        # Model predictions - try multimodal first, then legacy MLP
        predictions = None
        if self.training_mode == "multimodal" and self.mm_trainer.model is not None:
            try:
                video_path = VideoFeatureExtractor.find_video_for_mf4(mf4_path)
                if video_path and os.path.exists(video_path):
                    import pandas as pd
                    df = pd.DataFrame({
                        'h': h.samples, 'v': v.samples,
                        'h_d': np.gradient(h.samples), 'v_d': np.gradient(v.samples),
                        'speed': np.sqrt(np.gradient(h.samples)**2 + np.gradient(v.samples)**2),
                    })
                    fs = 1.0 / (h.timestamps[1] - h.timestamps[0]) if len(h.timestamps) > 1 else 30.0
                    win = int(0.5 * fs)
                    df['h_var'] = df['h'].rolling(window=win).var().fillna(0)
                    df['v_var'] = df['v'].rolling(window=win).var().fillna(0)
                    sig_seq = df[['h', 'v', 'h_d', 'v_d', 'speed', 'h_var', 'v_var']].values.astype(np.float32)
                    case_key = os.path.splitext(os.path.basename(mf4_path))[0]
                    vid_emb = self.video_extractor.get_embeddings_for_interval(video_path, h.timestamps[0], h.timestamps[-1], case_key)
                    if vid_emb is not None:
                        predictions = self.mm_trainer.predict_intervals(sig_seq, vid_emb)
            except Exception:
                pass
        
        if predictions is None and self.ml_engine.model is not None:
            predictions = self.ml_engine.predict_intervals(h.timestamps, h.samples, v.samples)
            
        if predictions:
            for i in range(0, len(predictions), 2):
                if i+1 < len(predictions):
                    start, end = predictions[i], predictions[i+1]
                    lr = pg.LinearRegionItem([start, end], movable=False, brush=pg.mkBrush(243, 146, 0, 80))
                    self.preview_plot.addItem(lr)
                    
                    # Add interval label on top
                    text = pg.TextItem("DISTRACTION", color='#F39200', anchor=(0.5, 0))
                    # Place text near top of Y axis
                    y_range = self.preview_plot.getViewBox().viewRange()[1]
                    text.setPos((start + end) / 2, y_range[1] * 0.85)
                    self.preview_plot.addItem(text)

    def log_status(self, msg):
        self.lbl_task_info.setText(msg)

    def update_progress(self, val):
        if self.mm_phase == "extracting":
            self.progress_bar.set_progress(int(val * 30))
        elif self.mm_phase == "building":
            self.progress_bar.set_progress(int(30 + val * 20))
        else:
            self.progress_bar.set_progress(int(val * 100))

    def on_epoch_progress(self, *args):
        if len(args) == 3:
            epoch, loss, acc = args
            f1 = 0.0
            val_loss = 0.0
        elif len(args) == 4:
            epoch, loss, acc, f1 = args
            val_loss = 0.0
        elif len(args) >= 5:
            epoch, loss, acc, f1, val_loss = args[0], args[1], args[2], args[3], args[4]
        else:
            return
        
        self.loss_data.append(loss)
        self.acc_data.append(acc)
        if f1 > 0:
            self.f1_data.append(f1)
        if val_loss > 0:
            self.val_loss_data.append(val_loss)
        
        self.loss_curve.setData(self.loss_data)
        self.acc_curve.setData(self.acc_data)
        if self.f1_data:
            self.f1_curve.setData(self.f1_data)
        if self.val_loss_data:
            self.val_loss_curve.setData(self.val_loss_data)
            self.val_loss_overlay.setData(self.val_loss_data)
        
        self.lbl_new_prec.setText(f"{acc*100:.1f} %")
        
        # Update delta indicator
        if hasattr(self, 'lbl_delta'):
            old_text = self.lbl_old_prec.text().replace("%", "").strip()
            try:
                old_val = float(old_text)
                new_val = acc * 100
                delta = new_val - old_val
                sign = "\u2191" if delta >= 0 else "\u2193"
                color = "#4caf50" if delta >= 0 else "#e74c3c"
                self.lbl_delta.setText(f"{sign} {abs(delta):.1f}%")
                self.lbl_delta.setStyleSheet(f"color: {color}; font-size: 10pt; font-weight: bold; background: transparent; border: none;")
            except (ValueError, AttributeError):
                pass
        
        epochs_total = self.spin_epochs.value()
        if self.mm_phase == "training":
            train_pct = epoch / epochs_total
            self.progress_bar.set_progress(int(50 + train_pct * 50))
        
        elapsed = time.time() - self.training_start_time
        epochs_total = self.spin_epochs.value()
        time_per_epoch = elapsed / epoch if epoch > 0 else 0
        rem = (epochs_total - epoch) * time_per_epoch
        
        mode_str = "CNN+LSTM" if self.training_mode == "multimodal" else "MLP"
        extra = f" | F1: {f1*100:.1f}%" if f1 > 0 else ""
        val_str = f" | Val Loss: {val_loss:.4f}" if val_loss > 0 else ""
        self.lbl_footer_status.setText(f"[{mode_str}] Epoch {epoch}/{epochs_total} | {int(rem)}s remaining{extra}{val_str}")

    def toggle_training(self):
        if self.training_active:
            return
        self._start_training()

    def _start_training(self):
        if not self.selected_projects:
            self.log_status("Error: Select at least one project for training.")
            return
            
        selected = [p for p in self.added_projects if os.path.normpath(p) in self.selected_projects]
        if not selected:
            self.log_status("Error: No valid projects selected for training.")
            return
        
        model_name = self.combo_model.currentText()
        epochs = self.spin_epochs.value()
        lr = self.spin_lr.value()
        patience = self.spin_patience.value()
        self._training_paused = False
        
        self.training_active = True
        self.btn_train.setEnabled(False)
        self.btn_pause.setEnabled(True)
        self.btn_stop.setEnabled(True)
        self.btn_pause.setText(" PAUSE")
        self.lbl_braille.show()
        self.progress_bar.show()
        self.lbl_footer_status.setStyleSheet("color: #aaa; font-weight: normal; font-family: 'Switzer'; font-size: 10pt;")
        self.training_start_time = time.time()
        self.progress_bar.set_progress(0)
        self.eta_timer.start(1000)
        
        self.loss_data.clear()
        self.acc_data.clear()
        self.val_loss_data.clear()
        self.f1_data.clear()
        self.loss_curve.setData([])
        self.acc_curve.setData([])
        self.f1_curve.setData([])
        self.val_loss_curve.setData([])
        self.val_loss_overlay.setData([])
        
        camera_config = {p: self.project_camera_config.get(os.path.normpath(p), "auto") for p in selected}
        
        if self.training_mode == "multimodal":
            self.mm_phase = "extracting"
            self.lbl_footer_status.setText("Extracting video features...")
            output_dir = os.path.join(os.path.dirname(self.mm_trainer.base_models_dir), "mm_dataset")
            self.mm_trainer._current_lr = lr
            self.mm_trainer._camera_config = camera_config
            self.mm_training_thread = MultimodalTrainingWorker(
                self.dataset_builder, self.mm_trainer, self.video_extractor,
                selected, output_dir, model_name, epochs, lr, camera_config, patience, self
            )
            self.mm_training_thread.phase_changed.connect(self.on_mm_phase_changed)
            self.mm_training_thread.current_video.connect(self._on_current_video)
            self.mm_training_thread.extraction_progress.connect(self.update_progress)
            self.mm_trainer.finished.connect(self.on_training_finished)
            self.mm_training_thread.start()
            self.braille_timer.start(100)
        else:
            self.lbl_footer_status.setText("Building dataset...")
            csv_path = os.path.join(os.path.dirname(self.ml_engine.base_models_dir), "training_data.csv")
            self.training_thread = TrainingWorker(self.dataset_builder, self.ml_engine, selected, csv_path, model_name, epochs, lr, self)
            self.training_thread.finished_ok.connect(self.on_training_finished)
            self.training_thread.failed.connect(self.on_training_failed)
            self.training_thread.start()
            self.braille_timer.start(100)

    def _stop_training(self):
        self.training_active = False
        if self.mm_training_thread and self.mm_training_thread.isRunning():
            self.mm_training_thread.terminate()
            self.mm_training_thread.wait(1000)
        if self.training_thread and self.training_thread.isRunning():
            self.training_thread.terminate()
            self.training_thread.wait(1000)
        self._reset_training_ui("Training stopped by user")

    def _reset_training_ui(self, status_text="AI Ready"):
        self.mm_phase = None
        self.braille_timer.stop()
        self.eta_timer.stop()
        self.lbl_braille.hide()
        self.progress_bar.hide()
        self.lbl_footer_status.setText(status_text)
        self.lbl_footer_status.setStyleSheet("color: #4caf50; font-weight: bold; font-family: 'Switzer'; font-size: 10pt;")
        self.lbl_task_info.setText("IDLE")
        self.btn_train.setEnabled(True)
        self.btn_pause.setEnabled(False)
        self.btn_stop.setEnabled(False)
        self.btn_pause.setText(" PAUSE")
        self._training_paused = False

    def toggle_pause_training(self):
        if not self.training_active:
            return
        self._training_paused = not self._training_paused
        if self._training_paused:
            self.btn_pause.setText(" RESUME")
            if self.mm_training_thread and self.mm_training_thread.isRunning():
                self.mm_trainer._pause_event.set() if hasattr(self.mm_trainer, '_pause_event') else None
            self.lbl_footer_status.setText("Training paused")
        else:
            self.btn_pause.setText(" PAUSE")
            if self.mm_training_thread and self.mm_training_thread.isRunning():
                self.mm_trainer._pause_event.clear() if hasattr(self.mm_trainer, '_pause_event') else None
            self.lbl_footer_status.setText("Training resumed")

    def stop_training(self):
        if not self.training_active:
            return
        self._stop_training()

    def _on_lr_changed(self, value):
        if hasattr(self, 'mm_trainer') and self.training_active:
            self.mm_trainer._current_lr = value

    def _on_current_video(self, video_name):
        self._current_video_name = video_name
        if self.lbl_footer_status.text().startswith("Extracting"):
            self.lbl_footer_status.setText(f"Extracting: {video_name}")

    def _update_eta(self):
        if not self.training_active:
            return
        elapsed = time.time() - self.training_start_time
        pct = self.progress_bar._progress
        if pct > 0.02:
            total_est = elapsed / pct
            rem = total_est - elapsed
            mins = int(rem // 60)
            secs = int(rem % 60)
            self.lbl_task_info.setText(f"ETA: {mins}m {secs}s")
        else:
            self.lbl_task_info.setText("Calculating ETA...")

    def on_mm_phase_changed(self, phase):
        self.mm_phase = phase
        if phase == "extracting":
            if self._current_video_name:
                self.lbl_footer_status.setText(f"Extracting: {self._current_video_name}")
            else:
                self.lbl_footer_status.setText("Extracting video features...")
        elif phase == "building":
            self.lbl_footer_status.setText("Building multimodal dataset...")
        elif phase == "training":
            self.lbl_footer_status.setText("Training multimodal model...")
        elif phase.startswith("error:"):
            self.on_training_failed(phase.replace("error:", ""))
        elif phase == "failed":
            self.on_training_failed("Multimodal training failed.")

    def on_training_finished(self):
        self.training_active = False
        self._reset_training_ui("AI Ready")
        self.lbl_task_info.setText("Training completed successfully")
        self.refresh_model_ui()
        
    def on_training_failed(self, err):
        self.training_active = False
        self._reset_training_ui("AI Error")
        self.lbl_footer_status.setStyleSheet("color: #f44336; font-weight: bold; font-family: 'Switzer'; font-size: 10pt;")
        self.log_status(f"Training failed: {err}")

    def on_dataset_ready(self, csv_path):
        pass

    def on_multimodal_dataset_ready(self, result):
        pass

    def export_onnx(self):
        if self.training_mode == "multimodal":
            if self.mm_trainer.model is None:
                self.lbl_export_result.setText("No multimodal model loaded.")
                self.lbl_export_result.setStyleSheet("color: #e74c3c; font-size: 9pt;")
                return
            try:
                import torch as _torch
                sig_dim = self.mm_trainer.metadata.get("signal_dim", 7)
                vid_dim = self.mm_trainer.metadata.get("video_dim", 1284)
                dummy_sig = _torch.randn(1, 60, sig_dim)
                dummy_vid = _torch.randn(1, 60, vid_dim)
                path = os.path.join(os.path.dirname(self.mm_trainer.model_path), "model.onnx")
                _torch.onnx.export(
                    self.mm_trainer.model, (dummy_sig, dummy_vid), path,
                    input_names=["signal", "video"], output_names=["prediction"]
                )
                size_mb = os.path.getsize(path) / (1024 * 1024)
                self.lbl_export_result.setText(f"ONNX exported: {path}\nSize: {size_mb:.1f} MB")
                self.lbl_export_result.setStyleSheet("color: #2ecc71; font-size: 9pt;")
            except ImportError:
                self.lbl_export_result.setText("onnx package not installed. Run: pip install onnx")
                self.lbl_export_result.setStyleSheet("color: #e74c3c; font-size: 9pt;")
            except Exception as e:
                self.lbl_export_result.setText(f"Export failed: {e}")
                self.lbl_export_result.setStyleSheet("color: #e74c3c; font-size: 9pt;")
        else:
            self.lbl_export_result.setText("ONNX export only supported for multimodal models.")
            self.lbl_export_result.setStyleSheet("color: #f39c12; font-size: 9pt;")

    def _on_history_double_click(self, index):
        """Double-click a build in history table to load it in the model selector."""
        row = index.row()
        build_item = self.history_table.item(row, 0)
        if build_item:
            build_name = build_item.text()
            # Find the model selector combo and select matching entry
            idx = self.model_selector.findText(build_name, Qt.MatchContains)
            if idx >= 0:
                self.model_selector.setCurrentIndex(idx)
            else:
                self.log_status(f"Build '{build_name}' not found in model selector")

    def _export_model_archive(self):
        """Export the current model directory as a .zip archive."""
        engine = self.mm_trainer if self.training_mode == "multimodal" else self.ml_engine
        model_path = getattr(engine, 'model_path', None)
        if not model_path or not os.path.exists(model_path):
            self.lbl_export_result.setText("No model loaded to export.")
            self.lbl_export_result.setStyleSheet("color: #e74c3c; font-size: 9pt;")
            return
        
        model_dir = os.path.dirname(model_path)
        build_name = os.path.basename(model_dir)
        
        save_path, _ = QFileDialog.getSaveFileName(
            self, "Export Model Archive", f"{build_name}.zip", "ZIP Archives (*.zip)"
        )
        if not save_path:
            return
        
        try:
            import zipfile
            with zipfile.ZipFile(save_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for root, dirs, files in os.walk(model_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, os.path.dirname(model_dir))
                        zf.write(file_path, arcname)
            
            size_mb = os.path.getsize(save_path) / (1024 * 1024)
            self.lbl_export_result.setText(f"Archive exported: {os.path.basename(save_path)}\nSize: {size_mb:.1f} MB")
            self.lbl_export_result.setStyleSheet("color: #2ecc71; font-size: 9pt;")
        except Exception as e:
            self.lbl_export_result.setText(f"Archive export failed: {e}")
            self.lbl_export_result.setStyleSheet("color: #e74c3c; font-size: 9pt;")
