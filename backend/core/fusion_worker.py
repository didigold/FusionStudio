import os
import re
import gc
import time
import shutil
from datetime import datetime

from backend.core.utils import clone_file_metadata, resource_path, IDIADA_ORANGE


class ParticipantScanner:
    def __init__(self, source_dir, on_finished=None):
        self.source_dir = source_dir
        self.on_finished = on_finished

    def run(self):
        results = []
        try:
            parts = [d for d in os.listdir(self.source_dir)
                     if os.path.isdir(os.path.join(self.source_dir, d)) and re.match(r"^[A-Z][0-9]{2}$", d)]
            parts.sort()
            fusion_dir = os.path.join(self.source_dir, "_FUSION_RESULTS")

            for p in parts:
                p_path = os.path.join(self.source_dir, p)

                masters = []
                satellites = []

                # Masters: .mf4 files directly in the participant root folder
                for f in os.listdir(p_path):
                    full_path = os.path.join(p_path, f)
                    if os.path.isfile(full_path) and f.lower().endswith(".mf4"):
                        masters.append({"name": f, "path": full_path})

                # Satellites: .mf4 files in any subfolder of the participant
                for root, _, files in os.walk(p_path):
                    if root == p_path:
                        continue  # already handled above
                    if "_FUSION_RESULTS" in root or "_TEMP" in root:
                        continue
                    for f in files:
                        if f.lower().endswith(".mf4"):
                            satellites.append(f)

                masters.sort(key=lambda x: x["name"])
                satellites.sort()

                count_total_files = len(satellites)
                count_total_vids = 0
                for root, _, files in os.walk(p_path):
                    if "_FUSION_RESULTS" in root or "_TEMP" in root:
                        continue
                    for f in files:
                        if f.lower().endswith(".avi"):
                            count_total_vids += 1

                count_done_files = 0
                count_done_vids = 0
                p_fusion_path = os.path.join(fusion_dir, p)
                if os.path.exists(p_fusion_path):
                    for root, _, files in os.walk(p_fusion_path):
                        for f in files:
                            if f.lower().endswith(".mf4") and not f.startswith("._"):
                                count_done_files += 1
                            if f.lower().endswith(".avi") and not f.startswith("._"):
                                count_done_vids += 1

                status_str = f"{count_done_files}/{count_total_files} files | {count_done_vids}/{count_total_vids} vids"
                is_files_done = (count_done_files >= count_total_files) and (count_total_files > 0)
                is_vids_done = (count_done_vids >= count_total_vids) and (count_total_vids > 0)

                color_code = "#d1242f"
                if count_total_files == 0 and count_total_vids == 0:
                    status_str = "No Data"
                    color_code = "gray"
                elif is_files_done and is_vids_done:
                    color_code = "#2da44e"
                elif count_done_files > 0 or count_done_vids > 0:
                    color_code = IDIADA_ORANGE

                results.append({
                    "name": p,
                    "path": p_path,
                    "status_text": status_str,
                    "color": color_code,
                    "masters": masters,
                    "satellites": satellites
                })
        except Exception:
            pass

        if self.on_finished:
            self.on_finished(results)
        return results

    def run_sync(self):
        return self.run()


class PreviewSignalsWorker:
    def __init__(self, file_path, on_finished=None, on_error=None):
        self.file_path = file_path
        self.on_finished = on_finished
        self.on_error = on_error

    def run(self):
        from asammdf import MDF
        try:
            data = []
            with MDF(self.file_path) as mdf:
                for g_idx, group in enumerate(mdf.groups):
                    source_name = f"Group {g_idx}"
                    try:
                        if hasattr(group, 'channel_group') and hasattr(group.channel_group, 'acq_name') and group.channel_group.acq_name:
                            source_name = group.channel_group.acq_name
                    except Exception:
                        pass
                    for c_idx, ch in enumerate(group.channels):
                        name = ch.name
                        count = "N/A"
                        try:
                            count = group.channel_group.cycles_nr
                        except Exception:
                            pass
                        data.append({"name": name, "count": count, "group": source_name, "g_idx": g_idx, "c_idx": c_idx})
            data.sort(key=lambda x: x["name"])
            if self.on_finished:
                self.on_finished(data)
            return data
        except Exception as e:
            if self.on_error:
                self.on_error(str(e))
            return None


class FusionWorker:
    def __init__(self, source_dir, participants_to_process, signal_whitelist=None,
                 copy_videos=False, overwrite_mode=False,
                 on_log=None, on_progress=None, on_participant_progress=None,
                 on_participant_status=None, on_cleaning_mem=None, on_finished=None, on_error=None):
        self.source_dir = source_dir
        self.participants_to_process = participants_to_process
        self.dest_dir = os.path.join(source_dir, "_FUSION_RESULTS")
        self.signal_whitelist = signal_whitelist
        self.copy_videos = copy_videos
        self.overwrite_mode = overwrite_mode
        self.is_running = True
        self.is_paused = False

        self.on_log = on_log
        self.on_progress = on_progress
        self.on_participant_progress = on_participant_progress
        self.on_participant_status = on_participant_status
        self.on_cleaning_mem = on_cleaning_mem
        self.on_finished = on_finished
        self.on_error = on_error

    def _log(self, msg):
        if self.on_log:
            self.on_log(msg)

    def _progress(self, val):
        if self.on_progress:
            self.on_progress(val)

    def _participant_progress(self, name, pct):
        if self.on_participant_progress:
            self.on_participant_progress(name, pct)

    def _participant_status(self, name, status):
        if self.on_participant_status:
            self.on_participant_status(name, status)

    def _cleaning_mem(self, active):
        if self.on_cleaning_mem:
            self.on_cleaning_mem(active)

    def convert_size(self, size_bytes):
        import numpy as np
        if size_bytes == 0:
            return "0B"
        size_name = ("B", "KB", "MB", "GB", "TB")
        i = int(np.floor(np.log(size_bytes) / np.log(1024)))
        p = np.power(1024, i)
        s = round(size_bytes / p, 2)
        return f"{s} {size_name[i]}"

    def pause(self):
        self.is_paused = True
        self._log(f"[{self._ts()}] ⏸️ PROCESS PAUSED")

    def resume(self):
        self.is_paused = False
        self._log(f"[{self._ts()}] ▶️ PROCESS RESUMED")

    def stop(self):
        self.is_running = False
        self.is_paused = False
        self._log(f"[{self._ts()}] 🛑 STOP REQUESTED...")

    def wait_if_paused(self):
        while self.is_paused and self.is_running:
            time.sleep(0.5)

    def _ts(self):
        return datetime.now().strftime("%H:%M:%S")

    def run(self):
        self._log(f"[{self._ts()}] --- 🚀 STARTING BATCH PROCESS (v26.10) ---")
        if self.overwrite_mode:
            self._log(f"[{self._ts()}] --- ⚠️ OVERWRITE MODE: ON ---")
        if self.signal_whitelist:
            self._log(f"[{self._ts()}] --- Filter: ACTIVE ({len(self.signal_whitelist)} signals) ---")
        else:
            self._log(f"[{self._ts()}] --- Filter: OFF (All Signals) ---")
        vid_msg = "ON" if self.copy_videos else "OFF"
        self._log(f"[{self._ts()}] --- Video Copy: {vid_msg} ---")
        os.makedirs(self.dest_dir, exist_ok=True)
        try:
            total_parts = len(self.participants_to_process)
            for idx, p_name in enumerate(self.participants_to_process):
                self.wait_if_paused()
                if not self.is_running:
                    break

                self._participant_progress(p_name, 0)

                def update_sub_progress(val_in_participant, _p_name=p_name):
                    self._participant_progress(_p_name, int(val_in_participant * 100))

                full_path_p = os.path.join(self.source_dir, p_name)

                try:
                    self.procesar_participante(full_path_p, self.dest_dir, update_sub_progress)
                    if self.is_running:
                        self._participant_status(p_name, "Done")
                        self._participant_progress(p_name, 100)
                except Exception as ex_part:
                    self._log(f"[{self._ts()}] ❌ CRITICAL ERROR in {p_name}: {ex_part}")
                    self._participant_status(p_name, "Error")

                if idx < total_parts - 1 and self.is_running:
                    self._log(f"[{self._ts()}] 🧹 Cleaning RAM memory (5s wait)...")
                    self._cleaning_mem(True)
                    gc.collect()
                    for _ in range(50):
                        if not self.is_running:
                            break
                        time.sleep(0.1)
                    self._cleaning_mem(False)

            self._progress(1.0)
            if not self.is_running:
                self._log(f"[{self._ts()}] --- 🛑 BATCH STOPPED ---")
            else:
                self._log(f"[{self._ts()}] --- ✅ BATCH COMPLETED ---")
        except Exception as e:
            if self.on_error:
                self.on_error(str(e))
        finally:
            if self.on_finished:
                self.on_finished()

    def obtener_maestros(self, carpeta):
        """Return master .mf4 files from the participant root folder, ranked by relevance.
        Masters are always located directly inside the participant folder (never in subfolders).
        Ranking: files whose name starts with the participant code score higher;
        size (in GB) provides a secondary tie-breaker.
        """
        p_name = os.path.basename(carpeta)
        all_files = [f for f in os.listdir(carpeta) if f.lower().endswith(".mf4")]
        candidates = []
        for f in all_files:
            path = os.path.join(carpeta, f)
            try:
                size = os.path.getsize(path)
                score = 0
                if f.upper().startswith(p_name.upper()):
                    score += 100
                score += (size / (1024 * 1024 * 1024))  # GB as secondary sort
                candidates.append((score, path))
            except Exception:
                pass
        candidates.sort(key=lambda x: x[0], reverse=True)
        return [c[1] for c in candidates]

    def buscar_satelites(self, carpeta):
        mapa = {}
        for root, _, files in os.walk(carpeta):
            if "_TEMP" in root or "_FUSION_RESULTS" in root:
                continue
            if root == carpeta:
                continue
            for f in files:
                if f.lower().endswith(".mf4"):
                    mapa[f] = os.path.join(root, f)
        return mapa

    def buscar_videos(self, carpeta):
        mapa = []
        for root, _, files in os.walk(carpeta):
            if "_TEMP" in root or "_FUSION_RESULTS" in root:
                continue
            for f in files:
                if f.lower().endswith(".avi"):
                    mapa.append(os.path.join(root, f))
        return mapa

    def get_names(self, tipo, num, test, ob):
        carpeta_tipo = {1: "Custom", 2: "Distractions", 3: "Fatigue", 4: "Occlusions",
                        5: "Behaviour", 6: "Behaviour", 8: "ADDW low speed",
                        10: "ADDW high speed"}.get(tipo, "Unknown")
        prefijo = "X"
        if tipo == 2:
            prefijo = "D"
        elif tipo == 3:
            prefijo = "F"
        elif tipo in [8, 10]:
            prefijo = "ADDW"
        elif tipo in [4, 5]:
            prefijo = "D" if num <= 42 else "F"
        nombre = ""
        if ob == 0:
            nombre = f"{prefijo}{num}_{test}.mf4"
        else:
            base_num = num - 42 if (tipo in [4, 5] and num > 42) else num
            char = "O" if tipo == 4 else "B"
            if tipo == 5:
                char = "B"
            nombre = f"{prefijo}{base_num}_{char}{ob}_{test}.mf4"
        return nombre, carpeta_tipo

    def procesar_participante(self, ruta_p, ruta_salida, progress_cb):
        nombre_p = os.path.basename(ruta_p)
        self._log(f"[{self._ts()}] 📂 Participant: {nombre_p}")

        maestros = self.obtener_maestros(ruta_p)
        if not maestros:
            self._log(f"[{self._ts()}]    ⚠️ No valid Master files found.")
            return

        total_maestros = len(maestros)
        self._log(f"[{self._ts()}]    🔎 Found {total_maestros} potential Master file(s).")

        dir_temp = os.path.join(ruta_salida, "_TEMP_PROCESSING", nombre_p)
        os.makedirs(dir_temp, exist_ok=True)
        dir_final = os.path.join(ruta_salida, nombre_p)

        for m_idx, maestro in enumerate(maestros):
            self.wait_if_paused()
            if not self.is_running:
                break

            m_name = os.path.basename(maestro)
            self._log(f"[{self._ts()}]    💿 Processing Master {m_idx + 1}/{total_maestros}: {m_name}")

            base_m = m_idx / total_maestros
            step_m = 1.0 / total_maestros

            def update_phase_1(val, _base_m=base_m, _step_m=step_m):
                local_p = _base_m + (_step_m * 0.4 * val)
                if progress_cb:
                    progress_cb(local_p)

            def update_phase_2(val, _base_m=base_m, _step_m=step_m):
                local_p = _base_m + (_step_m * 0.4) + (_step_m * 0.6 * val)
                if progress_cb:
                    progress_cb(local_p)

            cortes = self.fase_1_auditoria_y_cortes(maestro, dir_temp, ruta_p, dir_final, update_phase_1)

            if not cortes:
                self._log(f"[{self._ts()}]       (No new cuts generated from this master)")
                update_phase_1(1.0)
            else:
                n_ok = self.fase_2_fusionar(cortes, ruta_p, dir_final, update_phase_2)
                self._log(f"[{self._ts()}]       ✅ Fused {n_ok} files from {m_name}.")

            gc.collect()

        try:
            shutil.rmtree(dir_temp)
        except Exception:
            pass

        if self.copy_videos and self.is_running:
            self.fase_3_copiar_videos(ruta_p, dir_final)

    def fase_1_auditoria_y_cortes(self, maestro, dir_temp, ruta_origen, dir_final, progress_cb):
        from asammdf import MDF
        generados = []
        mapa_satelites = self.buscar_satelites(ruta_origen)
        try:
            if progress_cb:
                progress_cb(0.05)
            with MDF(maestro) as mdf:
                if "Distraction_type" not in mdf:
                    self._log(f"[{self._ts()}]       ⚠️ Skipped: Missing 'Distraction_type'. Likely a satellite.")
                    return []

                s_test = mdf.get("Distraction_test_number")
                timestamps = s_test.timestamps
                vals = s_test.samples
                s_type = mdf.get("Distraction_type")
                s_num = mdf.get("Distraction_number")
                s_ob = mdf.get("Oclusion_or_Bahaviour")

            if progress_cb:
                progress_cb(0.15)

            inicios = [i for i in range(1, len(vals)) if vals[i] > 0 and vals[i - 1] == 0]
            if len(vals) > 0 and vals[0] > 0:
                inicios.insert(0, 0)

            fines = [i for i in range(1, len(vals)) if vals[i] == 0 and vals[i - 1] > 0]
            if fines and fines[0] < inicios[0]:
                fines.pop(0)
            inicios = inicios[:len(fines)]

            to_cut = []
            for i, (ini, fin) in enumerate(zip(inicios, fines)):
                tipo = s_type.samples[ini]
                num = s_num.samples[ini]
                test = s_test.samples[ini]
                ob = s_ob.samples[ini]
                fname, folder = self.get_names(tipo, num, test, ob)
                if fname not in mapa_satelites:
                    continue
                path_temp = os.path.join(dir_temp, folder, fname)
                ruta_sat = mapa_satelites[fname]
                rel = os.path.relpath(ruta_sat, ruta_origen)
                path_final = os.path.join(dir_final, rel)

                needs_action = True
                if not self.overwrite_mode and os.path.exists(path_final):
                    size_final = os.path.getsize(path_final)
                    size_original = os.path.getsize(ruta_sat)
                    if size_final > size_original + 500:
                        needs_action = False

                if not needs_action:
                    continue

                if os.path.exists(path_temp) and os.path.getsize(path_temp) > 1024:
                    generados.append(path_temp)
                else:
                    to_cut.append({"t_start": timestamps[ini], "t_stop": timestamps[fin],
                                   "path": path_temp, "dir": os.path.join(dir_temp, folder), "name": fname})

            if not to_cut:
                return generados

            total_cuts = len(to_cut)
            self._log(f"[{self._ts()}]       ✂️ Found {total_cuts} segments to cut...")

            final_whitelist = None
            if self.signal_whitelist:
                found_signals = []
                missing_signals = []

                try:
                    with MDF(maestro) as mdf_audit:
                        available_exact = set()
                        available_by_name = {}

                        for g_idx, grp in enumerate(mdf_audit.groups):
                            for c_idx, ch in enumerate(grp.channels):
                                key = (ch.name, g_idx, c_idx)
                                available_exact.add(key)

                                if ch.name not in available_by_name:
                                    available_by_name[ch.name] = []
                                available_by_name[ch.name].append(key)

                        for req in self.signal_whitelist:
                            req_name, req_g, req_c = req
                            if req in available_exact:
                                found_signals.append(req)
                            elif req_name in available_by_name:
                                new_match = available_by_name[req_name][0]
                                found_signals.append(new_match)
                            else:
                                missing_signals.append(req_name)

                except Exception as e_audit:
                    self._log(f"[{self._ts()}]       ⚠️ Audit Error: {e_audit}")

                if missing_signals:
                    unique_missing = list(set(missing_signals))
                    msg = f"⚠️ {len(unique_missing)} signals completely MISSING in this master: {unique_missing[:5]}..."
                    self._log(f"[{self._ts()}]       {msg}")

                if not found_signals:
                    self._log(f"[{self._ts()}]       ⚠️ ALL selected signals missing! Fallback to KEEP ALL signals.")
                    final_whitelist = None
                else:
                    final_whitelist = list(set(found_signals))
                    self._log(f"[{self._ts()}]       ℹ️ Using {len(final_whitelist)}/{len(self.signal_whitelist)} signals (Adapted to file structure).")

            with MDF(maestro) as mdf:
                for idx, item in enumerate(to_cut):
                    self.wait_if_paused()
                    if not self.is_running:
                        return []

                    progreso_local = 0.2 + (0.8 * ((idx + 1) / total_cuts))
                    if progress_cb:
                        progress_cb(progreso_local)

                    os.makedirs(item["dir"], exist_ok=True)

                    final_mdf = None
                    try:
                        if final_whitelist:
                            final_mdf = MDF()
                            groups_map = {}
                            for name, g_idx, c_idx in final_whitelist:
                                if g_idx not in groups_map:
                                    groups_map[g_idx] = []
                                groups_map[g_idx].append((name, g_idx, c_idx))

                            for g_idx in sorted(groups_map.keys()):
                                channels_to_select = groups_map[g_idx]
                                try:
                                    temp_res = mdf.select(channels_to_select)
                                    if isinstance(temp_res, list):
                                        temp_mdf = MDF()
                                        temp_mdf.append(temp_res)
                                    else:
                                        temp_mdf = temp_res

                                    temp_cut = temp_mdf.cut(start=item["t_start"], stop=item["t_stop"], whence="absolute")

                                    signals_to_append = []
                                    for ii, grp in enumerate(temp_cut.groups):
                                        for ch_idx in range(len(grp.channels)):
                                            sig = temp_cut.get(group=ii, index=ch_idx)
                                            signals_to_append.append(sig)

                                    if signals_to_append:
                                        final_mdf.append(signals_to_append)

                                    del temp_res
                                    if 'temp_mdf' in locals():
                                        del temp_mdf
                                    del temp_cut
                                    del signals_to_append
                                    gc.collect()
                                except Exception as e_sel:
                                    self._log(f"[{self._ts()}]       ⚠️ Select Error: {e_sel}")
                        else:
                            final_mdf = mdf.cut(start=item["t_start"], stop=item["t_stop"], whence="absolute")

                        final_mdf.save(item["path"], overwrite=True)
                        generados.append(item["path"])
                    except Exception as e:
                        self._log(f"[{self._ts()}]       ⚠️ Cut Error {item['name']}: {e}")
                    finally:
                        if final_mdf:
                            del final_mdf
                        if idx % 5 == 0:
                            gc.collect()
            return generados
        except Exception as e:
            if self.on_error:
                self.on_error(f"Phase 1 Error: {e}")
            return []

    def fase_2_fusionar(self, cortes, ruta_origen, dir_final_base, progress_cb):
        from asammdf import MDF
        mapa_satelites = self.buscar_satelites(ruta_origen)
        total = len(cortes)
        count = 0
        for idx, ruta_corte in enumerate(cortes):
            self.wait_if_paused()
            if not self.is_running:
                break
            if progress_cb:
                progress_cb((idx + 1) / total)
            fname = os.path.basename(ruta_corte)
            if fname in mapa_satelites:
                ruta_sat = mapa_satelites[fname]
                rel = os.path.relpath(ruta_sat, ruta_origen)
                ruta_dest = os.path.join(dir_final_base, rel)
                os.makedirs(os.path.dirname(ruta_dest), exist_ok=True)
                try:
                    original_sat_path = ruta_sat
                    with MDF(ruta_sat) as mdf_s:
                        with MDF(ruta_corte) as mdf_c:
                            for i, grp in enumerate(mdf_c.groups):
                                sigs = []
                                for ch_idx, ch in enumerate(grp.channels):
                                    s = mdf_c.get(name=ch.name, group=i, index=ch_idx)
                                    if len(s.timestamps) > 0:
                                        s.timestamps -= s.timestamps[0]
                                    sigs.append(s)
                                if sigs:
                                    mdf_s.append(sigs)
                                del sigs
                            mdf_s.save(ruta_dest, overwrite=True)
                    clone_file_metadata(original_sat_path, ruta_dest)
                    count += 1
                except Exception as e:
                    self._log(f"[{self._ts()}]       ❌ Fusion Error: {e}")
            gc.collect()
        return count

    def fase_3_copiar_videos(self, ruta_origen, dir_final_base):
        self._log(f"[{self._ts()}]    🎥 Copying videos...")
        videos = self.buscar_videos(ruta_origen)
        count = 0
        for vid_path in videos:
            self.wait_if_paused()
            if not self.is_running:
                break
            rel = os.path.relpath(vid_path, ruta_origen)
            dest = os.path.join(dir_final_base, rel)

            if self.overwrite_mode or not os.path.exists(dest):
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                try:
                    shutil.copy2(vid_path, dest)
                    count += 1
                except Exception as e:
                    self._log(f"[{self._ts()}]       ❌ Video Error: {e}")
        if count > 0:
            self._log(f"[{self._ts()}]    🎥 {count} videos copied.")