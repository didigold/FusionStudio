from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                               QPushButton, QFileDialog, QComboBox, QFrame, 
                               QTableWidget, QTableWidgetItem, QHeaderView, QMessageBox, QSplitter, QGroupBox, QCheckBox, QLineEdit)
from PySide6.QtCore import Qt, QThread, Signal
from PySide6.QtGui import QIcon
from src.core.utils import resource_path
from src.ui.styles import IDIADA_ORANGE
from src.core.dsm_processor import DSMProcessor
import os
# Scientific libraries are imported locally where needed for robustness.
try:
    import pandas as pd
except ImportError:
    pd = None

class ProcessingWorker(QThread):
    progress = Signal(str)
    finished = Signal(bool, str)
    
    def __init__(self, template_path, output_path, root_folder, folders):
        super().__init__()
        self.template_path = template_path
        self.output_path = output_path
        self.root_folder = root_folder
        self.folders = folders
        
    def run(self):
        try:
            processor = DSMProcessor(callback=lambda msg: self.progress.emit(msg))
            processor.process_dsm_data(self.template_path, self.output_path, self.root_folder, self.folders)
            self.finished.emit(True, "Process finished successfully.")
        except Exception as e:
            self.finished.emit(False, str(e))

class ReportingWidget(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(10, 10, 10, 10)
        
        splitter = QSplitter(Qt.Horizontal)
        
        # --- Left Panel: Controls ---
        left_widget = QWidget()
        l_left = QVBoxLayout(left_widget)
        l_left.setContentsMargins(0, 0, 10, 0)
        
        # 1. Source Data
        gb_source = QGroupBox("1. Source Data")
        l_source = QVBoxLayout(gb_source)
        
        lbl_hint = QLabel("Select the root folder containing participant subfolders (e.g. P01, P02...)")
        lbl_hint.setStyleSheet("color: #888; font-style: italic; font-size: 10px;")
        lbl_hint.setWordWrap(True)
        l_source.addWidget(lbl_hint)
        
        h_source_file = QHBoxLayout()
        self.lbl_root_folder = QLabel("No folder selected")
        self.lbl_root_folder.setStyleSheet("color: #888;")
        self.lbl_root_folder.setWordWrap(True)
        
        btn_root_browse = QPushButton()
        btn_root_browse.setIcon(QIcon(resource_path("assets/icons/folder_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        btn_root_browse.setCursor(Qt.PointingHandCursor)
        btn_root_browse.clicked.connect(self.browse_root_folder)
        
        h_source_file.addWidget(self.lbl_root_folder, 1)
        h_source_file.addWidget(btn_root_browse)
        l_source.addLayout(h_source_file)
        l_left.addWidget(gb_source)
        
        # 2. Template Selection
        gb_template = QGroupBox("2. Template")
        l_template = QVBoxLayout(gb_template)
        
        l_template.addWidget(QLabel("Select Template:"))
        self.combo_template = QComboBox()
        self._load_templates()
        self.combo_template.currentTextChanged.connect(self._on_template_changed)
        l_template.addWidget(self.combo_template)
        l_left.addWidget(gb_template)
        
        # 3. Processing Options (dynamic based on template)
        self.gb_options = QGroupBox("3. Processing Options")
        self.l_options = QVBoxLayout(self.gb_options)
        self._option_checkboxes = []  # Track dynamic checkboxes
        l_left.addWidget(self.gb_options)
        
        # Initialize checkboxes for current template
        self._on_template_changed(self.combo_template.currentText())
        
        # 4. Output Destination
        gb_dest = QGroupBox("4. Output Destination")
        l_dest = QVBoxLayout(gb_dest)
        
        l_dest.addWidget(QLabel("Output Folder:"))
        h_dest = QHBoxLayout()
        self.lbl_output_folder = QLabel("No destination selected")
        self.lbl_output_folder.setStyleSheet("color: #888;")
        self.lbl_output_folder.setWordWrap(True)
        
        btn_dest_browse = QPushButton()
        btn_dest_browse.setIcon(QIcon(resource_path("assets/icons/folder_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        btn_dest_browse.setCursor(Qt.PointingHandCursor)
        btn_dest_browse.clicked.connect(self.browse_output_folder)
        
        h_dest.addWidget(self.lbl_output_folder, 1)
        h_dest.addWidget(btn_dest_browse)
        l_dest.addLayout(h_dest)
        
        l_dest.addWidget(QLabel("Output Filename:"))
        self.txt_filename = QLineEdit("Report_Results.xlsx")
        l_dest.addWidget(self.txt_filename)
        
        l_left.addWidget(gb_dest)
        l_left.addStretch()
        
        # Console output for logs
        self.lbl_status = QLabel("Ready.")
        self.lbl_status.setStyleSheet("color: #aaa; font-style: italic; font-size: 10px;")
        self.lbl_status.setWordWrap(True)
        l_left.addWidget(self.lbl_status)
        
        # Action Buttons Layout
        h_actions = QHBoxLayout()
        
        self.btn_generate = QPushButton("GENERATE EXCEL REPORT")
        self.btn_generate.setStyleSheet(f"""
            QPushButton {{
                background-color: {IDIADA_ORANGE}; 
                color: black; 
                border: 2px solid {IDIADA_ORANGE};
                font-weight: bold; 
                padding: 12px;
                font-size: 11px;
                border-radius: 4px;
            }}
            QPushButton:hover {{ background-color: #e67e22; border: 2px solid #e67e22; }}
            QPushButton:pressed {{ background-color: #d35400; border: 2px solid #d35400; }}
        """)
        self.btn_generate.setCursor(Qt.PointingHandCursor)
        self.btn_generate.clicked.connect(self.generate_report)
        
        self.btn_preview = QPushButton("PREVIEW RESULTS")
        self.btn_preview.setStyleSheet(f"""
            QPushButton {{
                background-color: #333; 
                color: {IDIADA_ORANGE}; 
                font-weight: bold; 
                padding: 12px;
                font-size: 11px;
                border-radius: 4px;
                border: 2px solid {IDIADA_ORANGE};
            }}
            QPushButton:hover {{ background-color: #444; }}
            QPushButton:pressed {{ background-color: #222; }}
        """)
        self.btn_preview.setCursor(Qt.PointingHandCursor)
        self.btn_preview.clicked.connect(self.preview_results)
        
        h_actions.addWidget(self.btn_generate)
        h_actions.addWidget(self.btn_preview)
        l_left.addLayout(h_actions)
        
        # --- Right Panel: Preview ---
        right_widget = QWidget()
        l_right = QVBoxLayout(right_widget)
        l_right.setContentsMargins(10, 0, 0, 0)
        
        lbl_preview = QLabel("Results Preview")
        lbl_preview.setStyleSheet(f"color: {IDIADA_ORANGE}; font-weight: bold; font-size: 14px;")
        l_right.addWidget(lbl_preview)
        
        self.table_preview = QTableWidget()
        self.table_preview.setAlternatingRowColors(True)
        self.table_preview.setStyleSheet("""
            QTableWidget {
                background-color: #2a2a2a;
                alternate-background-color: #333;
                gridline-color: #444;
                color: #ddd;
            }
            QHeaderView::section {
                background-color: #444;
                color: white;
                border: 1px solid #555;
                padding: 4px;
            }
        """)
        l_right.addWidget(self.table_preview)
        
        splitter.addWidget(left_widget)
        splitter.addWidget(right_widget)
        splitter.setStretchFactor(0, 1)
        splitter.setStretchFactor(1, 4)
        self.layout.addWidget(splitter)
        
        # State
        self.root_folder_path = None
        self.output_folder_path = None
        self.generated_file_path = None

    def _notify(self, text, notif_type="info", duration=3000):
        mw = self.window()
        if hasattr(mw, "show_global_notification"):
            mw.show_global_notification(text, notif_type, duration)
        
    # --- Template checkbox configuration ---
    # Maps template filenames to their available processing options.
    # Each option is (label, folder_name_for_search, checked_by_default).
    TEMPLATE_OPTIONS = {
        "Driver_Engagement.xlsx": [
            ("Distractions", "Distractions", True),
            ("Fatigue", "Fatigue", True),
            ("Occlusions", "Occlusions", True),
            ("Noise Variables", "Noise Variables", False),
        ],
        # Future templates can be added here, e.g.:
        # "ADDW_Template.xlsx": [
        #     ("ADDW", "ADDW", True),
        # ],
    }

    def _load_templates(self):
        templates_dir = resource_path("assets/templates")
        self.template_mapping = {}
        if os.path.exists(templates_dir):
            for file in os.listdir(templates_dir):
                if file.endswith(".xlsx"):
                    self.combo_template.addItem(file)
                    self.template_mapping[file] = os.path.join(templates_dir, file)

    def _on_template_changed(self, template_name):
        """Rebuild checkboxes based on the selected template."""
        # Clear existing checkboxes
        for chk in self._option_checkboxes:
            self.l_options.removeWidget(chk)
            chk.deleteLater()
        self._option_checkboxes.clear()
        
        # Get options for this template
        options = self.TEMPLATE_OPTIONS.get(template_name, [])
        
        if not options:
            lbl = QLabel("No options available for this template.")
            lbl.setStyleSheet("color: #888; font-style: italic;")
            # We store it in the list so it gets cleaned up too
            self._option_checkboxes.append(lbl)
            self.l_options.addWidget(lbl)
            return
            
        for label, folder_name, checked in options:
            chk = QCheckBox(label)
            chk.setChecked(checked)
            chk.setProperty("folder_name", folder_name)  # Store the folder name for lookup
            self.l_options.addWidget(chk)
            self._option_checkboxes.append(chk)
                    
    def browse_root_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Root Folder")
        if folder:
            self.root_folder_path = folder
            self.lbl_root_folder.setText(os.path.basename(folder) or folder)
            self.lbl_root_folder.setStyleSheet("color: #ddd; font-weight: bold;")
            
    def browse_output_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Output Folder")
        if folder:
            self.output_folder_path = folder
            self.lbl_output_folder.setText(os.path.basename(folder) or folder)
            self.lbl_output_folder.setStyleSheet("color: #ddd; font-weight: bold;")
            
    def _get_selected_folders(self):
        """Returns list of folder names to process based on checked options."""
        selected = []
        for chk in self._option_checkboxes:
            if isinstance(chk, QCheckBox) and chk.isChecked():
                folder_name = chk.property("folder_name")
                if folder_name:
                    selected.append(folder_name)
        return selected
            
    def generate_report(self):
        if not self.root_folder_path:
            QMessageBox.warning(self, "Missing Data", "Please select a Root Folder.")
            return
            
        if not self.output_folder_path:
            QMessageBox.warning(self, "Missing Destination", "Please select an Output Folder.")
            return
            
        selected_template = self.combo_template.currentText()
        if not selected_template:
            QMessageBox.warning(self, "Missing Template", "No template selected or available.")
            return
            
        filename = self.txt_filename.text().strip()
        if not filename:
            filename = "Report_Results.xlsx"
        if not filename.endswith(".xlsx"):
            filename += ".xlsx"
            
        template_path = self.template_mapping.get(selected_template)
        self.generated_file_path = os.path.join(self.output_folder_path, filename)
        
        folders_to_process = self._get_selected_folders()
        if not folders_to_process:
            QMessageBox.warning(self, "No Options", "Please select at least one folder type to process (e.g. Distractions).")
            return
            
        self.btn_generate.setEnabled(False)
        self.lbl_status.setText("Processing... Please wait.")
        
        # Avoid blocking UI
        self.worker = ProcessingWorker(template_path, self.generated_file_path, self.root_folder_path, folders_to_process)
        self.worker.progress.connect(self._log_progress)
        self.worker.finished.connect(self._process_finished)
        self.worker.start()
        
    def _log_progress(self, msg):
        self.lbl_status.setText(msg)
        
    def _process_finished(self, success, msg):
        self.btn_generate.setEnabled(True)
        if success:
            self.lbl_status.setText("Done!")
            self._notify("Report generated successfully", "success")
            QMessageBox.information(self, "Success", f"Report saved to:\n{self.generated_file_path}")
        else:
            self.lbl_status.setText("Error occurred.")
            self._notify("Report generation failed.", "error")
            QMessageBox.critical(self, "Error", f"Failed to generate report:\n{msg}")

    def preview_results(self):
        if not self.generated_file_path or not os.path.exists(self.generated_file_path):
            QMessageBox.warning(self, "No File", "Please generate a file first by clicking Generate Excel Report.")
            return
            
        try:
            # We just load the active sheet or the Distraction sheet to preview
            try:
                df = pd.read_excel(self.generated_file_path, sheet_name="DISTRACTION")
            except:
                df = pd.read_excel(self.generated_file_path, sheet_name=0)
            self._display_dataframe(df)
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to preview results:\n{str(e)}")

    def _display_dataframe(self, df):
        self.table_preview.setRowCount(df.shape[0])
        self.table_preview.setColumnCount(df.shape[1])
        self.table_preview.setHorizontalHeaderLabels(df.columns.astype(str).tolist())
        
        for i in range(df.shape[0]):
            for j in range(df.shape[1]):
                val = df.iloc[i, j]
                item = QTableWidgetItem(str(val))
                item.setFlags(Qt.ItemIsEnabled | Qt.ItemIsSelectable)
                self.table_preview.setItem(i, j, item)
        
        self.table_preview.resizeColumnsToContents()
