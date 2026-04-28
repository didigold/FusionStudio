import os, re
import shutil
from datetime import datetime
from PySide6.QtCore import QThread, Signal
# asammdf and numpy imported locally in methods to avoid startup crashes

class ClassificationWorker(QThread):
    progress = Signal(int)
    status_update = Signal(str) # Señal para actualizar texto en footer
    item_finished = Signal(object, bool, str) 
    # NOTA: No redefinimos 'finished = Signal()' porque QThread ya la tiene nativa.

    def __init__(self, tasks, project_root, meta_data, report_pdf_path):
        super().__init__()
        self.tasks = tasks
        self.project_root = project_root
        self.meta = meta_data
        self.report_pdf_path = report_pdf_path
        self.is_running = True

    def run(self):
        # 1. Procesar Casos
        total = len(self.tasks)
        for idx, task in enumerate(self.tasks):
            if not self.is_running: break
            
            # Emitir estado actual
            self.status_update.emit(f"Processing Classification: {idx + 1}/{total} cases...")
            
            try:
                self.process_single_task(task)
                self.item_finished.emit(task['item_ref'], True, "")
            except OSError as e:
                err_msg = str(e)
                if e.errno == 28 or getattr(e, 'winerror', 0) == 112:
                    err_msg = "Disk Full / No Space Left"
                self.item_finished.emit(task['item_ref'], False, err_msg)
            except Exception as e:
                self.item_finished.emit(task['item_ref'], False, str(e))
            
            self.progress.emit(int(((idx + 1) / total) * 100))
        
        # 2. Copiar Reporte PDF (si existe y se seleccionó)
        if self.is_running and self.report_pdf_path and os.path.exists(self.report_pdf_path):
            self.status_update.emit("Copying Report PDF...")
            try:
                pdf_name = os.path.basename(self.report_pdf_path)
                dest_pdf = os.path.join(self.project_root, pdf_name)
                shutil.copy2(self.report_pdf_path, dest_pdf)
            except Exception as e:
                print(f"Error copying Report PDF: {e}")

        # No emitimos manualmente self.finished.emit(). 
        # QThread lo hace automáticamente al terminar run().

    def process_single_task(self, task):
        data = task['data']
        case_full_name = task['case_full_name']
        
        case_folder = os.path.join(self.project_root, case_full_name)
        dir_channel = os.path.join(case_folder, "Channel")
        dir_movie = os.path.join(case_folder, "Movie")
        dir_report = os.path.join(case_folder, "Report")
        
        for d in [dir_channel, dir_movie, dir_report]:
            os.makedirs(d, exist_ok=True)
        
        src_file = data['path']
        
        # --- 1. MME ---
        mme_path = os.path.join(case_folder, f"{case_full_name}.mme")
        current_meta = self.meta.copy()
        current_meta['case_name'] = case_full_name
        self.generate_mme(mme_path, current_meta, data['filename'])

        # --- 2. Copia de MEDIA ---
        self.copy_media_files(src_file, case_full_name, dir_movie, dir_report)

        # --- 3. MF4 -> CHN + Signal Files ---
        from asammdf import MDF
        import numpy as np
        with MDF(src_file) as mdf:
            chn_lines = []
            channel_idx = 1
            
            for sig in mdf.iter_channels():
                if sig.samples.size == 0: continue
                
                raw_name = sig.name # Nombre ORIGINAL de la señal (ej: DispTime)
                
                # Nombre ISO Físico: NombreCaso.Indice (ej: 9999-LD_..._01.001)
                sig_filename_iso = f"{case_full_name}.{channel_idx:03d}"
                sig_file_path = os.path.join(dir_channel, sig_filename_iso)
                
                dt = 0
                if len(sig.timestamps) > 1:
                    dt = np.mean(np.diff(sig.timestamps))
                
                header = f"""Test object number          :1
Name of the channel         :{raw_name}
Laboratory channel code     :{raw_name}
Customer channel code       :NOVALUE
Channel code                :{raw_name}
Unit                        :{sig.unit}
Reference system            :NOVALUE
Transducer type             :NOVALUE
Pre-filter type             :NOVALUE
Cut off frequency           :NOVALUE
Channel amplitude class     :NOVALUE
Sampling interval           :{dt}
Bit resolution              :NOVALUE
Time of first sample        :{sig.timestamps[0] if len(sig.timestamps)>0 else 0}
Number of samples           :{len(sig.samples)}
"""
                with open(sig_file_path, 'w', encoding='utf-8') as fs:
                    fs.write(header)
                    if np.issubdtype(sig.samples.dtype, np.number):
                        np.savetxt(fs, sig.samples, fmt='%.14E')
                    else:
                        for s in sig.samples:
                            fs.write(f"{str(s)}\n")
                
                # CORRECCIÓN: En el CHN usamos raw_name para que sea identificable
                chn_lines.append(f"Name of channel {channel_idx:03d}         :{raw_name}")
                channel_idx += 1

            # Generar .CHN
            chn_path = os.path.join(dir_channel, f"{case_full_name}.chn")
            with open(chn_path, 'w', encoding='utf-8') as fchn:
                fchn.write("Instrumentation standard    :NOVALUE\n")
                fchn.write(f"Number of channels          :{len(chn_lines)}\n")
                fchn.write("\n".join(chn_lines))

    def generate_mme(self, output_path, meta, original_filename):
        timestamp = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        date_str = datetime.now().strftime("%d/%m/%Y")
        content = f"""Data format edition number  :1.6
Laboratory name             :IDIADA
Laboratory contact name     :ADAS
Laboratory contact phone    :+34 977 166 00
Laboratory contact fax      :+34 977 166 007
Laboratory contact email    :david.graells@idiada.com
Laboratory test ref. number :{meta['year']}-{meta['oem']}-{meta['ref']}
Customer name               :Euro NCAP
Customer test ref. number   :{meta['case_name']}
Customer project ref. number:{meta['year']}-{meta['oem']}-{meta['ref']}-{meta['protocol']}
Customer order number       :-
Customer cost unit          :EUR
Customer test engineer name :Aled Williams
Customer test engineer phone:-
Customer test engineer fax  :-
Customer test engineer email:aled_williams@euroencap.com
Title                       :In-Cabin Monitoring 20{meta['year']}
Medium No./number of media  :1/1
Timestamp                   :{timestamp}
Type of the test            :IN-CABIN
Subtype of the test         :DSM
Regulation                  :Euro NCAP
Reference temperature       :25ºC
Relative air humidity       :75%
Date of the test            :{date_str}
Number of test objects      :1
Name of test object 1       :{meta['oem']} Vehicle
Velocity test object 1      :0
Mass test object 1          :0 kg
Driver position object 1    :NOVALUE
Impact side test object 1   :NOVALUE
Type of test object 1       :M1 Vehicle
Class of test object 1      :EV
Code of test object 1       :{meta['oem']}_{meta['ref']}
Ref. number of test object 1:{meta['ref']}
Velocity lat test object 1  :NOVALUE
Dimensions test object 1    :NOVALUE
Profile-X test object 1     :-
Profile-Y test object 1     :-
Raw data filename           :{original_filename.replace('_tracking', '')}
"""
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)

    def copy_media_files(self, src_file, case_full_name, dir_movie, dir_report):
        src_dir = os.path.dirname(src_file)
        base_src_name = os.path.splitext(os.path.basename(src_file))[0].replace("_tracking", "")
        
        # --- VIDEO (.avi) ---
        avis = [f for f in os.listdir(src_dir) if f.lower().endswith(".avi") and f.startswith(base_src_name)]
        avis.sort()
        
        for i, avi in enumerate(avis):
            src_avi = os.path.join(src_dir, avi)
            suffix = ""
            cam_match = re.search(r'cam(\d+)', avi, re.IGNORECASE)
            if cam_match:
                suffix = f"_cam{cam_match.group(1)}"
            else:
                if len(avis) > 1: suffix = f"_cam{i+1}"
                else: suffix = "" 

            dest_avi = os.path.join(dir_movie, f"{case_full_name}{suffix}.avi")
            try:
                shutil.copy2(src_avi, dest_avi)
            except Exception: pass

        # --- IMAGEN (.png) ---
        pngs = [f for f in os.listdir(src_dir) if f.lower().endswith(".png") and f.startswith(base_src_name)]
        pngs.sort()
        for i, png in enumerate(pngs):
            src_png = os.path.join(src_dir, png)
            suffix = ""
            if len(pngs) > 1: suffix = f"_{i+1}"
            
            dest_png = os.path.join(dir_report, f"{case_full_name}{suffix}.png")
            try:
                shutil.copy2(src_png, dest_png)
            except Exception: pass

    def stop(self):
        self.is_running = False
