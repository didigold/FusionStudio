import os
import re
from datetime import datetime
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                               QLineEdit, QPushButton, QTreeWidget, QTreeWidgetItem, 
                               QFileDialog, QProgressBar, QGridLayout, QMenu, QTreeWidgetItemIterator, QMessageBox)
from PySide6.QtCore import Qt, QRegularExpression
from PySide6.QtGui import QIcon, QColor, QBrush, QAction, QRegularExpressionValidator

from src.core.utils import resource_path
from src.ui.styles import IDIADA_ORANGE
from src.ui.widgets import IconGroupBox
from src.core.classification_worker import ClassificationWorker

class ClassificationWidget(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window 
        self.files_map = {} 
        self.is_updating_path = False
        
        # --- MAPEO OFICIAL (GSR / EuroNCAP) ---
        self.ncap_data = {
            "D1":  ("Driver side window", "LD_NDT_OW_DSW"),
            "D2":  ("Passenger side window", "LD_NDT_OW_PSW"),
            "D3":  ("Passenger footwell", "LD_NDT_OW_PAF"),
            "D4":  ("Passenger face", "LD_NDT_OW_PFA"),
            "D5":  ("In-vehicle infotainment system", "LD_NDT_OW_IIS"),
            "D6":  ("In-vehicle infotainment system", "LD_NDT_LI_IIS"),
            "D7":  ("Glovebox", "LD_NDT_LI_GLB"),
            "D8":  ("Passenger footwell", "LD_NDT_BL_PAF"),
            "D9":  ("Rear passenger", "LD_NDT_BL_RPA"),
            "D10": ("Rear view mirror", "LD_DRT_OW_RVM"),
            "D11": ("Passenger side mirror", "LD_DRT_OW_PSM"),
            "D12": ("Driver side mirror", "LD_DRT_OW_DSM"),
            "D13": ("Instrument cluster", "LD_DRT_LI_ICL"),
            "D14": ("Driver side mirror", "LD_DRT_LI_DSM"),
            "D15": ("Rear view mirror", "LD_DRT_LI_RVM"),
            "D16": ("In-vehicle infotainment system", "SD_NDT_OW_IIS"),
            "D17": ("Passenger footwell", "SD_NDT_OW_PAF"),
            "D18": ("Passenger footwell", "SD_NDT_LI_PAF"),
            "D19": ("In-vehicle infotainment system", "SD_NDT_LI_IIS"),
            "D20": ("Rear view mirror", "SD_DRT_OW_RVM"),
            "D21": ("Passenger side mirror", "SD_DRT_OW_PSM"),
            "D22": ("Driver side mirror", "SD_DRT_OW_DSM"),
            "D23": ("Passenger side window", "SD_DRT_OW_PSW"),
            "D24": ("Instrument cluster", "SD_DRT_LI_ICL"),
            "D25": ("Driver side mirror", "SD_DRT_LI_DSM"),
            "D26": ("Rear view mirror", "SD_DRT_LI_RVM"),
            "D27": ("Driver side window", "SD_DRT_LI_PSW"),
            "D28": ("Combination NDT locations", "SD_AFR_LI_COMB"),
            "D29": ("Driver knee outboard", "PU_PUB_OW_DKD"),
            "D30": ("Driver knee inboard", "PU_PUB_OW_DKP"),
            "D31": ("Driver lap", "PU_PUB_OW_DLA"),
            "D32": ("Phone dash outboard", "PU_PUB_OW_PDD"),
            "D33": ("Phone in charge port", "PU_PUB_OW_DCP"),
            "D34": ("Driver knee outboard", "PU_PUB_LI_DKD"),
            "D35": ("Driver knee inboard", "PU_PUB_LI_DKP"),
            "D36": ("Driver lap", "PU_PUB_LI_DLA"),
            "D37": ("Phone centre steering wheel", "PU_PUB_LI_PHC"),
            "D38": ("Phone in charge port", "PU_PUB_LI_DCP"),
            "D39": ("Phone dash outboard", "PU_PUA_LI_PDD"),
            "D40": ("Phone 9–11 / 13–15 o’clock", "PU_PUA_LI_PHS"),
            "D41": ("Phone in view of windscreen", "PU_PUA_LI_PHW"),
            "D42": ("Phone in view of instrument cluster", "PU_PUA_LI_PHI"),
            "F1": ("Microsleep", "FAT_MSL"),
            "F2": ("Sleep", "FAT_SLE"),
            "F3": ("Drowsiness", "FAT_DRO"),
            "F4": ("Unresponsive driver", "UR_SPD"),
            "F5": ("Unresponsive driver", "UR_SPD"),
        }
        
        self.occlusion_codes = {
            4: "CG", 5: "SU", 6: "SH", 7: "LH", 8: "BL",
            9: "FM", 10: "HA", 11: "FR", 12: "EM"
        }

        self.setup_ui()
        # FIX: Check if main_window actually has 'txt_src' before accessing it, 
        # or handle initialization order. 
        # For now, we assume main_window will be passed correctly.
        if hasattr(self.main_window, 'txt_src') and self.main_window.txt_src.text():
            self.txt_source.setText(self.main_window.txt_src.text())

    def _notify(self, text, notif_type="info", duration=3000):
        if hasattr(self.main_window, "show_global_notification"):
            self.main_window.show_global_notification(text, notif_type, duration)

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(10)
        layout.setContentsMargins(10, 10, 10, 10)

        gb_config = IconGroupBox("Project Configuration & Paths", "group_search_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png", title_color="white", title_weight="500")
        gb_layout = QGridLayout()
        
        # --- Metadata Inputs con Validadores ---
        self.txt_year = QLineEdit()
        self.txt_year.setPlaceholderText("YY")
        self.txt_year.setFixedWidth(60)
        self.txt_year.setText(datetime.now().strftime("%y"))
        year_validator = QRegularExpressionValidator(QRegularExpression("[0-9]{2}"))
        self.txt_year.setValidator(year_validator)
        
        self.txt_oem = QLineEdit()
        self.txt_oem.setPlaceholderText("OEM")
        self.txt_oem.setFixedWidth(60)
        oem_validator = QRegularExpressionValidator(QRegularExpression("[A-Za-z]{3}"))
        self.txt_oem.setValidator(oem_validator)
        self.txt_oem.textChanged.connect(lambda text: self.txt_oem.setText(text.upper()))
        
        self.txt_ref = QLineEdit()
        self.txt_ref.setPlaceholderText("Ref")
        self.txt_ref.setFixedWidth(60)
        ref_validator = QRegularExpressionValidator(QRegularExpression("[0-9]{4}"))
        self.txt_ref.setValidator(ref_validator)
        
        self.txt_protocol = QLineEdit("DSM")
        self.txt_protocol.setPlaceholderText("Prot")
        self.txt_protocol.setFixedWidth(60)
        self.txt_protocol.setReadOnly(True)
        
        self.txt_report = QLineEdit()
        self.txt_report.setPlaceholderText("Select Report PDF...")
        self.txt_report.setReadOnly(True)
        
        btn_report = QPushButton("")
        btn_report.setCursor(Qt.PointingHandCursor)
        icon_file_path = resource_path(os.path.join("assets/icons", "attach_file_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png"))
        if os.path.exists(icon_file_path):
            btn_report.setIcon(QIcon(icon_file_path))
        else:
            btn_report.setText("PDF")
        btn_report.setFixedWidth(30)
        btn_report.clicked.connect(self.select_report_pdf)

        gb_layout.addWidget(QLabel("Year:"), 0, 0)
        gb_layout.addWidget(self.txt_year, 0, 1)
        gb_layout.addWidget(QLabel("OEM:"), 0, 2)
        gb_layout.addWidget(self.txt_oem, 0, 3)
        gb_layout.addWidget(QLabel("Ref:"), 0, 4)
        gb_layout.addWidget(self.txt_ref, 0, 5)
        gb_layout.addWidget(QLabel("Sufx:"), 0, 6)
        gb_layout.addWidget(self.txt_protocol, 0, 7)
        gb_layout.addWidget(QLabel("Report:"), 0, 8)
        gb_layout.addWidget(self.txt_report, 0, 9)
        gb_layout.addWidget(btn_report, 0, 10)
        
        self.txt_source = QLineEdit()
        self.txt_source.setPlaceholderText("Source Directory...")
        btn_src = QPushButton("")
        btn_src.setCursor(Qt.PointingHandCursor)
        btn_src.setIcon(QIcon(resource_path("assets/icons/folder_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        btn_src.setFixedWidth(30)
        btn_src.clicked.connect(self.select_source_folder)
        
        self.txt_output = QLineEdit()
        self.txt_output.setPlaceholderText("Output Directory...")
        self.txt_output.setReadOnly(True)
        btn_out = QPushButton("")
        btn_out.setCursor(Qt.PointingHandCursor)
        btn_out.setIcon(QIcon(resource_path("assets/icons/folder_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        btn_out.setFixedWidth(30)
        btn_out.clicked.connect(self.select_output_folder)

        gb_layout.addWidget(QLabel("Source:"), 1, 0)
        gb_layout.addWidget(self.txt_source, 1, 1, 1, 9) 
        gb_layout.addWidget(btn_src, 1, 10)
        
        gb_layout.addWidget(QLabel("Output:"), 2, 0)
        gb_layout.addWidget(self.txt_output, 2, 1, 1, 9) 
        gb_layout.addWidget(btn_out, 2, 10)

        gb_config.setLayout(gb_layout)
        layout.addWidget(gb_config)

        self.tree = QTreeWidget()
        self.tree.setHeaderLabels([
            "Original File", "Code", "Gaze Location / Scenario", 
            "Proposed Filename", "Status"
        ])
        self.tree.setAlternatingRowColors(True)
        self.tree.setSelectionMode(QTreeWidget.ExtendedSelection)
        self.tree.setContextMenuPolicy(Qt.CustomContextMenu)
        self.tree.customContextMenuRequested.connect(self.open_tree_menu)
        layout.addWidget(self.tree)

        action_layout = QHBoxLayout()
        self.btn_scan = QPushButton("Scan & Group")
        self.btn_scan.setCursor(Qt.PointingHandCursor)
        self.btn_scan.setIcon(QIcon(resource_path("assets/icons/scan_16dp_FFFFFF_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_scan.clicked.connect(self.scan_directory)
        
        self.btn_process = QPushButton("GENERATE MME/CHN")
        self.btn_process.setCursor(Qt.PointingHandCursor)
        self.btn_process.setIcon(QIcon(resource_path("assets/icons/play_circle_16dp_000000_FILL0_wght400_GRAD0_opsz20.png")))
        self.btn_process.setStyleSheet(f"background-color: {IDIADA_ORANGE}; color: black; font-weight: bold;") 
        self.btn_process.clicked.connect(self.start_processing)
        self.btn_process.setEnabled(False)

        self.pbar = QProgressBar()
        self.pbar.setVisible(False)

        action_layout.addWidget(self.btn_scan)
        action_layout.addWidget(self.pbar)
        action_layout.addWidget(self.btn_process)
        layout.addLayout(action_layout)
        
        self.txt_year.textChanged.connect(self.update_previews)
        self.txt_oem.textChanged.connect(self.update_previews)
        self.txt_ref.textChanged.connect(self.update_previews)
        self.txt_protocol.textChanged.connect(self.update_previews)
        self.txt_source.textChanged.connect(self.sync_source_path)

    def open_tree_menu(self, position):
        menu = QMenu()
        menu.setStyleSheet(f"QMenu {{ background-color: #333; color: white; border: 1px solid #555; }} QMenu::item:selected {{ background-color: {IDIADA_ORANGE}; color: black; }}")
        expand_all = QAction("Expand All", self)
        expand_all.triggered.connect(self.tree.expandAll)
        collapse_all = QAction("Collapse All", self)
        collapse_all.triggered.connect(self.tree.collapseAll)
        menu.addAction(expand_all)
        menu.addAction(collapse_all)
        
        item = self.tree.itemAt(position)
        if item and not item.parent(): 
            menu.addSeparator()
            expand_curr = QAction("Expand This Group", self)
            expand_curr.triggered.connect(lambda: item.setExpanded(True))
            collapse_curr = QAction("Collapse This Group", self)
            collapse_curr.triggered.connect(lambda: item.setExpanded(False))
            menu.addAction(expand_curr)
            menu.addAction(collapse_curr)
        menu.exec(self.tree.viewport().mapToGlobal(position))

    def select_source_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Source")
        if folder: 
            self.txt_source.setText(folder)
            self._notify(f"Source folder selected: {os.path.basename(folder)}", "success")

    def select_output_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Output")
        if folder: 
            self.txt_output.setText(folder)
            self.update_previews()
            self._notify(f"Output folder selected: {os.path.basename(folder)}", "success")
    
    def select_report_pdf(self):
        f, _ = QFileDialog.getOpenFileName(self, "Select Report PDF", "", "PDF Files (*.pdf)")
        if f:
            self.txt_report.setText(f)
            self._notify(f"Selected Report: {os.path.basename(f)}", "success")

    def sync_source_path(self):
        if self.is_updating_path: return
        self.is_updating_path = True
        if hasattr(self.main_window, 'txt_src') and self.main_window.txt_src.text() != self.txt_source.text():
            self.main_window.txt_src.setText(self.txt_source.text())
        self.is_updating_path = False

    def natural_sort_key(self, s):
        import re
        return [int(text) if text.isdigit() else text.lower() for text in re.split('([0-9]+)', s)]

    def scan_directory(self):
        base_dir = self.txt_source.text()
        if not base_dir or not os.path.exists(base_dir): return

        self.tree.clear()
        self.groups = {} 
        
        pattern = re.compile(r'([DFWB]+)(\d+)(?:_O(\d+))?_(\d+)')
        pattern_simple = re.compile(r'([DFWB]+)(\d+)')

        for root, _, files in os.walk(base_dir):
            for file in files:
                if file.endswith(".mf4"):
                    # Use a cleaned name for regex matching
                    clean_file = file.replace("_tracking", "")
                    match = pattern.match(clean_file)
                    simple_match = pattern_simple.match(clean_file)
                    if not match and not simple_match: continue

                    case_key = "Unknown"
                    attempt = "1"
                    occ_val = None
                    if match:
                        prefix, pos, occ_val, attempt = match.groups()
                        case_key = f"{prefix}{pos}"
                        if occ_val: case_key += f"_O{occ_val}"
                    elif simple_match:
                        prefix, pos = simple_match.groups()
                        case_key = f"{prefix}{pos}"

                    file_data = {
                        "path": os.path.join(root, file),
                        "filename": file,
                        "case_key": case_key,
                        "attempt": int(attempt) if attempt else 1,
                        "occ_code": self.occlusion_codes.get(int(occ_val)) if occ_val else None
                    }
                    if case_key not in self.groups: self.groups[case_key] = []
                    self.groups[case_key].append(file_data)

        sorted_keys = sorted(self.groups.keys(), key=self.natural_sort_key)

        for case_key in sorted_keys:
            file_list = self.groups[case_key]
            base_key = case_key.split('_')[0]
            info = self.ncap_data.get(base_key)
            description = info[0] if info else "Undefined Case"
            if file_list[0]['occ_code']: description += f" (Occlusion: {file_list[0]['occ_code']})"

            parent = QTreeWidgetItem(self.tree)
            parent.setText(0, f"Group: {case_key}")    
            parent.setText(1, case_key)                 
            parent.setText(2, description)              
            parent.setText(4, f"{len(file_list)} files")
            parent.setExpanded(True)
            for c in range(5): parent.setBackground(c, QBrush(QColor("#2d2d2d")))
            
            file_list.sort(key=lambda x: x['attempt'])
            
            for f_data in file_list:
                clean_name = os.path.splitext(f_data['filename'])[0]
                child = QTreeWidgetItem(parent)
                child.setText(0, clean_name)
                child.setText(3, "...")
                # STATUS: Texto vacío + icono pendiente (RUTA ABSOLUTA)
                child.setText(4, "") 
                child.setIcon(4, QIcon(resource_path("assets/icons/hourglass_16dp_F39200_FILL0_wght400_GRAD0_opsz20.png")))
                
                child.setData(0, Qt.UserRole, f_data)   
                child.setCheckState(0, Qt.Checked)
                
        self.update_previews()
        for i in range(5): self.tree.resizeColumnToContents(i)
        self.btn_process.setEnabled(True)
        self._notify(f"Scan complete: Found {len(self.groups)} groups", "success")

    def get_official_case_name_with_ref(self, case_key, attempt, occ_code=None):
        base_key = case_key.split('_')[0]
        info = self.ncap_data.get(base_key)
        
        base_code = f"UNDEFINED_{case_key}"
        if info:
            base_code = info[1] 
            if occ_code:
                parts = base_code.split('_')
                if len(parts) > 1:
                    parts.insert(-1, occ_code)
                    base_code = "_".join(parts)
                else: base_code = f"{base_code}_{occ_code}"
        
        ref_code = self.txt_ref.text().strip()
        if not ref_code: ref_code = "0000"
        
        return f"{ref_code}-{base_code}_{attempt:02d}"

    def update_previews(self):
        iterator = QTreeWidgetItemIterator(self.tree)
        while iterator.value():
            item = iterator.value()
            if item.parent():
                data = item.data(0, Qt.UserRole)
                if data:
                    final_name = self.get_official_case_name_with_ref(data['case_key'], data['attempt'], data['occ_code'])
                    item.setText(3, final_name)
                    item.setForeground(3, QBrush(QColor(IDIADA_ORANGE)))
            iterator += 1
        self.tree.resizeColumnToContents(3)

    def update_main_status(self, msg):
        """Actualiza la barra de estado de la ventana principal"""
        if hasattr(self.main_window, 'lbl_stats'):
            self.main_window.lbl_stats.setText(msg)

    def start_processing(self):
        out_dir = self.txt_output.text()
        if not out_dir: return

        year = self.txt_year.text().strip() or "YY"
        oem = self.txt_oem.text().strip() or "OEM"
        ref = self.txt_ref.text().strip() or "REF"
        prot = self.txt_protocol.text().strip() or "DSM"
        report_pdf = self.txt_report.text()
        
        project_folder_name = f"{year}-{oem}-{ref}-{prot}"
        project_root = os.path.join(out_dir, project_folder_name)
        
        meta = {'year': year, 'oem': oem, 'ref': ref, 'protocol': prot}
        
        tasks = []
        iterator = QTreeWidgetItemIterator(self.tree)
        while iterator.value():
            item = iterator.value()
            if item.parent() and item.checkState(0) == Qt.Checked:
                data = item.data(0, Qt.UserRole)
                case_full_name = self.get_official_case_name_with_ref(data['case_key'], data['attempt'], data['occ_code'])
                
                tasks.append({
                    'data': data,
                    'case_full_name': case_full_name,
                    'item_ref': item
                })
            iterator += 1
        
        if not tasks:
            return QMessageBox.warning(self, "Warning", "No files selected.")

        self.btn_process.setEnabled(False)
        self.btn_scan.setEnabled(False)
        self.pbar.setVisible(True)
        self.pbar.setValue(0)

        self.worker = ClassificationWorker(tasks, project_root, meta, report_pdf)
        self.worker.progress.connect(self.pbar.setValue)
        self.worker.status_update.connect(self.update_main_status) # Conexión al footer
        self.worker.item_finished.connect(self.on_item_finished)
        self.worker.finished.connect(self.on_process_finished)
        self.worker.start()

    def on_item_finished(self, item, success, error_msg):
        if success:
            item.setText(4, "") 
            item.setIcon(4, QIcon(resource_path("assets/icons/check_16dp_75FB4C_FILL0_wght400_GRAD0_opsz20.png")))
            item.setForeground(4, QBrush(QColor("#2d5a2d")))
            self._notify(f"Processed: {item.text(0)}", "success", 2000)
        else:
            item.setText(4, "")
            item.setIcon(4, QIcon(resource_path("assets/icons/error_16dp_EA3323_FILL0_wght400_GRAD0_opsz20.png")))
            item.setToolTip(4, error_msg) 
            item.setForeground(4, QBrush(QColor("red")))
            self._notify(f"Failed: {item.text(0)}", "error")

    def on_process_finished(self):
        self.btn_process.setEnabled(True)
        self.btn_scan.setEnabled(True)
        self.pbar.setVisible(False)
        # Restaurar mensaje de estado
        if hasattr(self.main_window, 'lbl_stats'):
            self.main_window.lbl_stats.setText("Ready")
        self._notify("Classification process complete!", "success")
        QMessageBox.information(self, "Done", f"Processing Complete!")
