# --- ESTILOS ---
IDIADA_ORANGE = "#F39200"
DARK_BG = "#2b2b2b"
LIGHT_TEXT = "#ffffff"
ACCENT_HOVER = "#d68100"

STYLESHEET = f"""
    QMainWindow {{ background-color: {DARK_BG}; }}
    QLabel {{ color: {LIGHT_TEXT}; }}
    QGroupBox {{ 
        border: 1px solid #444; margin-top: 24px; font-weight: bold; color: {IDIADA_ORANGE}; 
        background-color: #2f2f2f; border-radius: 4px;
    }}
    QGroupBox::title {{ subcontrol-origin: margin; subcontrol-position: top left; padding: 2px 5px; top: -20px; }}
    QLineEdit {{ 
        background-color: #333; border: 1px solid #555; color: white; padding: 5px; border-radius: 4px;
    }}
    QLineEdit:focus {{ border: 1px solid {IDIADA_ORANGE}; }}
    QPushButton {{ 
        background-color: #444; color: white; border-radius: 4px; padding: 6px; font-weight: bold; border: none;
    }}
    QPushButton:hover {{ background-color: #555; }}
    QPushButton:pressed {{ background-color: #333; }}
    QPushButton#PrimaryBtn {{ 
        background-color: {IDIADA_ORANGE}; color: black; font-size: 13px; font-weight: bold;
    }}
    QPushButton#PrimaryBtn:hover {{ background-color: {ACCENT_HOVER}; }}
    QProgressBar {{ 
        border: 1px solid #444; border-radius: 4px; text-align: center; color: white; 
        background-color: #3e3e3e;
    }}
    QProgressBar::chunk {{ background-color: {IDIADA_ORANGE}; border-radius: 4px; }}
    QTableWidget, QTreeWidget {{ background-color: #333; gridline-color: #444; color: white; border: 1px solid #444; }}
    QHeaderView::section {{ background-color: #222; color: white; padding: 5px; border: none; }}
    QCheckBox, QRadioButton {{ color: white; spacing: 5px; }}
    QCheckBox::indicator, QRadioButton::indicator {{ width: 16px; height: 16px; }}
    QRadioButton::indicator:checked {{ 
        background-color: {IDIADA_ORANGE}; border: 2px solid white; border-radius: 8px; 
    }}
    QRadioButton::indicator:unchecked {{ 
        background-color: #444; border: 1px solid #666; border-radius: 8px; 
    }}
    QSplitter::handle {{ background-color: #444; }}
    QTabWidget::pane {{ border: 1px solid #444; background: #2f2f2f; }}
    QTabBar::tab {{ background: #222; color: rgba(255, 255, 255, 0.55); padding: 8px 15px; border-top-left-radius: 4px; border-top-right-radius: 4px; }}
    QTabBar::tab:selected {{ background: #3a3a3a; color: rgba(255, 255, 255, 1.0); border-bottom: 2px solid {IDIADA_ORANGE}; }}
    QMessageBox {{ background-color: {DARK_BG}; }}
    QMessageBox QLabel {{ color: {LIGHT_TEXT}; font-weight: normal; }}
    QMessageBox QPushButton {{ background-color: #444; color: white; border: 1px solid #555; }}
    QMessageBox QPushButton:hover {{ background-color: #555; }}
"""
