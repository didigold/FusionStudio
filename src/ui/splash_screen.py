import os
import sys
from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLabel, QGraphicsOpacityEffect
from PySide6.QtCore import (Qt, QTimer, QPropertyAnimation, QEasingCurve, 
                             QSequentialAnimationGroup, QParallelAnimationGroup, 
                             QPoint, Signal, QSize, QThread, QVariantAnimation, Property)
from PySide6.QtGui import QPixmap, QFont, QPainter, QColor, QLinearGradient, QPen, QGuiApplication, QCursor

from src.core.utils import resource_path
from src.ui.styles import IDIADA_ORANGE
from src.core.dependency_manager import DependencyManager


APP_VERSION = "1.0.0"
APP_BUILD = "2026.04"


class DependencyWorker(QThread):
    """Background worker to check and install dependencies."""
    progress = Signal(int, str)
    task_finished = Signal()

    def run(self):
        req_path = resource_path("requirements.txt")
        manager = DependencyManager(req_path, self._on_progress)
        manager.check_and_install()
        
        # Pre-load heavy modules in the background thread to avoid freezing the GUI
        # while the splash screen is still visible and pulsing.
        self.progress.emit(95, "Initializing core libraries...")
        try:
            import numpy
            import pandas
            import asammdf
            import scipy
            # Pre-load the main window module and its sub-widgets (AnalysisWidget, etc.)
            from src.ui.main_window import MainWindow
        except Exception:
            pass
            
        self.task_finished.emit()

    def _on_progress(self, percent, message):
        self.progress.emit(percent, message)


class PulsingProgressBar(QWidget):
    """Custom progress bar with a shimmering pulse effect using paintEvent."""
    def __init__(self, parent=None):
        super().__init__(parent)
        self._progress = 0.0
        
        # Timer only to trigger refreshes, logic is now time-based
        self._timer = QTimer(self)
        self._timer.setInterval(30) # ~33 FPS is enough for shimmer
        self._timer.timeout.connect(self.update)
        self._timer.start()
        
    def get_progress(self):
        return self._progress * 100
        
    def set_progress(self, value):
        self._progress = value / 100.0
        self.update()
        
    progressValue = Property(float, get_progress, set_progress)
        
    def paintEvent(self, event):
        from PySide6.QtCore import QTime
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # Background
        painter.setBrush(QColor("#333"))
        painter.setPen(Qt.NoPen)
        painter.drawRoundedRect(self.rect(), 1, 1)
        
        if self._progress <= 0:
            return
            
        # Filled portion
        bar_width = int(self.width() * self._progress)
        if bar_width < 4: bar_width = 4
        
        # Time-based pulse offset (independent of frame rate)
        # 1.5 seconds per loop
        ms = QTime.currentTime().msecsSinceStartOfDay()
        p = (ms % 1500) / 1500.0
        
        rect = self.rect()
        rect.setWidth(bar_width)
        
        # Pulse Gradient mapped to the filled portion
        grad = QLinearGradient(0, 0, bar_width, 0)
        grad.setColorAt(0, QColor(IDIADA_ORANGE))
        
        # Shimmer peak logic with wrap-around support
        # We use a slightly wider range to allow the shimmer to fully enter/exit
        peak = p * 1.4 - 0.2 
        
        s_start = max(0.0, peak - 0.15)
        s_peak = max(0.0, min(1.0, peak))
        s_end = min(1.0, peak + 0.15)
        
        if s_peak > 0 and s_peak < 1:
            grad.setColorAt(s_start, QColor(IDIADA_ORANGE))
            grad.setColorAt(s_peak, QColor("#ffffff")) # Max brightness for visibility
            grad.setColorAt(s_end, QColor(IDIADA_ORANGE))
            
        grad.setColorAt(1, QColor(IDIADA_ORANGE))
        
        painter.setBrush(grad)
        painter.drawRoundedRect(rect, 1, 1)


class SplashScreen(QWidget):
    """Premium animated splash screen shown during app startup."""
    
    loading_finished = Signal()
    finished = Signal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.SplashScreen)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setFixedSize(520, 340)
        
        self._build_ui()
        self._setup_animations()
        self._setup_worker()
    
    def _build_ui(self):
        """Build the splash screen layout."""
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # Background container
        self.container = QWidget()
        self.container.setStyleSheet("""
            QWidget {
                background-color: #1a1a1a;
                border: 1px solid #333;
                border-radius: 12px;
            }
        """)
        
        container_layout = QVBoxLayout(self.container)
        container_layout.setContentsMargins(40, 35, 40, 25)
        container_layout.setSpacing(0)
        
        # Top: App Icon
        icon_path = resource_path("assets/icon.ico")
        self.lbl_icon = QLabel()
        self.lbl_icon.setAlignment(Qt.AlignCenter)
        self.lbl_icon.setFixedHeight(70)
        self.lbl_icon.setStyleSheet("border: none; background: transparent;")
        if os.path.exists(icon_path):
            pixmap = QPixmap(icon_path).scaled(64, 64, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            self.lbl_icon.setPixmap(pixmap)
        
        # Title
        self.lbl_title = QLabel("Fusion Studio")
        self.lbl_title.setAlignment(Qt.AlignCenter)
        self.lbl_title.setStyleSheet(f"""
            font-size: 28px; 
            font-weight: bold; 
            color: white; 
            border: none; 
            background: transparent;
            padding-top: 5px;
        """)
        
        # Subtitle
        self.lbl_subtitle = QLabel("Applus+ IDIADA")
        self.lbl_subtitle.setAlignment(Qt.AlignCenter)
        self.lbl_subtitle.setStyleSheet(f"""
            font-size: 16px; 
            font-weight: normal; 
            color: {IDIADA_ORANGE}; 
            border: none; 
            background: transparent;
            padding-top: 2px;
        """)
        
        # Custom Pulsing Progress Bar
        self.progress_bar = PulsingProgressBar()
        self.progress_bar.setFixedHeight(3)
        
        # Status text
        self.lbl_status = QLabel("Initializing...")
        self.lbl_status.setAlignment(Qt.AlignCenter)
        self.lbl_status.setStyleSheet("""
            font-size: 11px; 
            color: #666; 
            border: none; 
            background: transparent;
            padding-top: 12px;
        """)
        
        # Bottom info row
        h_bottom = QHBoxLayout()
        h_bottom.setContentsMargins(0, 15, 0, 0)
        
        self.lbl_version = QLabel(f"v{APP_VERSION}")
        self.lbl_version.setStyleSheet("font-size: 10px; color: #555; border: none; background: transparent;")
        
        self.lbl_build = QLabel(f"Build {APP_BUILD}")
        self.lbl_build.setAlignment(Qt.AlignRight)
        self.lbl_build.setStyleSheet("font-size: 10px; color: #555; border: none; background: transparent;")
        
        h_bottom.addWidget(self.lbl_version)
        h_bottom.addStretch()
        h_bottom.addWidget(self.lbl_build)
        
        # Assemble
        container_layout.addWidget(self.lbl_icon)
        container_layout.addWidget(self.lbl_title)
        container_layout.addWidget(self.lbl_subtitle)
        container_layout.addSpacing(25)
        container_layout.addWidget(self.progress_bar)
        container_layout.addWidget(self.lbl_status)
        container_layout.addStretch()
        container_layout.addLayout(h_bottom)
        
        main_layout.addWidget(self.container)
        
        # Set initial window opacity to 0
        self.setWindowOpacity(0.0)
    
    def _setup_animations(self):
        """Configure the entrance animation."""
        self._fade_in_anim = QPropertyAnimation(self, b"windowOpacity")
        self._fade_in_anim.setDuration(800)
        self._fade_in_anim.setStartValue(0.0)
        self._fade_in_anim.setEndValue(1.0)
        self._fade_in_anim.setEasingCurve(QEasingCurve.InOutQuad)
        
        self._fade_in_anim.finished.connect(self._start_worker)
 
    def _setup_worker(self):
        """Prepare the dependency worker."""
        self.worker = DependencyWorker()
        self.worker.progress.connect(self._on_worker_progress)
        self.worker.task_finished.connect(self._on_worker_finished)

    def _start_worker(self):
        """Start the dependency check after entrance completes."""
        self.worker.start()

    def _on_worker_progress(self, percent, message):
        """Update progress bar and status text."""
        self._update_status(message)
        
        # Create or reuse the progress animation
        if not hasattr(self, '_bar_anim'):
            self._bar_anim = QPropertyAnimation(self.progress_bar, b"progressValue")
            self._bar_anim.setDuration(400)
            self._bar_anim.setEasingCurve(QEasingCurve.OutQuad)
            
        self._bar_anim.stop() # Stop previous if still running
        self._bar_anim.setStartValue(self.progress_bar.progressValue)
        self._bar_anim.setEndValue(float(percent))
        self._bar_anim.start()

    def _on_worker_finished(self):
        """Notify that loading is complete but stay visible until main window is ready."""
        self._update_status("Ready")
        self.loading_finished.emit()
    
    def close_with_fade(self):
        """Manually trigger the fade out and close."""
        self._fade_out()
    
    def _update_status(self, text):
        """Update the status label text."""
        self.lbl_status.setText(text)
    
    def _fade_out(self):
        """Fade out the entire splash screen then emit finished."""
        self._fade_out_anim = QPropertyAnimation(self, b"windowOpacity")
        self._fade_out_anim.setDuration(400)
        self._fade_out_anim.setStartValue(1.0)
        self._fade_out_anim.setEndValue(0.0)
        self._fade_out_anim.setEasingCurve(QEasingCurve.InQuad)
        self._fade_out_anim.finished.connect(self._on_finished)
        self._fade_out_anim.start()
    
    def _on_finished(self):
        """Close splash and notify the app."""
        self.close()
        self.finished.emit()

    def start(self):
        """Show the splash screen and begin animations."""
        # Center on the screen where the cursor is
        screen = QGuiApplication.screenAt(QCursor.pos()) or QGuiApplication.primaryScreen()
        if screen:
            geo = screen.availableGeometry()
            self.move(
                geo.left() + (geo.width() - self.width()) // 2,
                geo.top() + (geo.height() - self.height()) // 2
            )
        self.show()
        # Start entrance animation
        self._fade_in_anim.start()
