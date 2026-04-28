import os
import re
import gc
import shutil

class DSMProcessor:
    # Mapping of distraction IDs to categories for OCCLUSION sheet
    DISTRACTION_CATEGORIES = {
        'LD': list(range(1, 16)),   # D1-D15 = Long Distraction
        'SD': list(range(16, 29)),  # D16-D28 = Short Distraction
        'PU': list(range(29, 43)),  # D29-D42 = Phone Use
    }
    def __init__(self, callback=None):
        self.callback = callback  # Callback for progress updates

    def log(self, message):
        print(message)
        if self.callback:
            self.callback(message)

    def process_dsm_data(self, template_path, output_path, root_folder, folders_to_process):
        """
        Main entry point for DSM processing.
        Works on a local temp copy to avoid Excel save issues on network drives,
        then copies the result to the final output path.
        """
        import tempfile
        import xlwings as xw

        # Create a local temp copy to work with (Excel has issues saving to network drives)
        temp_dir = tempfile.mkdtemp(prefix="fusionreport_")
        temp_file = os.path.join(temp_dir, os.path.basename(output_path))

        # If re-processing an existing output, copy it to temp; otherwise copy template
        if os.path.exists(output_path):
            self.log(f"Output file already exists. Re-processing in place: {output_path}")
            shutil.copy2(output_path, temp_file)
        else:
            self.log(f"Copying template to local workspace...")
            shutil.copy2(template_path, temp_file)

        app = None
        try:
            app = xw.App(visible=False)
            app.screen_updating = False
            wb = app.books.open(temp_file)
            
            for folder_name in folders_to_process:
                self.log(f"\n--- Processing Folder: {folder_name} ---")
                excels_origin = self.find_excel_in_subfolder(root_folder, folder_name)
                
                if not excels_origin:
                    self.log(f"No files found for {folder_name}. Skipping.")
                    continue
                
                # For Occlusions, prepare template rows BEFORE processing data
                if folder_name.lower() == "occlusions":
                    self._prepare_occlusion_template(wb, excels_origin)
                
                for i, excel_path in enumerate(excels_origin):
                    participant_index = i + 1
                    self.log(f"Processing File: {excel_path} (Index {participant_index})")
                    self.process_single_excel(wb, excel_path, folder_name, participant_index)
            
            # Force recalculation of all formulas before saving
            self.log("Recalculating formulas...")
            app.calculation = 'automatic'
            app.calculate()
            
            # Save locally (this always works reliably)
            wb.save()
            wb.close()
            app.quit()
            del wb
            del app
            app = None
            gc.collect()
            
            # Copy the result from local temp to the final output path
            self.log(f"Copying result to {output_path}...")
            shutil.copy2(temp_file, output_path)
            
            # Clean up temp
            try:
                os.remove(temp_file)
                os.rmdir(temp_dir)
            except:
                pass
            
            self.log("\n✅ Process finished successfully.")
            return True
        except Exception as e:
            self.log(f"Critical error during processing: {str(e)}")
            try:
                if app is not None:
                    app.kill()
            except:
                pass
            gc.collect()
            # Clean up temp on error too
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
                os.rmdir(temp_dir)
            except:
                pass
            raise e

    def find_excel_in_subfolder(self, root_folder, target_name):
        """
        Searches for Excel files inside subfolders matching 'target_name'.
        Sorts paths to ensure P01 is processed before P02, etc.
        """
        valid_files = []
        for root, _, files in os.walk(root_folder):
            if target_name.lower() in [part.lower() for part in root.split(os.sep)]:
                excels = [
                    os.path.join(root, f) for f in files
                    if f.lower().endswith(".xlsx") and not f.startswith("~$")
                ]
                if len(excels) == 1:
                    valid_files.append(excels[0])
                elif len(excels) > 1:
                    self.log(f"[WARN] Multiple Excel files found in {root}. Taking the first one.")
                    valid_files.append(excels[0])
                    
        def get_sort_key(file_path):
            match = re.search(r'([A-Z])(\d{1,2})', file_path, re.IGNORECASE)
            if match:
                letter = match.group(1).upper()
                num = int(match.group(2))
                priority = 0 if letter == 'P' else 1
                return (priority, letter, num)
            return (2, file_path, 0)
            
        valid_files.sort(key=get_sort_key)
        return valid_files

    # =========================================================================
    # OCCLUSION TEMPLATE PREPARATION
    # =========================================================================

    def _get_distraction_category(self, d_num):
        """Return 'LD', 'SD', or 'PU' based on the distraction number."""
        for cat, nums in self.DISTRACTION_CATEGORIES.items():
            if d_num in nums:
                return cat
        return None

    def _prepare_occlusion_template(self, wb, excel_paths):
        """
        Pre-scan all participant Occlusion Excel files to find the maximum number
        of TCs per category (LD, SD, PU, FAT) across any single participant,
        then dynamically insert rows and merge category cells.
        D/E columns are left blank — each participant fills their own during processing.
        """
        import pandas as pd
        self.log("[*] Pre-scanning Occlusion files to build template rows...")
        
        # 1. For each participant, collect their unique TCs per category
        max_per_cat = {'LD': 0, 'SD': 0, 'PU': 0, 'F1': 0, 'F2': 0, 'F3': 0, 'F6': 0}
        
        for path in excel_paths:
            try:
                df = pd.read_excel(path)
                participant_cat_tcs = {'LD': set(), 'SD': set(), 'PU': set(), 
                                       'F1': set(), 'F2': set(), 'F3': set(), 'F6': set()}
                
                for _, row in df.iterrows():
                    if "File Name" not in row:
                        continue
                    fname = str(row["File Name"]).split('.')[0]
                    parts = fname.split("_")
                    if len(parts) < 3:
                        continue
                    prefix = fname[0].upper()
                    try:
                        main_num = int(parts[0][1:])
                    except ValueError:
                        continue
                    occ_part = parts[1].upper()
                    if not occ_part.startswith("O"):
                        continue
                    
                    if prefix == 'D':
                        cat = self._get_distraction_category(main_num)
                        if cat:
                            participant_cat_tcs[cat].add((main_num, occ_part))
                    elif prefix == 'F':
                        fat_type = f"F{main_num}"
                        if fat_type in participant_cat_tcs:
                            participant_cat_tcs[fat_type].add((main_num, occ_part))
                
                # Update max counts
                for cat in max_per_cat:
                    max_per_cat[cat] = max(max_per_cat[cat], len(participant_cat_tcs[cat]))
                    
            except Exception as e:
                self.log(f"[WARN] Could not read {path} for pre-scan: {e}")
        
        self.log(f"[*] Max TCs per participant — LD:{max_per_cat['LD']}, SD:{max_per_cat['SD']}, PU:{max_per_cat['PU']}, " +
                 f"F3:{max_per_cat['F3']}, F6:{max_per_cat['F6']}, F1:{max_per_cat['F1']}, F2:{max_per_cat['F2']}")
        
        if all(v == 0 for v in max_per_cat.values()):
            self.log("[WARN] No occlusion TCs found.")
            return
        
        # 2. Get the OCCLUSION sheet
        try:
            sheet = wb.sheets["OCCLUSION"]
        except Exception as e:
            self.log(f"[ERROR] OCCLUSION sheet not found: {e}")
            return
        
        # 3. Insert rows dynamically (bottom-up to prevent index shifting issues)
        # Template base rows: LD=4, SD=5, PU=6, F3=7, F6=8, F1=9, F2=10
        categories = ['F2', 'F1', 'F6', 'F3', 'PU', 'SD', 'LD']
        base_rows = {'LD': 4, 'SD': 5, 'PU': 6, 'F3': 7, 'F6': 8, 'F1': 9, 'F2': 10}
        inserted_counts = {c: 0 for c in categories}
        
        for cat in categories:
            n_needed = max(max_per_cat[cat], 1)
            n_insert = n_needed - 1
            
            current_base = base_rows[cat]
            for other_cat in categories:
                if base_rows[other_cat] < base_rows[cat]:
                    current_base += inserted_counts[other_cat]
            
            if n_insert > 0:
                insert_at = current_base + 1
                for _ in range(n_insert):
                    sheet.range(f"{insert_at}:{insert_at}").api.Insert()
                
                base_range = sheet.range(f"{current_base}:{current_base}")
                for offset in range(1, n_insert + 1):
                    target_row = current_base + offset
                    base_range.copy(sheet.range(f"{target_row}:{target_row}"))
                    try:
                        sheet.range(f"{target_row}:{target_row}").api.SpecialCells(2).ClearContents()
                    except:
                        pass
                
                inserted_counts[cat] = n_insert
                self.log(f"[*] Inserted {n_insert} rows for {cat} (base row {current_base})")
        
        # 4. Apply strict horizontal and vertical cell merging for structure
        # Distraction bounds
        ld_start = 4
        ld_end = ld_start + max(max_per_cat['LD'], 1) - 1
        sd_start = ld_end + 1
        sd_end = sd_start + max(max_per_cat['SD'], 1) - 1
        pu_start = sd_end + 1
        pu_end = pu_start + max(max_per_cat['PU'], 1) - 1
        
        for s_row, e_row, label in [(ld_start, ld_end, "LD"), (sd_start, sd_end, "SD"), (pu_start, pu_end, "PU")]:
            rng = sheet.range(f"B{s_row}:C{e_row}")
            rng.merge()
            rng.value = label
            
        dist_rng = sheet.range(f"A{ld_start}:A{pu_end}")
        dist_rng.merge()
        dist_rng.value = "DIST"
        
        # Fatigue bounds
        f3_start = pu_end + 1
        f3_end = f3_start + max(max_per_cat['F3'], 1) - 1
        f6_start = f3_end + 1
        f6_end = f6_start + max(max_per_cat['F6'], 1) - 1
        f1_start = f6_end + 1
        f1_end = f1_start + max(max_per_cat['F1'], 1) - 1
        f2_start = f1_end + 1
        f2_end = f2_start + max(max_per_cat['F2'], 1) - 1
        
        # Driver State IMP + Scenarios DRO, NO-FAT
        imp_start = f3_start
        imp_end = f6_end
        
        rng_imp = sheet.range(f"B{imp_start}:B{imp_end}")
        rng_imp.merge()
        rng_imp.value = "IMP"
        
        rng_f3_c = sheet.range(f"C{f3_start}:C{f3_end}")
        rng_f3_c.merge()
        rng_f3_c.value = "DRO"
        
        rng_f6_c = sheet.range(f"C{f6_start}:C{f6_end}")
        rng_f6_c.merge()
        rng_f6_c.value = "NO-FAT"
        
        # Driver State MSL, SLE
        rng_f1 = sheet.range(f"B{f1_start}:C{f1_end}")
        rng_f1.merge()
        rng_f1.value = "MSL"
        
        rng_f2 = sheet.range(f"B{f2_start}:C{f2_end}")
        rng_f2.merge()
        rng_f2.value = "SLE"
        
        fat_rng = sheet.range(f"A{f3_start}:A{f2_end}")
        fat_rng.merge()
        fat_rng.value = "FATIGUE"
        
        # Store all row ranges for use during processing
        self._occ_row_ranges = {
            'LD': (ld_start, ld_end),
            'SD': (sd_start, sd_end),
            'PU': (pu_start, pu_end),
            'F3': (f3_start, f3_end),
            'F6': (f6_start, f6_end),
            'F1': (f1_start, f1_end),
            'F2': (f2_start, f2_end),
        }
        
        self.log(f"[*] Occlusion template prepared: LD({ld_start}-{ld_end}), SD({sd_start}-{sd_end}), PU({pu_start}-{pu_end}), " +
                 f"F3({f3_start}-{f3_end}), F6({f6_start}-{f6_end}), F1({f1_start}-{f1_end}), F2({f2_start}-{f2_end})")

    def detect_sheet(self, file_name, filtered_folder=None):
        """Detect which sheet a file belongs to based on its name prefix and source folder."""
        # If we are processing from the Occlusions folder, route to OCCLUSION sheet
        if filtered_folder and filtered_folder.lower() == "occlusions":
            return "OCCLUSION"

        parts = file_name.split("_")
        for part in parts:
            if part.startswith("O") or part.startswith("B"):
                return "NOISE VARIABLES"

        if file_name.startswith("D"):
            return "DISTRACTION"
        elif file_name.startswith("F"):
            return "FATIGUE"

        self.log(f"[SKIP] File Name not recognized: {file_name}")
        return None

    def get_ids(self, file_name, sheet_type=None):
        """Extract sheet type and IDs from a file name."""
        if sheet_type is None:
            sheet_type = self.detect_sheet(file_name)
        
        parts = file_name.split("_")
        main_id = None
        noisevar_id = None

        for part in parts:
            if part.startswith("O") or part.startswith("B"):
                noisevar_id = part
                if file_name.startswith("D") or file_name.startswith("F"):
                    main_id = file_name[1:].split("_")[0]
                return sheet_type, main_id, noisevar_id

        if file_name.startswith("D") or file_name.startswith("F"):
            main_id = file_name[1:].split("_")[0]

        return sheet_type, main_id, noisevar_id

    def get_repetition_label(self, file_name, sheet_type, main_id, noisevar_id, manual_rep=None):
        """Get the repetition label (e.g. 'Repetition 1')."""
        if manual_rep is not None:
            return f"Repetition {manual_rep}"
            
        try:
            if sheet_type in ["DISTRACTION", "FATIGUE"]:
                repetition = int(file_name.split("_")[1])
            elif sheet_type == "NOISE VARIABLES":
                repetition = int(file_name.split("_")[2])
            elif sheet_type == "OCCLUSION":
                repetition = int(file_name.split("_")[2])
            else:
                self.log(f"[WARN] Type '{sheet_type}' not recognized for repetition.")
                return None
            return f"Repetition {repetition}"
        except Exception as e:
            self.log(f"[SKIP] Could not get repetition for '{file_name}': {e}")
            return None

    def get_column_letter(self, n):
        """Convert a 1-based column number to an Excel column letter."""
        string = ""
        while n > 0:
            n, remainder = divmod(n - 1, 26)
            string = chr(65 + remainder) + string
        return string

    # Configuration per sheet type
    SHEET_CONFIG = {
        "DISTRACTION": {
            "start_col_p1": 7,   # G
            "block_width":  9,
            "title_row":    1,
            "data_start_row": 4,
        },
        "FATIGUE": {
            "start_col_p1": 6,   # F
            "block_width":  9,
            "title_row":    1,
            "data_start_row": 4,
        },
        "OCCLUSION": {
            "start_col_p1": 4,   # D (includes ID + Occ + 9 data cols per participant)
            "block_width":  11,
            "title_row":    1,
            "data_start_row": 4,
            "title_col_offset": 2,  # P01 label is at col F (D+2), not at block start D
        },
    }

    def ensure_participant_block(self, sheet, sheet_type, target_participant_str):
        """Ensure a participant block exists in the sheet."""
        config = self.SHEET_CONFIG.get(sheet_type)
        if not config:
            self.log(f"[WARN] No block config for sheet type '{sheet_type}'.")
            return None
        
        start_col_p1 = config["start_col_p1"]
        block_width = config["block_width"]
        title_row = config["title_row"]
        title_col_offset = config.get("title_col_offset", 0)  # Offset of participant label within block
        
        # Read the title row to find existing participants
        row_values = sheet.range(
            f"{self.get_column_letter(start_col_p1)}{title_row}:ZZ{title_row}"
        ).value
        
        existing_participants = []
        if row_values:
            for i, val in enumerate(row_values):
                if val and isinstance(val, str) and re.match(r'^[A-Z]\d{1,2}$', val.strip(), re.IGNORECASE):
                    found_col = start_col_p1 + i
                    block_start = found_col - title_col_offset
                    existing_participants.append({
                        'id': val.strip().upper(),
                        'start_col': block_start
                    })
                
        if not existing_participants:
            self.log(f"[WARN] No base block found in row {title_row} (e.g. P01). Aborting dynamic expansion.")
            return None
            
        for p in existing_participants:
            if p['id'] == target_participant_str.upper():
                return p['start_col']
                
        existing_participants.sort(key=lambda x: x['start_col'])
        last_block = existing_participants[-1]
        origin_start_col = last_block['start_col']
        new_start_col = origin_start_col + block_width
        new_end_col = new_start_col + block_width - 1
        
        self.log(f"[*] Expanding {sheet_type} template: Creating block for {target_participant_str.upper()}...")
        
        first_start_letter = self.get_column_letter(start_col_p1)
        first_end_letter = self.get_column_letter(start_col_p1 + block_width - 1)
        new_start_letter = self.get_column_letter(new_start_col)
        new_end_letter = self.get_column_letter(new_end_col)
        
        origin_range = sheet.range(f"{first_start_letter}:{first_end_letter}")
        dest_range = sheet.range(f"{new_start_letter}:{new_end_letter}")
        origin_range.copy(dest_range)
        
        data_start_row = config.get("data_start_row", 4)
        try:
            data_range = sheet.range(
                f"{new_start_letter}{data_start_row}:{new_end_letter}{sheet.cells.last_cell.row}"
            )
            data_range.api.SpecialCells(2).ClearContents()
        except:
            pass
            
        id_col = new_start_col + title_col_offset
        id_col_letter = self.get_column_letter(id_col)
        sheet.range(f"{id_col_letter}{title_row}").value = target_participant_str.upper()
        return new_start_col

    def find_row_by_id(self, sheet, row_id, sheet_type):
        """Find the row in the sheet where 'row_id' appears in the ID column."""
        try:
            if sheet_type == "DISTRACTION":
                values = sheet.range("E1:E500").value
            elif sheet_type == "FATIGUE":
                values = sheet.range("E1:E500").value
            else:
                self.log(f"[WARN] Type '{sheet_type}' not recognized for row lookup.")
                return None

            if not values:
                return None

            matches = [i + 1 for i, v in enumerate(values) if v == row_id]
            if not matches:
                self.log(f"[NO MATCH] '{row_id}' not found in ID column ({sheet_type})")
                return None

            return matches[0]
        except Exception as e:
            self.log(f"[ERROR] find_row_by_id: {e}")
            return None

    def find_row_by_id_occ(self, sheet, main_id, occ_id, base_col):
        """Find the row in the OCCLUSION sheet matching BOTH main_id and occ_id."""
        try:
            d_col_letter = self.get_column_letter(base_col)
            e_col_letter = self.get_column_letter(base_col + 1)
            col_d = sheet.range(f"{d_col_letter}1:{d_col_letter}500").value
            col_e = sheet.range(f"{e_col_letter}1:{e_col_letter}500").value
            if not col_d or not col_e:
                return None
            
            for i in range(len(col_d)):
                d_val = str(col_d[i]).strip().upper() if col_d[i] else ""
                e_val = str(col_e[i]).strip().upper() if col_e[i] else ""
                if d_val == main_id.upper() and e_val == occ_id.upper():
                    return i + 1
            return None
        except Exception as e:
            self.log(f"[ERROR] find_row_by_id_occ: {e}")
            return None

    def find_repetition_col_in_block(self, sheet, base_col, block_width, rep_label, header_row=2):
        """Search for a repetition label within a participant's block."""
        start_letter = self.get_column_letter(base_col)
        end_letter = self.get_column_letter(base_col + block_width - 1)
        search_range = sheet.range(f"{start_letter}{header_row}:{end_letter}{header_row}").value
        if not search_range:
            return None
        if not isinstance(search_range, list):
            search_range = [search_range]
        for idx, val in enumerate(search_range):
            if val == rep_label:
                return base_col + idx
        return None

    def find_noise_id_row(self, sheet, noise_letter, participant_num):
        try:
            if noise_letter == "O":
                rng = sheet.range("E1:E500").value
            elif noise_letter == "B":
                rng = sheet.range("AB1:AB500").value
            else:
                return None

            if not rng: return None
            matches = [i + 1 for i, v in enumerate(rng) if v == "ID"]
            if len(matches) < participant_num:
                self.log(f"[NOISE][ERROR] Only {len(matches)} IDs, requested {participant_num}")
                return None
            return matches[participant_num - 1]
        except Exception as e:
            self.log(f"[NOISE][ERROR] find_noise_id_row: {e}")
            return None
        
    def find_d_f_row_in_id_column(self, sheet, letter, id_col, start_row):
        current_row = start_row + 1
        while True:
            val = sheet.range(f"{id_col}{current_row}").value
            if val is None:
                current_row += 1
                continue
            val_str = str(val).strip()
            if val_str == "ID":
                return None
            if val_str == letter:
                return current_row
            current_row += 1

    def find_repetition_col_in_row_26(self, sheet, rep_label, noise_letter):
        try:
            values = sheet.range("A26:ZZ26").value
            if not values: return None
            matches = [i + 1 for i, v in enumerate(values) if v == rep_label]
            if not matches:
                self.log(f"[NOISE][WARN] Not found '{rep_label}' in row 26.")
                return None
            if noise_letter == "O":
                return matches[0]
            elif noise_letter == "B":
                if len(matches) >= 2: return matches[1]
                else: return None
            else:
                return None
        except Exception as e:
            self.log(f"[ERROR] find_repetition_col_in_row_26: {e}")
            return None

    def process_single_excel(self, wb, origin_path, filtered_folder, participant_index):
        """Process a single participant's results Excel file."""
        import pandas as pd
        try:
            df = pd.read_excel(origin_path)
        except Exception as e:
            self.log(f"Error loading Excel {origin_path}: {e}")
            return

        path_parts = os.path.normpath(origin_path).split(os.sep)
        participant_id = None
        for part in reversed(path_parts):
            if re.match(r'^[A-Z]\d{1,2}$', part, re.IGNORECASE):
                participant_id = part.upper()
                break
        
        if not participant_id:
            self.log(f"[ERROR] Could not find participant identifier in path: {origin_path}")
            return

        if "File Name" in df.columns:
            def natural_sort_key(s):
                import re
                return [int(text) if text.isdigit() else text.lower()
                        for text in re.split(r'(\d+)', str(s))]
            df = df.copy()
            df['sort_key'] = df['File Name'].apply(natural_sort_key)
            df = df.sort_values(by='sort_key').drop(columns='sort_key')

        used_rows = {}
        rep_counters = {}

        for index, row in df.iterrows():
            if "File Name" not in row or "Warning Timer" not in row:
                continue
            file_name = str(row["File Name"]).split('.')[0]
            warning_value = row["Warning Timer"]
            if not isinstance(warning_value, (int, float)) and not pd.isna(warning_value):
                continue

            sheet_type, main_id, noisevar_id = self.get_ids(file_name, 
                sheet_type="OCCLUSION" if filtered_folder.lower() == "occlusions" else None)
            if not sheet_type:
                continue

            try:
                sheet = wb.sheets[sheet_type]
            except Exception as e:
                self.log(f"[ERROR] Sheet '{sheet_type}' not found in destination. ({e})")
                continue

            row_id = file_name.split("_")[0]

            # ---------- NOISE VARIABLES ----------
            if sheet_type == "NOISE VARIABLES":
                if not noisevar_id: continue
                main_prefix = file_name[0].upper() if len(file_name) > 0 else None
                if main_prefix not in ["D", "F"]: continue
                main_full = f"{main_prefix}{main_id}"
                rep_key = (sheet_type, main_id, noisevar_id)
                rep_counters[rep_key] = rep_counters.get(rep_key, 0) + 1
                rel_rep = rep_counters[rep_key]
                target_col = self.get_repetition_label(file_name, sheet_type, main_id, noisevar_id, manual_rep=rel_rep)
                if not target_col: continue
                noise_letter = noisevar_id[0].upper()
                if noise_letter == "O":
                    noise_id_row = self.find_noise_id_row(sheet, "O", participant_index)
                    id_ref_col_letter = "E"
                elif noise_letter == "B":
                    noise_id_row = self.find_noise_id_row(sheet, "B", participant_index)
                    id_ref_col_letter = "AB"
                else: continue
                if not noise_id_row: continue
                col_o = 6
                col_b = 29
                main_full_noise = f"{main_prefix}{main_id}_{noisevar_id}"
                if main_full_noise in used_rows:
                    current_row = used_rows[main_full_noise]
                else:
                    current_row = self.find_d_f_row_in_id_column(sheet, main_prefix, id_ref_col_letter, noise_id_row)
                    if current_row:
                        sheet.range((current_row, id_ref_col_letter)).value = main_full
                        used_rows[main_full_noise] = current_row
                noise_val = f"{noise_letter}{noisevar_id[1:]}"
                if noise_letter == "O" and col_o: sheet.range((noise_id_row, col_o)).value = noise_val
                elif noise_letter == "B" and col_b: sheet.range((noise_id_row, col_b)).value = noise_val
                rep_col = self.find_repetition_col_in_row_26(sheet, target_col, noise_letter)
                if not rep_col: continue
                val_to_write = '-' if pd.isna(warning_value) else warning_value
                if current_row is not None: sheet.range((current_row, rep_col)).value = val_to_write
                continue

            # ---------- DISTRACTION ----------
            if sheet_type == "DISTRACTION":
                rep_key = (sheet_type, main_id, noisevar_id)
                rep_counters[rep_key] = rep_counters.get(rep_key, 0) + 1
                rel_rep = rep_counters[rep_key]
                target_col = self.get_repetition_label(file_name, sheet_type, main_id, noisevar_id, manual_rep=rel_rep)
                if not target_col: continue
                row_index = self.find_row_by_id(sheet, row_id, sheet_type)
                if not row_index: continue
                base_col = self.ensure_participant_block(sheet, sheet_type, participant_id)
                if not base_col: continue
                config = self.SHEET_CONFIG["DISTRACTION"]
                col_index = self.find_repetition_col_in_block(sheet, base_col, config["block_width"], target_col, header_row=2)
                if not col_index: continue
                val_to_write = '-' if pd.isna(warning_value) else warning_value
                sheet.range((row_index, col_index)).value = val_to_write

            # ---------- FATIGUE ----------
            elif sheet_type == "FATIGUE":
                rep_key = (sheet_type, main_id, noisevar_id)
                rep_counters[rep_key] = rep_counters.get(rep_key, 0) + 1
                rel_rep = rep_counters[rep_key]
                target_col = self.get_repetition_label(file_name, sheet_type, main_id, noisevar_id, manual_rep=rel_rep)
                if not target_col: continue
                row_index = self.find_row_by_id(sheet, row_id, sheet_type)
                if not row_index: continue
                base_col = self.ensure_participant_block(sheet, sheet_type, participant_id)
                if not base_col: continue
                config = self.SHEET_CONFIG["FATIGUE"]
                col_index = self.find_repetition_col_in_block(sheet, base_col, config["block_width"], target_col, header_row=2)
                if not col_index: continue
                val_to_write = '-' if pd.isna(warning_value) else warning_value
                sheet.range((row_index, col_index)).value = val_to_write

            # ---------- OCCLUSION ----------
            elif sheet_type == "OCCLUSION":
                rep_key = (sheet_type, main_id, noisevar_id)
                rep_counters[rep_key] = rep_counters.get(rep_key, 0) + 1
                rel_rep = rep_counters[rep_key]
                rep_label = self.get_repetition_label(file_name, sheet_type, main_id, noisevar_id, manual_rep=rel_rep)
                if not rep_label: continue
                prefix = file_name[0].upper()
                main_full = f"{prefix}{main_id}"
                occ_full = noisevar_id.upper() if noisevar_id else None
                if not occ_full: continue
                base_col = self.ensure_participant_block(sheet, sheet_type, participant_id)
                if not base_col: continue
                config = self.SHEET_CONFIG["OCCLUSION"]
                if prefix == 'D':
                    d_num = int(main_id)
                    cat = self._get_distraction_category(d_num)
                    if not cat: continue
                    if not hasattr(self, '_occ_row_ranges') or cat not in self._occ_row_ranges: continue
                    row_start, row_end = self._occ_row_ranges[cat]
                elif prefix == 'F':
                    cat = f"F{main_id}"
                    if not hasattr(self, '_occ_row_ranges') or cat not in self._occ_row_ranges: continue
                    row_start, row_end = self._occ_row_ranges[cat]
                else: continue
                d_col_letter = self.get_column_letter(base_col)
                e_col_letter = self.get_column_letter(base_col + 1)
                row_index = self.find_row_by_id_occ(sheet, main_full, occ_full, base_col)
                if not row_index:
                    found_empty = False
                    for r in range(row_start, row_end + 1):
                        d_val = sheet.range(f"{d_col_letter}{r}").value
                        if d_val is None or str(d_val).strip() == "":
                            sheet.range(f"{d_col_letter}{r}").value = main_full
                            sheet.range(f"{e_col_letter}{r}").value = occ_full
                            row_index = r
                            found_empty = True
                            break
                    if not found_empty: continue
                col_index = self.find_repetition_col_in_block(sheet, base_col, config["block_width"], rep_label, header_row=2)
                if not col_index: continue
                val_to_write = '-' if pd.isna(warning_value) else warning_value
                sheet.range((row_index, col_index)).value = val_to_write
