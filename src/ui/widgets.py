from __future__ import annotations
import os
try:
    import numpy as np
except ImportError:
    np = None
try:
    import pyqtgraph as pg
except ImportError:
    pg = None
from PySide6.QtWidgets import (QWidget, QLabel, QPushButton, QTableWidget, QTableWidgetItem,
                               QHeaderView, QCheckBox, QFrame, QVBoxLayout, QHBoxLayout,
                               QGroupBox, QAbstractItemView, QMenu, QDialog, QMessageBox, QFileDialog,
                               QGraphicsOpacityEffect)
from PySide6.QtCore import Qt, QTimer, QSize, QPropertyAnimation, QEasingCurve, Signal, QMimeData, Property, QPoint
from PySide6.QtGui import QPainter, QPixmap, QIcon, QColor, QFont, QDrag, QDragEnterEvent, QDropEvent, QDragMoveEvent, QAction, QCursor, QImage

from src.core.utils import resource_path
from src.ui.styles import IDIADA_ORANGE, STYLESHEET

# --- CONFIGURACIÓN PYQTGRAPH ---
if pg:
    pg.setConfigOption('background', '#1e1e1e')
    pg.setConfigOption('foreground', 'd') 
    pg.setConfigOptions(antialias=False)
    try:
        pg.setConfigOption('useOpenGL', True)
        pg.setConfigOption('enableExperimental', True)
    except Exception:
        pass

def create_opacity_icon(icon_file, opacity):
    path = resource_path(f"assets/icons/{icon_file}")
    if not os.path.exists(path):
        return QIcon()
    pixmap = QPixmap(path)
    if opacity >= 1.0:
        return QIcon(pixmap)
        
    img = QImage(pixmap.size(), QImage.Format_ARGB32_Premultiplied)
    img.fill(Qt.transparent)
    painter = QPainter(img)
    painter.setOpacity(opacity)
    painter.drawPixmap(0, 0, pixmap)
    painter.end()
    return QIcon(QPixmap.fromImage(img))

def setup_tab_icon_switching(tab_widget, icon_pairs):
    """
    Sets up dynamic FILL0/FILL1 icon switching for a QTabWidget.
    icon_pairs is a list of tuples: (fill0_path, fill1_path) relative to assets/icons/
    """
    def on_tab_changed(index):
        for i, pair in enumerate(icon_pairs):
            if i >= tab_widget.count(): continue
            if isinstance(pair, tuple) and len(pair) == 2:
                fill0, fill1 = pair
            else:
                fill0 = fill1 = pair
            
            # Use fill1 if missing fill0
            path0 = resource_path(f"assets/icons/{fill0}")
            if not os.path.exists(path0):
                fill0 = fill1
                
            if i == index:
                tab_widget.setTabIcon(i, create_opacity_icon(fill1, 1.0))
            else:
                tab_widget.setTabIcon(i, create_opacity_icon(fill0, 0.55))
            
    tab_widget.currentChanged.connect(on_tab_changed)
    on_tab_changed(tab_widget.currentIndex())

class LoadingSpinner(QWidget):
    def __init__(self, parent=None, size=40):
        super().__init__(parent)
        self.size = size
        self.setFixedSize(size, size)
        self.angle = 0
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.rotate)
        img_path = resource_path(os.path.join("assets/icons", "hourglass_16dp_F39200_FILL0_wght400_GRAD0_opsz20.png"))
        if os.path.exists(img_path):
            self.pixmap = QPixmap(img_path)
            self.pixmap = self.pixmap.scaled(size, size, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        else:
            self.pixmap = None
        self.hide()

    def start(self):
        self.show()
        if not self.timer.isActive(): self.timer.start(80)

    def stop(self):
        self.hide()
        self.timer.stop()

    def rotate(self):
        self.angle = (self.angle + 30) % 360
        self.update()

    def paintEvent(self, event):
        if self.pixmap:
            painter = QPainter(self)
            painter.setRenderHint(QPainter.Antialiasing)
            center = QPoint(self.width() // 2, self.height() // 2)
            painter.translate(center)
            painter.rotate(self.angle)
            painter.translate(-center)
            painter.drawPixmap(-self.width()//2, -self.height()//2, self.pixmap)

class AnimatedToggle(QCheckBox):
    _circle_position = Property(float, lambda self: self.__circle_position, lambda self, pos: self.set_circle_position(pos))
    def __init__(self, parent=None, active_color=IDIADA_ORANGE):
        super().__init__(parent)
        self.active_color = active_color
        self.setCursor(Qt.PointingHandCursor)
        self.setFixedSize(50, 26)
        self.__circle_position = 3
        self.animation = QPropertyAnimation(self, b"_circle_position", self)
        self.animation.setEasingCurve(QEasingCurve.OutBounce)
        self.animation.setDuration(250)
        self.stateChanged.connect(self.setup_animation)
    def set_circle_position(self, pos):
        self.__circle_position = pos
        self.update()
    def setup_animation(self, state):
        self.animation.stop()
        if state: self.animation.setEndValue(self.width() - 23)
        else: self.animation.setEndValue(3)
        self.animation.start()
    def hitButton(self, pos: QPoint): return self.contentsRect().contains(pos)
    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        rect = self.rect()
        if self.isChecked():
            p.setBrush(QColor(self.active_color))
            p.setPen(Qt.NoPen)
        else:
            p.setBrush(QColor("#444"))
            p.setPen(Qt.NoPen)
        p.drawRoundedRect(0, 0, rect.width(), rect.height(), rect.height() / 2, rect.height() / 2)
        p.setBrush(QColor("white"))
        p.setPen(Qt.NoPen)
        p.drawEllipse(int(self.__circle_position), 3, 20, 20)

class SignalTableDialog(QDialog):
    def __init__(self, signal_name, timestamps, values, unit, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"Table View: {signal_name}")
        self.resize(600, 700)
        self.setStyleSheet(STYLESHEET)
        layout = QVBoxLayout(self)
        info_str = f"Signal: {signal_name}\nSamples: {len(values)}\nUnit: {unit}"
        if len(values) > 10000: info_str += "\n(Showing first 10,000 samples)"
        lbl_info = QLabel(info_str)
        lbl_info.setStyleSheet("font-weight: bold; margin-bottom: 10px;")
        layout.addWidget(lbl_info)
        self.table = QTableWidget()
        self.table.setColumnCount(2)
        self.table.setHorizontalHeaderLabels(["Time (s)", f"Value ({unit})"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.setAlternatingRowColors(True)
        limit = min(len(values), 10000)
        self.table.setRowCount(limit)
        self.table.setUpdatesEnabled(False)
        for i in range(limit):
            t_val = f"{timestamps[i]:.4f}" if len(timestamps) > i else "N/A"
            v_val = str(values[i])
            self.table.setItem(i, 0, QTableWidgetItem(t_val))
            self.table.setItem(i, 1, QTableWidgetItem(v_val))
        self.table.setUpdatesEnabled(True)
        layout.addWidget(self.table)
        btn_close = QPushButton("Close")
        btn_close.clicked.connect(self.close)
        layout.addWidget(btn_close)

class IconGroupBox(QGroupBox):
    def __init__(self, title, icon_filename, parent=None, title_color=IDIADA_ORANGE, title_weight="bold"):
        super().__init__(parent)
        self.setTitle("") 
        self.real_title = title
        self.header_layout = QHBoxLayout()
        self.header_layout.setContentsMargins(10, 0, 0, 0)
        self.header_layout.setSpacing(8)
        # RUTA ABSOLUTA
        icon_path = resource_path(os.path.join("assets/icons", icon_filename))
        lbl_icon = QLabel()
        if os.path.exists(icon_path):
            pix = QIcon(icon_path).pixmap(QSize(20, 20))
            lbl_icon.setPixmap(pix)
        else: lbl_icon.setText("🔹")
        lbl_title = QLabel(title)
        lbl_title.setStyleSheet(f"color: {title_color}; font-weight: {title_weight}; font-size: 13px;")
        self.header_layout.addWidget(lbl_icon)
        self.header_layout.addWidget(lbl_title)
        self.header_layout.addStretch()
        self.content_widget = QWidget()
        self.content_layout = QVBoxLayout(self.content_widget)
        self.content_layout.setContentsMargins(10, 10, 10, 10)
        super_layout = QVBoxLayout(self)
        super_layout.setContentsMargins(0, 5, 0, 0) 
        super_layout.addLayout(self.header_layout)
        super_layout.addWidget(self.content_widget)
    def setLayout(self, layout):
        if self.content_widget.layout(): QWidget().setLayout(self.content_widget.layout()) 
        self.content_widget.setLayout(layout)

class SidebarButton(QPushButton):
    def __init__(self, text, icon_filename, parent=None):
        super().__init__(parent)
        self.full_text = text
        self.setCheckable(True)
        self.setAutoExclusive(True)
        self.setCursor(Qt.PointingHandCursor)
        
        if "FILL0" in icon_filename:
            self.icon_fill0 = icon_filename
            self.icon_fill1 = icon_filename.replace("FILL0", "FILL1")
        elif "FILL1" in icon_filename:
            self.icon_fill1 = icon_filename
            self.icon_fill0 = icon_filename.replace("FILL1", "FILL0")
        else:
            self.icon_fill0 = self.icon_fill1 = icon_filename
            
        path0 = resource_path(f"assets/icons/{self.icon_fill0}")
        if not os.path.exists(path0):
            self.icon_fill0 = self.icon_fill1
            
        self.setIconSize(QSize(24, 24))
        self.setText("") 
        self.setToolTip(text) 
        self.setStyleSheet(f"""
            QPushButton {{
                text-align: left; padding-left: 18px; border: none; background-color: transparent;
                color: rgba(255, 255, 255, 0.55); font-size: 14px; height: 45px; border-left: 3px solid transparent;
            }}
            QPushButton:hover {{ background-color: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.85); }}
            QPushButton:checked {{ background-color: transparent; color: rgba(255, 255, 255, 1.0); border-left: 3px solid transparent; }}
        """)
        
        self.toggled.connect(self._update_icon)
        # Delay initial icon update until added to parent
        QTimer.singleShot(0, lambda: self._update_icon(self.isChecked()))
        
    def _update_icon(self, checked):
        if checked:
            self.setIcon(create_opacity_icon(self.icon_fill1, 1.0))
        else:
            self.setIcon(create_opacity_icon(self.icon_fill0, 0.55))
    def set_expanded(self, expanded):
        if expanded:
            self.setText(f"   {self.full_text}") 
            self.setStyleSheet(self.styleSheet().replace("padding-left: 18px;", "padding-left: 15px;"))
        else:
            self.setText("")
            self.setStyleSheet(self.styleSheet().replace("padding-left: 15px;", "padding-left: 18px;"))

class SidebarSeparator(QWidget):
    """A separator that shows a subtle horizontal line when collapsed,
    and a text label when the sidebar is expanded."""
    def __init__(self, text, parent=None):
        super().__init__(parent)
        self.full_text = text
        self.setFixedHeight(30)
        self._expanded = False
        
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(12, 0, 12, 0)
        self._layout.setSpacing(0)
        
        # The line (visible when collapsed)
        self._line = QFrame()
        self._line.setFrameShape(QFrame.HLine)
        self._line.setStyleSheet("background-color: transparent; border: none; border-top: 1px solid rgba(255,255,255,40);")
        self._line.setFixedHeight(1)
        self._layout.addWidget(self._line, 0, Qt.AlignVCenter)
        
        # The label (visible when expanded)
        self._label = QLabel(text)
        self._label.setStyleSheet("""
            background-color: transparent;
            color: rgba(255, 255, 255, 90); 
            font-size: 10px; 
            font-weight: normal; 
            letter-spacing: 1px;
            border: none;
        """)
        self._label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        self._label.hide()
        self._layout.addWidget(self._label)

    def set_expanded(self, expanded):
        self._expanded = expanded
        if expanded:
            self._line.hide()
            self._label.show()
            self._layout.setContentsMargins(18, 0, 12, 0)
        else:
            self._label.hide()
            self._line.show()
            self._layout.setContentsMargins(12, 0, 12, 0)

class ExpandableSidebar(QFrame):
    tab_changed = Signal(int)
    expanded = Signal(bool)
    _sidebar_width = Property(int, lambda self: self.width(), lambda self, val: self.setFixedWidth(val))

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedWidth(60)
        self.setStyleSheet("background-color: rgba(30, 30, 30, 245); border-right: 1px solid #555;")
        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(0, 20, 0, 0)
        self.layout.setSpacing(5)
        self.buttons = []
        self.separators = []
        self._btn_index_map = {}  # map button -> index
        
        # Sliding selection indicator
        self._indicator = QFrame(self)
        self._indicator.setStyleSheet(f"""
            background-color: #333;
            border-left: 3px solid {IDIADA_ORANGE};
            border-radius: 0px;
        """)
        self._indicator.setFixedWidth(60)
        self._indicator.setFixedHeight(45)
        self._indicator.lower()
        self._indicator.hide()
        self._anim_indicator = QPropertyAnimation(self._indicator, b"pos")
        self._anim_indicator.setDuration(200)
        self._anim_indicator.setEasingCurve(QEasingCurve.OutCubic)
        
        # Block: File Customization
        sep_file = SidebarSeparator("FILE CUSTOMIZATION")
        self.layout.addWidget(sep_file)
        self.separators.append(sep_file)
        
        self.add_tab_btn(0, "Fusion", "combine_columns_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.png")
        self.add_tab_btn(5, "Signal Mining", "shape_line_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.png")
        
        self.layout.addSpacing(10)
        
        # Block: Analysis
        sep_analysis = SidebarSeparator("ANALYSIS")
        self.layout.addWidget(sep_analysis)
        self.separators.append(sep_analysis)
        
        self.add_tab_btn(1, "Gaze", "eye_tracking_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.png")
        # Kept classification just in case the user omitted it accidentally since it wasn't requested to be deleted
        self.add_tab_btn(2, "Classification", "archive_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.png")
        self.add_tab_btn(4, "Occupancy", "tatami_seat_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.png")
        self.add_tab_btn(3, "Reporting", "document_scanner_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.png")
        
        self.layout.addSpacing(10)
        
        # Block: Miscellaneous
        sep_misc = SidebarSeparator("MISCELLANEOUS")
        self.layout.addWidget(sep_misc)
        self.separators.append(sep_misc)
        
        self.add_tab_btn(6, "AImark", "science_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.png")

        self.layout.addStretch()
        self.anim = QPropertyAnimation(self, b"_sidebar_width")
        self.anim.setDuration(250)
        self.anim.setEasingCurve(QEasingCurve.OutCubic)
        
    def add_tab_btn(self, index, text, icon_file):
        btn = SidebarButton(text, icon_file)
        btn.clicked.connect(lambda: self._on_btn_clicked(btn, index))
        self.layout.addWidget(btn)
        self.buttons.append(btn)
        self._btn_index_map[btn] = index
        if index == 0:
            btn.setChecked(True)
            # Position indicator on first button after layout settles
            QTimer.singleShot(50, lambda: self._move_indicator(btn, animate=False))
        
    def _on_btn_clicked(self, btn, index):
        """Handle sidebar button click: animate indicator and emit signal."""
        self._move_indicator(btn, animate=True)
        self.tab_changed.emit(index)
    
    def _move_indicator(self, btn, animate=True):
        """Slide the selection indicator to the target button's position."""
        target_pos = QPoint(0, btn.y())
        self._indicator.setFixedWidth(self.width())
        self._indicator.setFixedHeight(btn.height())
        
        if not self._indicator.isVisible() or not animate:
            self._indicator.move(target_pos)
            self._indicator.show()
        else:
            self._anim_indicator.stop()
            self._anim_indicator.setStartValue(self._indicator.pos())
            self._anim_indicator.setEndValue(target_pos)
            self._anim_indicator.start()

    def enterEvent(self, event):
        self.anim.stop()
        self.anim.setStartValue(self.width())
        self.anim.setEndValue(200)
        self.anim.start()
        for btn in self.buttons: btn.set_expanded(True)
        for sep in self.separators: sep.set_expanded(True)
        # Update indicator width to match expanded sidebar
        self._indicator.setFixedWidth(200)
        self.expanded.emit(True)
        super().enterEvent(event)
        
    def leaveEvent(self, event):
        self.anim.stop()
        self.anim.setStartValue(self.width())
        self.anim.setEndValue(60)
        self.anim.start()
        for btn in self.buttons: btn.set_expanded(False)
        for sep in self.separators: sep.set_expanded(False)
        # Restore indicator width to collapsed
        self._indicator.setFixedWidth(60)
        self.expanded.emit(False)
        super().leaveEvent(event)

class SignalDropTable(QTableWidget):
    file_dropped = Signal(str)
    request_load = Signal()
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setDragEnabled(True)
        self.setDragDropMode(QAbstractItemView.DragDrop) 
        self.setDefaultDropAction(Qt.CopyAction)
        self.setAcceptDrops(True)
        self.setCursor(Qt.PointingHandCursor) 
        self.setAlternatingRowColors(True)
        self.setShowGrid(False)
        self.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.setSelectionMode(QAbstractItemView.SingleSelection)
        self.viewport().installEventFilter(self)
    def paintEvent(self, event):
        super().paintEvent(event)
        if self.rowCount() == 0:
            painter = QPainter(self.viewport())
            painter.setPen(QColor("#666"))
            font = QFont("Segoe UI", 14, QFont.Bold)
            painter.setFont(font)
            rect = self.viewport().rect()
            text = "Drag Master MF4 here\nor Click to Load"
            painter.drawText(rect, Qt.AlignCenter, text)
    
    def dragEnterEvent(self, event: QDragEnterEvent):
        if event.mimeData().hasUrls():
            urls = event.mimeData().urls()
            if urls and urls[0].toLocalFile().lower().endswith(".mf4"):
                event.acceptProposedAction()
        else: super().dragEnterEvent(event)
    
    def dragMoveEvent(self, event: QDragMoveEvent):
        if event.mimeData().hasUrls():
            urls = event.mimeData().urls()
            if urls and urls[0].toLocalFile().lower().endswith(".mf4"):
                event.acceptProposedAction()
                return
        super().dragMoveEvent(event)

    def dropEvent(self, event: QDropEvent):
        if event.mimeData().hasUrls():
            urls = event.mimeData().urls()
            if urls:
                path = urls[0].toLocalFile()
                if path.lower().endswith(".mf4"):
                    self.file_dropped.emit(path)
                    event.acceptProposedAction()
        else: event.ignore()
    
    def startDrag(self, supportedActions):
        pass
    def mousePressEvent(self, event):
        if self.rowCount() == 0: self.request_load.emit()
        super().mousePressEvent(event)

class PlottingDashboard(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAcceptDrops(False)
        self.master_file_path = None 
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0,0,0,0)
        tb_layout = QHBoxLayout()
        self.btn_clear = QPushButton("Clear Plot")
        self.btn_clear.setIcon(QIcon(resource_path("assets/icons/clear_all_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_clear.setStyleSheet("background-color: #d1242f; color: white; border: none; padding: 4px 10px; border-radius: 4px;")
        self.btn_clear.setCursor(Qt.PointingHandCursor)
        self.btn_clear.clicked.connect(self.clear_plot)
        self.btn_remove_last = QPushButton("Remove Last")
        self.btn_remove_last.setIcon(QIcon(resource_path("assets/icons/backspace_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_remove_last.setStyleSheet("font-weight: normal;")
        self.btn_remove_last.setCursor(Qt.PointingHandCursor)
        self.btn_remove_last.clicked.connect(self.remove_last)
        self.lbl_info = QLabel("Double-click signals in Signal Filter to plot")
        self.lbl_info.setStyleSheet("color: #888; margin-left: 10px;")
        tb_layout.addWidget(self.btn_clear)
        tb_layout.addWidget(self.btn_remove_last)
        tb_layout.addWidget(self.lbl_info)
        tb_layout.addStretch()
        layout.addLayout(tb_layout)
        self.plot_widget = pg.PlotWidget()
        self.plot_widget.showGrid(x=True, y=True)
        self.plot_widget.addLegend()
        self.plot_widget.setLabel('bottom', 'Time (s)')
        self.plot_widget.getPlotItem().setClipToView(True) 
        self.plot_widget.getPlotItem().setDownsampling(ds=50, auto=True) 
        layout.addWidget(self.plot_widget)
        self.plotted_items = []
        self.colors = ['#F39200', '#00ff00', '#00d4ff', '#ff0055', '#ffff00', '#aa00ff']
        self.color_idx = 0

    def set_master_file(self, path):
        self.master_file_path = path

    def dragEnterEvent(self, event: QDragEnterEvent):
        pass

    def dropEvent(self, event: QDropEvent):
        pass

    def analyze_and_ask(self, signal_name, group_idx=None, channel_idx=None):
        try:
            from asammdf import MDF
            import numpy as np
            with MDF(self.master_file_path) as mdf:
                try:
                    if group_idx is not None and channel_idx is not None:
                        sig = mdf.get(signal_name, group=group_idx, index=channel_idx)
                    else: sig = mdf.get(signal_name)
                except Exception as ex_read:
                    if group_idx is not None:
                         sig = mdf.get(signal_name, group=group_idx, index=channel_idx, raw=True)
                    else: sig = mdf.get(signal_name, raw=True)
                samples = sig.samples
                timestamps = sig.timestamps
                if len(timestamps) != len(samples) or len(timestamps) == 0:
                    timestamps = np.arange(len(samples))
                samples_len = len(samples)
                is_numeric = np.issubdtype(samples.dtype, np.number)
                unit = getattr(sig, 'unit', '')
            rec = "Graph"
            if not is_numeric: rec = "Table"
            elif samples_len == 1: rec = "Numeric"
            elif samples_len < 10: rec = "Table"
            menu = QMenu(self)
            menu.setStyleSheet(f"QMenu {{ background-color: #333; color: white; border: 1px solid {IDIADA_ORANGE}; }} QMenu::item:selected {{ background-color: {IDIADA_ORANGE}; }}")
            act_graph = QAction(f"Plot Graph {'(Recommended)' if rec=='Graph' else ''}", self)
            act_num = QAction(f"Show Value {'(Recommended)' if rec=='Numeric' else ''}", self)
            act_tab = QAction(f"Show Table {'(Recommended)' if rec=='Table' else ''}", self)
            menu.addAction(act_graph)
            menu.addAction(act_num)
            menu.addAction(act_tab)
            action = menu.exec(QCursor.pos())
            if action == act_graph: 
                self.plot_signal_data(timestamps, samples, signal_name)
            elif action == act_num:
                val = samples[0]
                try: val = val.decode('utf-8')
                except: pass
                QMessageBox.information(self, f"Value: {signal_name}", f"Value: {val}\nUnit: {sig.unit}")
            elif action == act_tab:
                dlg = SignalTableDialog(signal_name, timestamps, samples, unit, self)
                dlg.exec()
        except Exception as e:
            QMessageBox.warning(self, "Error reading signal", f"Could not read signal: {str(e)}\nTry selecting the specific group in the list.")

    def plot_signal_data(self, timestamps, samples, name):
        color = self.colors[self.color_idx % len(self.colors)]
        self.color_idx += 1
        if len(timestamps) > 0 and timestamps[0] > 100000:
            timestamps = timestamps - timestamps[0]
        if not np.issubdtype(samples.dtype, np.number):
             QMessageBox.warning(self, "Plot Error", f"Signal '{name}' is not numeric.\nTry Table View.")
             return
        item = self.plot_widget.plot(timestamps, samples, pen=pg.mkPen(color=color, width=1), name=name)
        item.setDownsampling(ds=50, auto=True) 
        item.setClipToView(True)
        self.plotted_items.append(item)
        status_msg = f"Added: {name}"
        if timestamps.dtype == np.int64 or timestamps.dtype == np.int32:
             status_msg += " (Time axis reconstructed)"
             self.lbl_info.setStyleSheet("color: #F39200; margin-left: 10px;")
        else: self.lbl_info.setStyleSheet("color: #888; margin-left: 10px;")
        self.lbl_info.setText(status_msg)

    def clear_plot(self):
        if not self.plotted_items:
            return
        
        reply = QMessageBox.question(
            self, 'Clear Plot', 'Are you sure you want to clear the entire plot?',
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No
        )
        if reply == QMessageBox.Yes:
            self.plot_widget.clear()
            self.plotted_items = []
            self.color_idx = 0
            self.lbl_info.setText("Plot cleared")
            self.lbl_info.setStyleSheet("color: #888; margin-left: 10px;")

    def remove_last(self):
        if self.plotted_items:
            item = self.plotted_items.pop()
            self.plot_widget.removeItem(item)
            self.color_idx = max(0, self.color_idx - 1)

class AnimatedExpandButton(QPushButton):
    _icon_rotation = Property(int, lambda self: self.__icon_rotation, lambda self, val: self.set_icon_rotation(val))

    def __init__(self, text, icon_filename, left_icon_filename=None, parent=None):
        super().__init__(text, parent)
        self.setCursor(Qt.PointingHandCursor)
        self.icon_pixmap = None
        icon_path = resource_path(os.path.join("assets/icons", icon_filename))
        if os.path.exists(icon_path):
            self.icon_pixmap = QPixmap(icon_path).scaled(16, 16, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        self.__icon_rotation = 180 
        
        if left_icon_filename:
            left_path = resource_path(os.path.join("assets/icons", left_icon_filename))
            if os.path.exists(left_path):
                self.setIcon(QIcon(left_path))
                self.setIconSize(QSize(16, 16))

        self.anim = QPropertyAnimation(self, b"_icon_rotation", self)
        self.anim.setDuration(300)
        self.anim.setEasingCurve(QEasingCurve.InOutQuad)

        self.is_expanded = True
        
        self.setStyleSheet(f"""
            QPushButton {{
                background-color: #333; color: white; border: none; border-radius: 4px;
                padding: 10px; text-align: left; padding-left: 10px; font-weight: normal;
            }}
            QPushButton:hover {{ background-color: #444; }}
        """)

    def set_icon_rotation(self, val):
        self.__icon_rotation = val
        self.update()

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

    def paintEvent(self, event):
        super().paintEvent(event)
        if self.icon_pixmap:
            painter = QPainter(self)
            painter.setRenderHint(QPainter.Antialiasing)
            
            icon_x = self.width() - 30
            icon_y = self.height() // 2
            
            painter.translate(icon_x, icon_y)
            painter.rotate(self.__icon_rotation)
            painter.translate(-icon_x, -icon_y)
            
            painter.drawPixmap(icon_x - 8, icon_y - 8, self.icon_pixmap)

class FadeNotification(QWidget):
    def __init__(self, parent, text, duration=3000, notif_type="success"):
        super().__init__(parent)
        self.setAttribute(Qt.WA_TransparentForMouseEvents, False)
        
        bg_color = "#2da44e" # green
        if notif_type == "error":
            bg_color = "#ff4d4f"
        elif notif_type == "warning":
            bg_color = "#ff9800"
        elif notif_type == "info":
            bg_color = "#333333"

        self.setStyleSheet(f"""
            QWidget {{
                background-color: {bg_color}; 
                color: white; 
                border-radius: 6px;
                font-weight: bold;
                font-size: 13px;
                padding: 5px;
            }}
            QPushButton {{
                background-color: transparent;
                border: none;
                color: white;
                font-weight: bold;
                font-size: 14px;
                padding: 0px 5px;
            }}
            QPushButton:hover {{
                color: #ddd;
            }}
        """)
        
        layout = QHBoxLayout(self)
        layout.setContentsMargins(15, 10, 10, 10)
        
        lbl = QLabel(text)
        layout.addWidget(lbl)
        
        btn_close = QPushButton("✕")
        btn_close.setCursor(Qt.PointingHandCursor)
        btn_close.clicked.connect(self.hide_notification)
        layout.addWidget(btn_close)
        
        self.opacity_effect = QGraphicsOpacityEffect(self)
        self.setGraphicsEffect(self.opacity_effect)
        self.opacity_effect.setOpacity(0)
        
        self.duration = duration
        self.y_offset = 0
        self.hide()

    def show_notification(self, y_offset=0):
        self.show()
        self.y_offset = y_offset
        parent_rect = self.parent().rect()
        self.adjustSize()
        # Cascade position: base 80 + offset
        self.move(parent_rect.width() - self.width() - 30, 80 + y_offset)
        
        self.anim_in = QPropertyAnimation(self.opacity_effect, b"opacity")
        self.anim_in.setDuration(300)
        self.anim_in.setStartValue(0)
        self.anim_in.setEndValue(1)
        self.anim_in.start()
        
        if self.duration > 0:
            QTimer.singleShot(self.duration, self.hide_notification)

    def hide_notification(self):
        if not self.isVisible(): return
        self.anim_out = QPropertyAnimation(self.opacity_effect, b"opacity")
        self.anim_out.setDuration(300)
        self.anim_out.setStartValue(self.opacity_effect.opacity())
        self.anim_out.setEndValue(0)
        self.anim_out.finished.connect(self.hide)
        self.anim_out.finished.connect(self.deleteLater)
        self.anim_out.start()

class NotificationItem(QWidget):
    def __init__(self, message, type="info", parent=None):
        super().__init__(parent)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        
        self.lbl_msg = QLabel(message)
        self.lbl_msg.setWordWrap(True)
        self.lbl_msg.setStyleSheet("color: white; font-size: 13px;")
        
        # Colors based on severity
        bg_color = "#333333"
        border_color = "#555555"
        if type == "error":
            border_color = "#ff4d4f"
        elif type == "success":
            border_color = "#2da44e"
            
        self.setStyleSheet(f"""
            QWidget {{
                background-color: {bg_color};
                border-left: 4px solid {border_color};
                border-radius: 4px;
            }}
        """)
        
        layout.addWidget(self.lbl_msg)

class NotificationOverlay(QFrame):
    def __init__(self, parent):
        super().__init__(parent)
        self.parent_widget = parent
        self.setFixedWidth(350)
        
        # Rounded corners and blurred/semi-transparent background
        self.setStyleSheet(f"""
            QFrame {{
                background-color: rgba(30,30,30,230);
                border: 1px solid #444;
                border-radius: 10px;
            }}
        """)
        self.hide()
        
        self.layout_main = QVBoxLayout(self)
        self.layout_main.setContentsMargins(15, 15, 15, 15)
        
        # Header
        header_layout = QHBoxLayout()
        title = QLabel("Notifications")
        title.setStyleSheet(f"color: {IDIADA_ORANGE}; font-weight: bold; font-size: 16px; border: none; background: transparent;")
        
        btn_clear = QPushButton("Clear All")
        btn_clear.setCursor(Qt.PointingHandCursor)
        btn_clear.setStyleSheet("background: transparent; border: none; color: #888; text-decoration: underline;")
        btn_clear.clicked.connect(self.clear_notifications)
        
        btn_close = QPushButton("✕")
        btn_close.setFixedSize(24, 24)
        btn_close.setCursor(Qt.PointingHandCursor)
        btn_close.setStyleSheet("background: transparent; border: none; color: white; font-size: 14px; font-weight: bold;")
        btn_close.clicked.connect(self.hide_overlay)
        
        header_layout.addWidget(title)
        header_layout.addStretch()
        header_layout.addWidget(btn_clear)
        header_layout.addWidget(btn_close)
        
        self.layout_main.addLayout(header_layout)
        
        # Scroll Area for notifications
        from PySide6.QtWidgets import QScrollArea
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setStyleSheet("QScrollArea { border: none; background: transparent; } QWidget { background: transparent; }")
        
        self.content_widget = QWidget()
        self.content_layout = QVBoxLayout(self.content_widget)
        self.content_layout.setAlignment(Qt.AlignTop)
        self.content_layout.setContentsMargins(0, 10, 0, 0)
        self.content_layout.setSpacing(10)
        
        self.scroll.setWidget(self.content_widget)
        self.layout_main.addWidget(self.scroll)
        
        # Animation effect
        self.opacity_effect = QGraphicsOpacityEffect(self)
        self.setGraphicsEffect(self.opacity_effect)
        self.opacity_effect.setOpacity(0)

    def add_notification(self, message, notif_type="info"):
        item = NotificationItem(message, type=notif_type)
        self.content_layout.insertWidget(0, item) # Insert at top
        
    def clear_notifications(self):
        while self.content_layout.count():
            child = self.content_layout.takeAt(0)
            if child.widget():
                child.widget().deleteLater()
                
    def toggle_overlay(self, unread_callback=None):
        if self.isVisible():
            self.hide_overlay()
        else:
            self.show_overlay()
            if unread_callback:
                unread_callback()

    def show_overlay(self):
        self.show()
        # Position slightly below header on the right
        parent_rect = self.parent_widget.rect()
        self.setGeometry(parent_rect.width() - self.width() - 20, 70, self.width(), 500)
        self.raise_()
        
        self.anim_in = QPropertyAnimation(self.opacity_effect, b"opacity")
        self.anim_in.setDuration(300)
        self.anim_in.setStartValue(0)
        self.anim_in.setEndValue(1)
        self.anim_in.start()

    def hide_overlay(self):
        self.anim_out = QPropertyAnimation(self.opacity_effect, b"opacity")
        self.anim_out.setDuration(200)
        self.anim_out.setStartValue(self.opacity_effect.opacity())
        self.anim_out.setEndValue(0)
        self.anim_out.finished.connect(self.hide)
        self.anim_out.start()
