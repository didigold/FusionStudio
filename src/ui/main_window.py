import os
import sys
from datetime import datetime
from PySide6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                               QFrame, QStackedWidget, QSplitter, QLineEdit, QPushButton, 
                               QTreeWidget, QTreeWidgetItem, QProgressBar, QCheckBox, 
                               QTabWidget, QTextEdit, QFileDialog, QButtonGroup, QRadioButton, QMessageBox, 
                               QHeaderView, QTableWidgetItem, QAbstractItemView, QSizePolicy, QGridLayout)
from PySide6.QtCore import Qt, QTimer, QPropertyAnimation, QUrl, QEasingCurve
from PySide6.QtGui import QIcon, QFont, QColor
from PySide6.QtWidgets import QListWidget, QGraphicsOpacityEffect

from src.core.utils import resource_path
from src.ui.styles import STYLESHEET, IDIADA_ORANGE
from src.ui.widgets import (ExpandableSidebar, LoadingSpinner, IconGroupBox, AnimatedToggle, 
                            SignalDropTable, PlottingDashboard, AnimatedExpandButton, FadeNotification, NotificationOverlay, setup_tab_icon_switching)
from src.core.fusion_worker import ParticipantScanner, PreviewSignalsWorker, FusionWorker
from src.ui.classification_widget import ClassificationWidget
from src.ui.analysis_widget import AnalysisWidget
from src.ui.om_analysis_widget import OMAnalysisWidget
from src.ui.reporting_widget import ReportingWidget
from src.ui.ai_brain_widget import AIBrainWidget

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Fusion Studio | Applus+ IDIADA")
        self.resize(1300, 850)
        self.setWindowIcon(QIcon(resource_path("assets/icon.ico")))
        self.setStyleSheet(STYLESHEET)
        self.active_signals = []
        self.master_file_for_plot = None
        self.total_participants_to_process = 0
        self.completed_participants = 0

        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        self.layout_main = QVBoxLayout(main_widget)
        self.layout_main.setContentsMargins(0,0,0,0)
        self.layout_main.setSpacing(0)
        self.create_header()
        h_layout = QHBoxLayout()
        h_layout.setSpacing(0)
        h_layout.setContentsMargins(0,0,0,0)
        
        # Add a placeholder for the sidebar in the horizontal layout
        self.sidebar_placeholder = QWidget()
        self.sidebar_placeholder.setFixedWidth(60)
        self.sidebar_placeholder.setStyleSheet("background-color: #222; border-right: 1px solid #444;")
        h_layout.addWidget(self.sidebar_placeholder)
        
        self.stack = QStackedWidget()
        self.init_tab_fuse()
        self.init_tab_analysis()
        self.init_tab_classification()
        self.init_tab_reporting()
        self.init_tab_om_analysis()
        
        # Placeholder for Signal Mining (Index 5)
        self.stack.addWidget(QWidget()) 
        
        self.init_tab_ai_mark() # Index 6
        
        h_layout.addWidget(self.stack)
        self.layout_main.addLayout(h_layout)
        self.create_footer()
        
        # Transparent overlay that dims the main window when sidebar expands
        self.sidebar_overlay = QWidget(self)
        self.sidebar_overlay.setStyleSheet("background-color: rgba(0, 0, 0, 150);")
        self.sidebar_overlay.hide()
        
        self.sidebar_overlay_opacity = QGraphicsOpacityEffect(self.sidebar_overlay)
        self.sidebar_overlay.setGraphicsEffect(self.sidebar_overlay_opacity)
        self.sidebar_overlay_opacity.setOpacity(0)
        self.overlay_anim = QPropertyAnimation(self.sidebar_overlay_opacity, b"opacity")
        self.overlay_anim.setDuration(250)
        
        # Add actual sidebar as a floating widget
        self.sidebar = ExpandableSidebar(self)
        self.sidebar.tab_changed.connect(self.change_tab)
        self.sidebar.expanded.connect(self.toggle_sidebar_overlay)
        
        self.anim_timer = QTimer()
        self.anim_timer.timeout.connect(self.update_spinner)
        
        self.spinner = LoadingSpinner(self.lbl_activity) 
        self.spinner_chars = ["⢿", "⣻", "⣽", "⣾", "⣷", "⣯", "⣟", "⡿"]
        self.spinner_idx = 0
        self.cleaning_mode = False 
        
        self.notification_overlay = NotificationOverlay(self)
        self.sidebar.raise_()
        self.notification_overlay.raise_()

    def resizeEvent(self, event):
        super().resizeEvent(event)
        if hasattr(self, 'sidebar') and hasattr(self, 'stack'):
            header_height = 60
            footer_height = 35
            available_height = self.height() - header_height - footer_height
            self.sidebar.setGeometry(0, header_height, self.sidebar.width(), available_height)
            
            if hasattr(self, 'sidebar_overlay'):
                self.sidebar_overlay.setGeometry(60, header_height, self.width() - 60, available_height)

    def toggle_sidebar_overlay(self, expanded):
        self.overlay_anim.stop()
        if expanded:
            self.sidebar_overlay.show()
            self.overlay_anim.setStartValue(self.sidebar_overlay_opacity.opacity())
            self.overlay_anim.setEndValue(1.0)
        else:
            self.overlay_anim.setStartValue(self.sidebar_overlay_opacity.opacity())
            self.overlay_anim.setEndValue(0.0)
            self.overlay_anim.finished.connect(self.hide_overlay_wrapper)
        self.overlay_anim.start()
        
    def hide_overlay_wrapper(self):
        self.overlay_anim.finished.disconnect(self.hide_overlay_wrapper)
        if self.sidebar_overlay_opacity.opacity() == 0:
            self.sidebar_overlay.hide()
        
    def toggle_notification_overlay(self):
        self.notification_overlay.toggle_overlay()
        self.lbl_unread.hide()
        
    def show_global_notification(self, text, notif_type="info", duration=3000):
        if not hasattr(self, '_active_toasts'):
            self._active_toasts = []
            
        # Cleanup dead toast references safely
        valid_toasts = []
        for t in self._active_toasts:
            try:
                # Accessing isHidden() will trigger RuntimeError if C++ object is deleted
                if t is not None and not t.isHidden():
                    valid_toasts.append(t)
            except RuntimeError:
                continue # Object already deleted
        self._active_toasts = valid_toasts
        
        # Show toast
        toast = FadeNotification(self, text, duration=duration, notif_type=notif_type)
        
        # Calculate Y position offset based on existing toasts
        current_offset = 0
        spacing = 10
        for t in self._active_toasts:
            current_offset += t.height() + spacing
            
        toast.show_notification(y_offset=current_offset)
        self._active_toasts.append(toast)
        
        # Add to history
        self.notification_overlay.add_notification(text, notif_type)
        
        # Update badge
        if not self.notification_overlay.isVisible():
            self.lbl_unread.show()

    def change_tab(self, index): 
        self.fade_anim = QPropertyAnimation(self.stack, b"windowOpacity")
        self.fade_anim.setDuration(150)
        self.fade_anim.setStartValue(1.0)
        self.fade_anim.setEndValue(0.0)
        self.fade_anim.finished.connect(lambda: self._switch_and_fade_in(index))
        self.fade_anim.start()
    def _switch_and_fade_in(self, index):
        self.stack.setCurrentIndex(index)
        self.fade_in_anim = QPropertyAnimation(self.stack, b"windowOpacity")
        self.fade_in_anim.setDuration(150)
        self.fade_in_anim.setStartValue(0.0)
        self.fade_in_anim.setEndValue(1.0)
        self.fade_in_anim.start()
    def create_header(self):
        header = QFrame()
        header.setStyleSheet(f"background-color: #222; border-bottom: 2px solid {IDIADA_ORANGE};")
        header.setFixedHeight(60)
        hl = QHBoxLayout(header)
        title = QLabel("Fusion Studio")
        title.setStyleSheet("font-size: 20px; font-weight: bold; color: white; border: none;")
        subtitle = QLabel("Applus+ IDIADA")
        subtitle.setStyleSheet(f"font-size: 20px; font-weight: bold; color: {IDIADA_ORANGE}; border: none;")
        self.lbl_activity = QLabel("")
        self.lbl_activity.setFixedSize(45,45)
        self.lbl_activity.setAlignment(Qt.AlignCenter)
        self.lbl_activity.setStyleSheet(f"color: {IDIADA_ORANGE}; font-size: 24px; font-weight: bold; border: none;")
        hl.addWidget(title)
        hl.addSpacing(10)
        hl.addWidget(subtitle)
        hl.addStretch()
        
        self.btn_notif = QPushButton()
        self.btn_notif.setIcon(QIcon(resource_path("assets/icons/notifications_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_notif.setFixedSize(30, 30)
        self.btn_notif.setCursor(Qt.PointingHandCursor)
        self.btn_notif.setStyleSheet("background: transparent; border: none;")
        self.btn_notif.clicked.connect(self.toggle_notification_overlay)
        
        self.lbl_unread = QLabel("•", self.btn_notif)
        self.lbl_unread.setStyleSheet(f"color: {IDIADA_ORANGE}; font-size: 18px; font-weight: bold; background: transparent;")
        self.lbl_unread.setGeometry(18, 0, 10, 10)
        self.lbl_unread.hide()
        
        hl.addWidget(self.btn_notif)
        hl.addSpacing(15)
        
        hl.addWidget(self.lbl_activity)
        hl.addSpacing(20)
        self.layout_main.addWidget(header)
    def create_footer(self):
        footer = QFrame()
        footer.setStyleSheet("background-color: #222; border-top: 1px solid #444;")
        footer.setFixedHeight(35)
        fl = QHBoxLayout(footer)
        fl.setContentsMargins(10, 0, 10, 0)
        fl.setSpacing(10)
        lbl_lic = QLabel("© 2026 Applus+ IDIADA | Licensed for Internal Use")
        lbl_lic.setStyleSheet("color: #666; font-size: 10px;")
        fl.addWidget(lbl_lic)
        fl.addStretch()
        self.lbl_spinner_footer = QLabel("")
        self.lbl_spinner_footer.setStyleSheet(f"color: {IDIADA_ORANGE}; font-size: 14px; font-weight: bold; min-width: 30px;")
        self.lbl_spinner_footer.setAlignment(Qt.AlignCenter)
        fl.addWidget(self.lbl_spinner_footer)
        self.lbl_stats = QLabel("Ready")
        self.lbl_stats.setStyleSheet(f"color: #aaa; font-weight: bold; min-width: 150px; text-align: right;")
        fl.addWidget(self.lbl_stats)
        self.layout_main.addWidget(footer)
    def init_tab_fuse(self):
        splitter = QSplitter(Qt.Horizontal)
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        left_layout.setContentsMargins(20,20,20,20)
        
        self.tabs_left = QTabWidget()
        self.tabs_left.tabBar().setCursor(Qt.PointingHandCursor)
        
        tab_src = QWidget()
        layout_src_v = QVBoxLayout(tab_src)
        layout_src_v.setContentsMargins(10, 15, 10, 15)
        
        layout_src_main = QHBoxLayout()

        layout_path = QHBoxLayout()
        layout_path.addSpacing(15) 
        self.txt_src = QLineEdit()
        self.txt_src.setPlaceholderText("Select folder...")
        self.txt_src.setFixedWidth(380) 
        # CONEXIÓN DE SINCRONIZACIÓN (Parent -> Child)
        self.txt_src.textChanged.connect(self.sync_path_to_classification)
        
        btn_src = QPushButton("") 
        # RUTA ABSOLUTA
        btn_src.setIcon(QIcon(resource_path("assets/icons/folder_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        btn_src.setFixedWidth(32)
        btn_src.setFixedHeight(32)
        btn_src.setCursor(Qt.PointingHandCursor)
        btn_src.clicked.connect(self.select_source)
        layout_path.addWidget(self.txt_src)
        layout_path.addWidget(btn_src)
        layout_path.addStretch()

        layout_toggles = QGridLayout()
        layout_toggles.setVerticalSpacing(5)
        layout_toggles.setHorizontalSpacing(15)

        lbl_vid = QLabel("Copy Videos:")
        self.toggle_vid = AnimatedToggle()
        self.lbl_vid_status = QLabel("OFF")
        self.lbl_vid_status.setStyleSheet("color: #888; font-weight: bold; font-size: 11px;")
        self.toggle_vid.stateChanged.connect(lambda s: self.lbl_vid_status.setText("ON" if s else "OFF"))
        self.toggle_vid.stateChanged.connect(lambda s: self.lbl_vid_status.setStyleSheet(f"color: {'#2da44e' if s else '#888'}; font-weight: bold; font-size: 11px;"))
        
        layout_toggles.addWidget(lbl_vid, 0, 0, Qt.AlignLeft)
        layout_toggles.addWidget(self.toggle_vid, 0, 1)
        layout_toggles.addWidget(self.lbl_vid_status, 0, 2)

        lbl_ovr = QLabel("Force Overwrite:")
        self.toggle_overwrite = AnimatedToggle(active_color="#d1242f") 
        self.lbl_ovr_status = QLabel("OFF")
        self.lbl_ovr_status.setStyleSheet("color: #888; font-weight: bold; font-size: 11px;")
        self.toggle_overwrite.stateChanged.connect(lambda s: self.lbl_ovr_status.setText("ON" if s else "OFF"))
        self.toggle_overwrite.stateChanged.connect(lambda s: self.lbl_ovr_status.setStyleSheet(f"color: {'#d1242f' if s else '#888'}; font-weight: bold; font-size: 11px;"))
        
        layout_toggles.addWidget(lbl_ovr, 1, 0, Qt.AlignLeft)
        layout_toggles.addWidget(self.toggle_overwrite, 1, 1)
        layout_toggles.addWidget(self.lbl_ovr_status, 1, 2)

        layout_src_main.addLayout(layout_path)
        layout_src_main.addStretch()
        layout_src_main.addLayout(layout_toggles)
        layout_src_main.addSpacing(20) 
        
        layout_src_v.addLayout(layout_src_main)
        layout_src_v.addStretch()
        
        self.tabs_left.addTab(tab_src, QIcon(resource_path("assets/icons/hub_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")), "Project Source")

        tab_parts = QWidget()
        l_parts = QVBoxLayout(tab_parts)
        # FIX: Añadir columna extra para Mini ProgressBar (Columna 3)
        self.tree_parts = QTreeWidget()
        self.tree_parts.setHeaderLabels(["Participant", "Masters", "Status", "Progress"]) 
        self.tree_parts.setColumnWidth(0, 150)
        self.tree_parts.setColumnWidth(1, 70) 
        self.tree_parts.setColumnWidth(2, 100)
        # La columna 3 será para la barra
        l_parts.addWidget(self.tree_parts)
        h_tree_btns = QHBoxLayout()
        
        # --- RADIO BUTTONS PARA SELECCIÓN ---
        self.radio_group_select = QButtonGroup(self)
        self.radio_all = QRadioButton("Select All")
        self.radio_none = QRadioButton("Select None")
        self.radio_inc = QRadioButton("Select Incomplete")

        # Hacer que "Select All" esté seleccionado por defecto
        self.radio_all.setChecked(True)

        self.radio_group_select.addButton(self.radio_all)
        self.radio_group_select.addButton(self.radio_none)
        self.radio_group_select.addButton(self.radio_inc)

        self.radio_all.clicked.connect(lambda: self.toggle_tree(True))
        self.radio_none.clicked.connect(lambda: self.toggle_tree(False))
        self.radio_inc.clicked.connect(self.check_pending_only)

        h_tree_btns.addWidget(self.radio_all)
        h_tree_btns.addWidget(self.radio_none)
        h_tree_btns.addWidget(self.radio_inc)
        
        setup_tab_icon_switching(self.tabs_left, [
            ("hub_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png", "hub_16dp_FFFFFF_FILL1_wght400_GRAD0_opsz20.png"),
            ("group_search_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png", "group_search_16dp_FFFFFF_FILL1_wght400_GRAD0_opsz20.png")
        ])
        
        l_parts.addLayout(h_tree_btns)
        
        self.tabs_left.addTab(tab_parts, QIcon(resource_path("assets/icons/group_search_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")), "Participant Status")
        left_layout.addWidget(self.tabs_left)
        
        # --- CONTROLS LAYOUT ---
        h_controls = QHBoxLayout()
        
        self.btn_run = QPushButton("START FUSION")
        self.btn_run.setObjectName("PrimaryBtn")
        self.btn_run.setMinimumHeight(45)
        self.btn_run.setCursor(Qt.PointingHandCursor)
        self.btn_run.setIcon(QIcon(resource_path("assets/icons/play_circle_16dp_000000_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_run.setIconSize(self.btn_run.iconSize() * 1.5) # Bigger icon
        self.btn_run.clicked.connect(self.toggle_fusion_state)
        
        self.btn_stop = QPushButton("STOP")
        self.btn_stop.setMinimumHeight(45)
        self.btn_stop.setFixedWidth(100)
        self.btn_stop.setIcon(QIcon(resource_path("assets/icons/stop_circle_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        # Default: Gray (Disabled)
        self.btn_stop.setStyleSheet(f"background-color: #555; color: #aaa; border-radius: 4px; font-weight: bold;") 
        self.btn_stop.setCursor(Qt.ArrowCursor)
        self.btn_stop.clicked.connect(self.stop_fusion_process)
        self.btn_stop.setEnabled(False)

        h_controls.addWidget(self.btn_run)
        h_controls.addWidget(self.btn_stop)
        
        left_layout.addLayout(h_controls)
        
        # left_layout.addWidget(self.btn_run) <-- REMOVED (Added to h_controls above)
        
        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)
        right_layout.setContentsMargins(10,20,20,20)
        right_layout.setSpacing(10)

        self.tabs_top_right = QTabWidget()
        self.tabs_top_right.tabBar().setCursor(Qt.PointingHandCursor)

        tab_filter = QWidget()
        l_sig = QVBoxLayout(tab_filter)
        l_sig.setContentsMargins(10, 10, 10, 10)
        h_filter_header = QHBoxLayout()
        self.chk_master_signals = QCheckBox("")
        self.chk_master_signals.setToolTip("Select All Signals")
        self.chk_master_signals.setCursor(Qt.PointingHandCursor)
        self.chk_master_signals.setStyleSheet(f"""
            QCheckBox {{ font-weight: bold; color: {IDIADA_ORANGE}; font-size: 14px; padding: 5px; border: 1px solid #444; border-radius: 4px; }}
            QCheckBox:hover {{ border: 1px solid {IDIADA_ORANGE}; background-color: #333; }}
        """)
        self.chk_master_signals.clicked.connect(self.on_master_signal_toggle)
        self.btn_unload_master = QPushButton()
        # RUTA ABSOLUTA
        self.btn_unload_master.setIcon(QIcon(resource_path("assets/icons/backspace_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_unload_master.setToolTip("Unload Master File")
        self.btn_unload_master.setFixedSize(32, 32)
        self.btn_unload_master.setCursor(Qt.PointingHandCursor)
        self.btn_unload_master.clicked.connect(self.unload_master_file)
        self.txt_search_sig = QLineEdit()
        self.txt_search_sig.setPlaceholderText("Search signals...")
        # RUTA ABSOLUTA
        self.txt_search_sig.addAction(QIcon(resource_path("assets/icons/search_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")), QLineEdit.LeadingPosition)
        self.txt_search_sig.textChanged.connect(self.filter_signals_list)
        h_filter_header.addWidget(self.chk_master_signals)
        h_filter_header.addWidget(self.btn_unload_master)
        h_filter_header.addWidget(self.txt_search_sig)
        l_sig.addLayout(h_filter_header)
        self.table_signals = SignalDropTable()
        self.table_signals.setColumnCount(3)
        self.table_signals.setHorizontalHeaderLabels(["Signal Name", "Samples", "Group/Source"])
        self.table_signals.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.table_signals.horizontalHeader().setSectionResizeMode(1, QHeaderView.Interactive)
        self.table_signals.horizontalHeader().setSectionResizeMode(2, QHeaderView.Interactive)
        self.table_signals.file_dropped.connect(self.load_reference_master)
        self.table_signals.request_load.connect(self.browse_reference_master)
        self.table_signals.itemChanged.connect(self.on_signal_item_changed)
        self.table_signals.itemDoubleClicked.connect(self.plot_signal_on_double_click)
        l_sig.addWidget(self.table_signals)
        self.lbl_sig_count = QLabel("0 signals selected (ALL will be kept)")
        self.lbl_sig_count.setStyleSheet("color: #888; font-style: italic;")
        l_sig.addWidget(self.lbl_sig_count)

        self.tabs_top_right.addTab(tab_filter, QIcon(resource_path("assets/icons/filter_alt_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")), "Signal Filter")

        self.list_selected_signals = QListWidget()
        self.list_selected_signals.setStyleSheet("background-color: #1e1e1e; color: #ccc; font-family: Consolas; font-size: 11px;")
        self.list_selected_signals.itemDoubleClicked.connect(self.remove_selected_signal)
        self.tabs_top_right.addTab(self.list_selected_signals, QIcon(resource_path("assets/icons/list_alt_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")), "Selection List")

        self.plot_dashboard = PlottingDashboard()
        # RUTA ABSOLUTA
        self.tabs_top_right.addTab(self.plot_dashboard, QIcon(resource_path("assets/icons/insert_chart_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.png")), "Plot Signals")
        right_layout.addWidget(self.tabs_top_right, 1)

        setup_tab_icon_switching(self.tabs_top_right, [
            ("filter_alt_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png", "filter_alt_16dp_FFFFFF_FILL1_wght400_GRAD0_opsz20.png"),
            ("list_alt_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png", "list_alt_16dp_FFFFFF_FILL1_wght400_GRAD0_opsz20.png"),
            ("eye_tracking_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.png", "eye_tracking_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.png")
        ])

        self.log_container = QWidget()
        log_layout = QVBoxLayout(self.log_container)
        log_layout.setContentsMargins(0, 0, 0, 0)
        log_layout.setSpacing(0)

        self.btn_toggle_log = AnimatedExpandButton("Process Log", "keyboard_arrow_up_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png", left_icon_filename="terminal_2_16dp_FFFFFF_FILL1_wght400_GRAD0_opsz20.png")
        self.btn_toggle_log.clicked.connect(self.toggle_process_log)
        
        self.log_content = QWidget()
        l_log_tab = QVBoxLayout(self.log_content)
        l_log_tab.setContentsMargins(0, 5, 0, 0)
        self.txt_log = QTextEdit()
        self.txt_log.setReadOnly(True)
        self.txt_log.setFont(QFont("Consolas", 9))
        self.txt_log.setStyleSheet("background-color: #1e1e1e; color: #ccc;")
        l_log_tab.addWidget(self.txt_log)
        
        log_layout.addWidget(self.btn_toggle_log)
        log_layout.addWidget(self.log_content)
        
        right_layout.addWidget(self.log_container, 0)
        
        self.log_expanded = True

        splitter.addWidget(left_widget)
        splitter.addWidget(right_widget)
        splitter.setStretchFactor(0, 1)
        splitter.setStretchFactor(1, 1)
        self.stack.addWidget(splitter)

    def init_tab_analysis(self):
        self.analysis_tab = AnalysisWidget(self)
        # Connect busy signal to global braille spinner
        self.analysis_tab.busy_changed.connect(self.on_analysis_busy_changed)
        self.stack.addWidget(self.analysis_tab)

    def on_analysis_busy_changed(self, is_busy):
        """Start or stop the global braille spinner based on AnalysisWidget state."""
        if is_busy:
            if not self.anim_timer.isActive():
                self.anim_timer.start(100)
        else:
            self.anim_timer.stop()
            self.lbl_activity.setText("")

    def init_tab_classification(self):
        self.classification_tab = ClassificationWidget(self)
        self.stack.addWidget(self.classification_tab)

    def init_tab_reporting(self):
        self.reporting_tab = ReportingWidget(self)
        self.stack.addWidget(self.reporting_tab)

    def init_tab_om_analysis(self):
        self.om_analysis_tab = OMAnalysisWidget(self)
        self.om_analysis_tab.busy_changed.connect(self.on_analysis_busy_changed)
        self.stack.addWidget(self.om_analysis_tab)

    def init_tab_ai_mark(self):
        self.ai_mark_tab = AIBrainWidget(self)
        self.stack.addWidget(self.ai_mark_tab)

    def sync_path_to_classification(self, text):
        """Si cambia el path en Fusion, se actualiza en Classification si existe."""
        if hasattr(self, 'classification_tab'):
            if hasattr(self.classification_tab, 'txt_source'):
                if self.classification_tab.txt_source.text() != text:
                    self.classification_tab.txt_source.setText(text)

    def select_source(self):
        d = QFileDialog.getExistingDirectory(self, "Select Project Source Folder")
        if d:
            self.txt_src.setText(d)
            self.scan_participants(d)
    def scan_participants(self, folder):
        self.tree_parts.clear()
        self.btn_run.setEnabled(False)
        self.log("Scanning participants...")
        self.anim_timer.start(100) # Activamos animacion
        self.scanner = ParticipantScanner(folder)
        self.scanner.finished.connect(self.on_scan_finished)
        self.scanner.start()
    
    def on_scan_finished(self, results):
        self.anim_timer.stop() 
        self.lbl_activity.setText("")
        self.btn_run.setEnabled(True)
        
        for res in results:
            # Crear Padre (Participante)
            item = QTreeWidgetItem(self.tree_parts)
            item.setText(0, res["name"])
            
            # CORRECCIÓN: Contar solo masters
            total_masters = len(res["masters"])
            item.setText(1, str(total_masters)) 
            
            # --- STATUS MEJORADO ---
            item.setText(2, res["status_text"]) # Texto detallado
            item.setForeground(2, QColor(res["color"])) # Color dinámico
            
            item.setText(3, "") # Placeholder para progressbar
            
            item.setCheckState(0, Qt.Checked)
            
            # --- AGREGAR HIJOS: MASTERS ---
            if res["masters"]:
                m_node = QTreeWidgetItem(item)
                m_node.setText(0, "Masters Files")
                m_node.setExpanded(True)
                for m in res["masters"]:
                    m_item = QTreeWidgetItem(m_node)
                    m_item.setText(0, m)
                    m_item.setForeground(0, QColor("#aaa"))

            # --- AGREGAR HIJOS: SATÉLITES ---
            if res["satellites"]:
                s_node = QTreeWidgetItem(item)
                s_node.setText(0, "Satellite Files")
                s_node.setExpanded(False)
                for s in res["satellites"]:
                    s_item = QTreeWidgetItem(s_node)
                    s_item.setText(0, s)
                    s_item.setForeground(0, QColor("#888"))

        # --- AUTO-RESIZE COLUMNS ---
        for i in range(4):
            self.tree_parts.resizeColumnToContents(i)

        self.log(f"Scan complete. Found {len(results)} participants.")
        self.tabs_left.setCurrentIndex(1)
        self.show_global_notification(f"Project loaded! Found {len(results)} participants.", "success")

    def browse_reference_master(self):
        f, _ = QFileDialog.getOpenFileName(self, "Select ANY Master MF4", "", "MF4 (*.mf4)")
        if f: self.load_reference_master(f)
    def unload_master_file(self):
        self.table_signals.setRowCount(0)
        self.active_signals = []
        self.master_file_for_plot = None
        self.plot_dashboard.set_master_file(None)
        self.chk_master_signals.setCheckState(Qt.Unchecked)
        self.lbl_sig_count.setText("0 signals selected (ALL will be kept)")
        self.lbl_sig_count.setStyleSheet("color: #888; font-style: italic;")
        self.log("Master file unloaded. Table cleared.")
    def load_reference_master(self, file_path):
        if not file_path: return
        self.log(f"Loading reference signals from: {os.path.basename(file_path)}...")
        self.master_file_for_plot = file_path 
        self.plot_dashboard.set_master_file(file_path) 
        self.table_signals.setRowCount(0)
        self.anim_timer.start(100) 
        if hasattr(self, 'preview_worker') and self.preview_worker is not None:
             try:
                 self.preview_worker.quit()
                 self.preview_worker.wait()
             except: pass
        self.preview_worker = PreviewSignalsWorker(file_path)
        self.preview_worker.finished.connect(self.on_signals_loaded)
        self.preview_worker.error.connect(lambda e: self.log(f"Error loading signals: {e}"))
        self.preview_worker.start()
    def on_signals_loaded(self, data):
        self.anim_timer.stop() 
        self.lbl_activity.setText("")
        self.table_signals.setRowCount(len(data))
        self.table_signals.blockSignals(True)
        for row, item_data in enumerate(data):
            item_name = QTableWidgetItem(item_data["name"])
            item_name.setFlags(Qt.ItemIsUserCheckable | Qt.ItemIsEnabled | Qt.ItemIsSelectable)
            item_name.setCheckState(Qt.Unchecked)
            item_name.setToolTip("Double-click to visualize this signal in Plot Signals tab")
            item_name.setData(Qt.UserRole, item_data["g_idx"])
            item_name.setData(Qt.UserRole + 1, item_data["c_idx"])
            self.table_signals.setItem(row, 0, item_name)
            self.table_signals.setItem(row, 1, QTableWidgetItem(str(item_data["count"])))
            self.table_signals.setItem(row, 2, QTableWidgetItem(str(item_data["group"])))
        self.table_signals.blockSignals(False)
        self.log(f"Loaded {len(data)} signals. Please select signals to keep.")
        self.update_signal_count()
        self.chk_master_signals.setCheckState(Qt.Unchecked)
    def filter_signals_list(self, text):
        rows = self.table_signals.rowCount()
        for i in range(rows):
            item = self.table_signals.item(i, 0)
            if not text or text.lower() in item.text().lower():
                self.table_signals.setRowHidden(i, False)
            else:
                self.table_signals.setRowHidden(i, True)
    def on_master_signal_toggle(self):
        state = self.chk_master_signals.checkState()
        self.table_signals.blockSignals(True)
        for row in range(self.table_signals.rowCount()):
            if not self.table_signals.isRowHidden(row):
                self.table_signals.item(row, 0).setCheckState(state)
        self.table_signals.blockSignals(False)
        self.update_signal_count()
    def on_signal_item_changed(self, item):
        self.update_signal_count()
        checked_count = 0
        total_visible = 0
        rows = self.table_signals.rowCount()
        for i in range(rows):
            if not self.table_signals.isRowHidden(i):
                total_visible += 1
                if self.table_signals.item(i, 0).checkState() == Qt.Checked:
                    checked_count += 1
        self.chk_master_signals.blockSignals(True)
        if checked_count == 0:
            self.chk_master_signals.setCheckState(Qt.Unchecked)
        elif checked_count == total_visible:
            self.chk_master_signals.setCheckState(Qt.Checked)
        else:
            self.chk_master_signals.setCheckState(Qt.PartiallyChecked)
        self.chk_master_signals.blockSignals(False)
    def update_signal_count(self):
        count = 0
        self.active_signals = [] 
        rows = self.table_signals.rowCount()
        self.table_signals.viewport().update()
        for row in range(rows):
            item = self.table_signals.item(row, 0)
            if item.checkState() == Qt.Checked:
                count += 1
                g_idx = item.data(Qt.UserRole)
                c_idx = item.data(Qt.UserRole + 1)
                name = item.text()
                self.active_signals.append((name, g_idx, c_idx))
        
        # Actualizar lista visual de seleccionados
        self.list_selected_signals.clear()
        if self.active_signals:
            for s in self.active_signals:
                self.list_selected_signals.addItem(f"{s[0]} (G{s[1]}:C{s[2]})")
        else:
            self.list_selected_signals.addItem("(All signals will be kept)")

        if count == 0:
            self.lbl_sig_count.setText("0 selected. WARNING: ALL signals will be kept (Huge Files).")
            self.lbl_sig_count.setStyleSheet("color: #d1242f; font-weight: bold;")
        else:
            self.lbl_sig_count.setText(f"{count} signals selected for filtering.")
            self.lbl_sig_count.setStyleSheet(f"color: {IDIADA_ORANGE}; font-weight: bold;")
    def toggle_tree(self, check):
        state = Qt.Checked if check else Qt.Unchecked
        for i in range(self.tree_parts.topLevelItemCount()):
            self.tree_parts.topLevelItem(i).setCheckState(0, state)
    def check_pending_only(self):
        for i in range(self.tree_parts.topLevelItemCount()):
            item = self.tree_parts.topLevelItem(i)
            status = item.text(2)
            if status == "COMPLETE": item.setCheckState(0, Qt.Unchecked)
            else: item.setCheckState(0, Qt.Checked)
            
    def on_participant_updated(self, name, status):
        # Buscar el item en el árbol para actualizar status texto
        items = self.tree_parts.findItems(name, Qt.MatchExactly, 0)
        if items:
            item = items[0]
            # Si es Done, podríamos querer actualizar el texto de "xx/xx files"
            # Pero como eso requiere re-escanear, lo dejaremos o lo haremos al final.
            # Por ahora, solo repintamos si es necesario, o lo dejamos como estaba.
            pass 
                
        self.completed_participants += 1
        self.update_global_stats()
        
    def on_participant_progress(self, name, percent):
        """Actualiza la barra de progreso individual del participante"""
        items = self.tree_parts.findItems(name, Qt.MatchExactly, 0)
        if items:
            item = items[0]
            # Obtener widget de la columna 3
            pbar = self.tree_parts.itemWidget(item, 3)
            if pbar:
                pbar.setValue(percent)

    def update_global_stats(self):
        if self.total_participants_to_process > 0:
             perc = int((self.completed_participants / self.total_participants_to_process) * 100)
             self.lbl_stats.setText(f"Progress: {self.completed_participants}/{self.total_participants_to_process} Participants ({perc}%)")
        else:
             self.lbl_stats.setText("Ready")
             
    def toggle_fusion_state(self):
        # Check if worker exists and is running
        if hasattr(self, 'worker') and self.worker is not None and self.worker.isRunning():
            if self.worker.is_paused:
                self.worker.resume()
                self.btn_run.setText("PAUSE")
                self.btn_run.setIcon(QIcon(resource_path("assets/icons/pause_circle_16dp_000000_FILL0_wght400_GRAD0_opsz20.png")))
                self.btn_run.setStyleSheet(STYLESHEET) # Default style
            else:
                self.worker.pause()
                self.btn_run.setText("RESUME")
                self.btn_run.setIcon(QIcon(resource_path("assets/icons/play_circle_16dp_000000_FILL0_wght400_GRAD0_opsz20.png")))
                self.btn_run.setStyleSheet("background-color: #e67e22; color: white; font-weight: bold; border-radius: 4px;")
        else:
            # Start new process
            self.start_fusion()

    def stop_fusion_process(self):
        if hasattr(self, 'worker') and self.worker is not None:
             if self.worker.isRunning():
                 self.worker.stop()
                 self.btn_run.setEnabled(False)
                 self.btn_stop.setEnabled(False)
                 self.btn_stop.setStyleSheet("background-color: #555; color: #aaa; border-radius: 4px; font-weight: bold;")
                 self.btn_stop.setCursor(Qt.ArrowCursor)
                 self.log("STOP command sent. Waiting for safety stop...")

    def start_fusion(self):
        src = self.txt_src.text()
        if not src: return QMessageBox.warning(self, "Error", "Select source folder")
        
        selected_parts = []
        # Iterar items del arbol
        for i in range(self.tree_parts.topLevelItemCount()):
            item = self.tree_parts.topLevelItem(i)
            if item.checkState(0) == Qt.Checked: 
                selected_parts.append(item.text(0))
                
                # INYECTAR PROGRESS BAR
                pbar_widget = QProgressBar()
                pbar_widget.setStyleSheet(f"""
                    QProgressBar {{ border: 1px solid #444; border-radius: 2px; text-align: center; color: white; background-color: #222; }}
                    QProgressBar::chunk {{ background-color: {IDIADA_ORANGE}; }}
                """)
                pbar_widget.setFixedHeight(14)
                pbar_widget.setTextVisible(True)
                pbar_widget.setFormat("%p%")
                pbar_widget.setValue(0)
                self.tree_parts.setItemWidget(item, 3, pbar_widget)

        if not selected_parts: return QMessageBox.warning(self, "Error", "No participants selected.")
        
        overwrite = self.toggle_overwrite.isChecked()
        if overwrite:
            resp = QMessageBox.warning(self, "Force Overwrite Active", 
                                       "⚠️ OVERWRITE MODE IS ON.\n\nFiles that already exist will be regenerated from scratch.\nThis will take significantly longer.\n\nAre you sure you want to continue?",
                                       QMessageBox.Yes | QMessageBox.No)
            if resp == QMessageBox.No: return

        self.total_participants_to_process = len(selected_parts)
        self.completed_participants = 0
        self.update_global_stats()
        
        whitelist = self.active_signals if self.active_signals else None
        if not whitelist:
            res = QMessageBox.question(self, "Confirm Full Export", "No signals selected (Filter OFF).\nALL signals will be kept.\nContinue?", QMessageBox.Yes | QMessageBox.No)
            if res == QMessageBox.No: return
            
        self.btn_run.setEnabled(False)
        # self.pbar.setValue(0) <--- ELIMINADO
        self.log("\n" + "="*40)
        self.log(f"NEW SESSION: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.log("="*40)
        self.anim_timer.start(100) 
        
        copy_videos = self.toggle_vid.isChecked()
        if hasattr(self, 'worker') and self.worker is not None:
             try:
                 self.worker.quit()
                 self.worker.wait()
             except: pass
             
        self.worker = FusionWorker(src, selected_parts, whitelist, copy_videos, overwrite_mode=overwrite)
        self.worker.signals.log.connect(self.log)
        # self.worker.signals.progress.connect(...) <--- ELIMINADO (Ya no hay barra global)
        # Conectar señal de progreso individual
        self.worker.signals.participant_progress.connect(self.on_participant_progress)
        self.worker.signals.participant_status.connect(self.on_participant_updated)
        self.worker.signals.finished.connect(self.fusion_finished)
        self.worker.signals.error.connect(lambda e: [self.log(f"ERROR: {e}"), self.show_global_notification(f"Error: {e}", "error")])
        self.worker.signals.cleaning_mem.connect(self.set_cleaning_mode) 
        self.worker.start()
        
        self.show_global_notification("Fusion process started", "info")
        
        # UI Updates for Running State
        self.btn_run.setText("PAUSE")
        self.btn_run.setIcon(QIcon(resource_path("assets/icons/pause_circle_16dp_000000_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_stop.setEnabled(True)
        self.btn_stop.setStyleSheet(f"background-color: #d1242f; color: white; border-radius: 4px; font-weight: bold;")
        self.btn_stop.setCursor(Qt.PointingHandCursor)
        self.btn_run.setEnabled(True) # Ensure enabled
    
    def set_cleaning_mode(self, active):
        self.cleaning_mode = active
        if active:
            if not self.anim_timer.isActive(): self.anim_timer.start(100)
            self.show_global_notification("Participant completed. Cleaning memory...", "info")
        
    def fusion_finished(self):
        self.anim_timer.stop() 
        self.lbl_activity.setText("")
        self.btn_run.setEnabled(True)
        self.btn_run.setText("START FUSION")
        self.btn_run.setIcon(QIcon(resource_path("assets/icons/play_circle_16dp_000000_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_run.setStyleSheet(STYLESHEET)
        
        self.btn_stop.setEnabled(False)
        self.btn_stop.setStyleSheet("background-color: #555; color: #aaa; border-radius: 4px; font-weight: bold;")
        self.btn_stop.setCursor(Qt.ArrowCursor)
        # self.pbar.setValue(100) <--- ELIMINADO
        
        QMessageBox.information(self, "Done", "Batch Process Finished.\nCheck '_FUSION_RESULTS' in source folder.")
        
        self.scan_participants(self.txt_src.text())
        self.lbl_stats.setText("Process Completed")
        
    def update_spinner(self):
        self.lbl_activity.setText(f"{self.spinner_chars[self.spinner_idx]}")
        self.spinner_idx = (self.spinner_idx + 1) % len(self.spinner_chars)

    def log(self, msg):
        self.txt_log.append(msg)
        sb = self.txt_log.verticalScrollBar()
        sb.setValue(sb.maximum())

    def plot_signal_on_double_click(self, item):
        if item.column() != 0: 
            item = self.table_signals.item(item.row(), 0)
        name = item.text()
        g_idx = item.data(Qt.UserRole)
        c_idx = item.data(Qt.UserRole + 1)
        self.tabs_top_right.setCurrentWidget(self.plot_dashboard)
        self.plot_dashboard.analyze_and_ask(name, g_idx, c_idx)

    def remove_selected_signal(self, item):
        text = item.text()
        if text == "(All signals will be kept)": return
        name = text.split(" (G")[0]
        rows = self.table_signals.rowCount()
        self.table_signals.blockSignals(True)
        for i in range(rows):
            t_item = self.table_signals.item(i, 0)
            if t_item and t_item.text() == name:
                t_item.setCheckState(Qt.Unchecked)
                break
        self.table_signals.blockSignals(False)
        self.on_signal_item_changed(None)

    def toggle_process_log(self):
        self.btn_toggle_log.toggle()
        self.log_anim = QPropertyAnimation(self.log_content, b"maximumHeight")
        self.log_anim.setDuration(300)
        self.log_anim.setEasingCurve(QEasingCurve.InOutQuad)
        
        if self.log_expanded:
            self.log_anim.setStartValue(self.log_content.height())
            self.log_anim.setEndValue(0)
            self.log_expanded = False
        else:
            self.log_anim.setStartValue(0)
            self.log_anim.setEndValue(1000)
            self.log_expanded = True
            
        self.log_anim.start()
