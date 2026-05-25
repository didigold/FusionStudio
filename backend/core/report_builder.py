"""
Matplotlib-based Report Builder for FusionStudio.
Generates professional A4 engineering reports with logos, graphs, tables.
"""
import os
from datetime import datetime
from backend.core.utils import resource_path
from backend.core.audio_analysis import find_first_valid_event

# Global flag for OpenCV availability
OPENCV_AVAILABLE = False
try:
    import cv2
    OPENCV_AVAILABLE = True
except Exception:
    pass

class MatplotlibReportBuilder:
    """
    Generates professional A4 technical reports using matplotlib.
    All elements are rendered at high quality for 300dpi export.
    """
    
    A4_WIDTH = 8.27
    A4_HEIGHT = 11.69
    
    # Margin settings
    MARGIN_X = 0.08
    CONTENT_WIDTH = 1.0 - (2 * MARGIN_X)
    
    COLORS = {
        'primary': '#003366',      # Dark blue
        'secondary': '#d93d04',    # Orange (Applus)
        'pass': '#099440',         # Green
        'fail': '#D32F2F',         # Red
        'text': '#000000',         # Black
        'text_white': '#FFFFFF',   # White
        'text_light': '#666666',
        'grid': '#CCCCCC',
        'border': '#B8D4E8',       # Light blue border
        'border_light': '#DDDDDD',
        'background': '#FFFFFF',
        'frame_header': '#D0E8F8', # Light blue for frame headers
    }
    
    def __init__(self, config: dict):
        self.config = config
        self.fig = None
        # Use pre-calculated signal_times from config if available
        self.signal_times = config.get('signal_times', {})
        self._ensure_all_signal_times()
        
        import matplotlib.pyplot as plt
        plt.rcParams['font.family'] = 'Calibri'
        plt.rcParams['font.sans-serif'] = ['Calibri', 'Arial', 'DejaVu Sans']
        
    def _ensure_all_signal_times(self):
        """Ensure signal_times is populated for all signals before any plotting begins."""
        import numpy as np
        signals = self.config.get('signals', {})
        for name, data in signals.items():
            if name not in self.signal_times or self.signal_times[name] is None:
                first_match_time = None
                if name == "SoundPressure":
                    try:
                        samples = data['samples']
                        timestamps = data['timestamps']
                        samples_numeric = [float(s) for s in samples]
                        
                        audio_params = self.config.get('audio_params', {})
                        min_f = audio_params.get('min_freq', 0)
                        max_f = audio_params.get('max_freq', 0)
                        threshold = audio_params.get('threshold', 0)
                        
                        if threshold > 0:
                            if min_f > 0 or max_f > 0:
                                try:
                                    timestamps_np = np.array(timestamps)
                                    samples_np = np.array(samples_numeric)
                                    dt = np.mean(np.diff(timestamps_np))
                                    fs = 1.0 / dt
                                    nyq = 0.5 * fs
                                    
                                    # Apply safety limits to normalized frequencies to avoid butterworth filter errors
                                    low = max(1e-6, float(min_f) / nyq)
                                    high = min(1.0 - 1e-6, float(max_f) / nyq)
                                    if low >= high:
                                        high = low + 0.1
                                        if high >= 1.0:
                                            low = 0.1
                                            high = 0.9
                                    
                                    from scipy.signal import butter, filtfilt
                                    b, a = butter(4, [low, high], btype='band')
                                    samples_numeric = list(filtfilt(b, a, samples_np))
                                except Exception:
                                    pass
                            
                            first_match_time = find_first_valid_event(
                                np.array(samples_numeric),
                                np.array(timestamps),
                                float(threshold),
                                ">="
                            )
                    except Exception:
                        pass
                else:
                    threshold = data.get('threshold')
                    operator = data.get('operator')
                    if threshold is not None and operator and operator != 'None':
                        samples = data['samples']
                        timestamps = data['timestamps']
                        
                        threshold_numeric = None
                        is_numeric_threshold = False
                        try:
                            threshold_numeric = float(threshold)
                            is_numeric_threshold = True
                        except (ValueError, TypeError):
                            pass
                        
                        try:
                            samples_numeric = [float(s) for s in samples]
                            is_numeric_signal = True
                        except:
                            is_numeric_signal = False
                        
                        # Use configurable mask from config if available
                        mask_start = self.config.get('mask', 6.0)
                        
                        if is_numeric_threshold and is_numeric_signal:
                            for t, val in zip(timestamps, samples_numeric):
                                if t < mask_start: continue
                                match = False
                                if operator == '>': match = val > threshold_numeric
                                elif operator == '<': match = val < threshold_numeric
                                elif operator == '>=': match = val >= threshold_numeric
                                elif operator == '<=': match = val <= threshold_numeric
                                elif operator == '==': match = abs(val - threshold_numeric) < 1e-6
                                elif operator == '!=': match = abs(val - threshold_numeric) >= 1e-6
                                if match:
                                    first_match_time = t
                                    break
                        else:
                            samples_str = [str(s) for s in samples]
                            threshold_str = str(threshold)
                            mask_start = self.config.get('mask', 6.0)
                            for t, val_str in zip(timestamps, samples_str):
                                if t < mask_start: continue
                                match = False
                                if operator == '==': match = val_str == threshold_str
                                elif operator == '!=': match = val_str != threshold_str
                                if match:
                                    first_match_time = t
                                    break
                
                self.signal_times[name] = first_match_time

    def generate(self, output_path: str, dpi: int = 300) -> str:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        
        self.fig = plt.figure(figsize=(self.A4_WIDTH, self.A4_HEIGHT), dpi=dpi)
        self.fig.patch.set_facecolor('white')
        
        self._add_header()
        self._add_title()
        
        self._add_top_band()
        self._add_plots()
        self._add_summary_table()
        self._add_om_bottom_legend()
        self._add_footer()
        
        self.fig.savefig(output_path, dpi=dpi, facecolor='white', 
                         edgecolor='none', bbox_inches='tight', pad_inches=0.2)
        plt.close(self.fig)
        return os.path.abspath(output_path)
    
    def _add_header(self):
        header_ax = self.fig.add_axes([self.MARGIN_X, 0.935, self.CONTENT_WIDTH, 0.05])
        header_ax.axis('off')
        
        company_logo_path = resource_path("assets/logos/APPLUS+IDIADA.png")
        if os.path.exists(company_logo_path):
            self._add_logo(header_ax, company_logo_path, (0.0, 0.5), max_size=(0.045, 0.22))
        
        # Use relative path if available, otherwise default protocol version
        banner_text = self.config.get('relative_path')
        if not banner_text:
            banner_text = "euro-ncap-protocol-safe-driving-driver-engagement-v11"
            
        header_ax.text(0.5, 0.5, banner_text, 
                      fontsize=9, color=self.COLORS['text_light'],
                      ha='center', va='center', transform=header_ax.transAxes)
        
        oem_name = self.config.get('oem_name', '')
        if oem_name:
            oem_logo_path = resource_path(f"assets/logos/{oem_name}.png")
            if os.path.exists(oem_logo_path):
                self._add_logo(header_ax, oem_logo_path, (1.0, 0.5), max_size=(0.035, 0.22))
        
        import matplotlib.pyplot as plt
        header_ax.axhline(y=0.0, xmin=0, xmax=1, color=self.COLORS['border_light'], linewidth=1)
    
    def _add_title(self):
        title_ax = self.fig.add_axes([self.MARGIN_X, 0.89, self.CONTENT_WIDTH, 0.035])
        title_ax.axis('off')
        
        protocol = self.config.get('protocol', 'Euro NCAP')
        if protocol == 'GSR ADDW' or protocol == '2023/2590' or 'GSR' in str(protocol):
            title = "GSR - ADDW EVALUATION REPORT"
        else:
            title = "EURO NCAP - DRIVER ENGAGEMENT DSM REPORT"
        
        title_ax.text(0.5, 0.5, title, fontsize=14, fontweight='bold',
                     color=self.COLORS['text'], ha='center', va='center',
                     transform=title_ax.transAxes)
    
    def _add_top_band(self):
        band_top = 0.88
        standard_gauge_height = 0.28 * (self.A4_WIDTH / self.A4_HEIGHT)
        gauge_width = 0.38
        gauge_draw_height = gauge_width * (self.A4_WIDTH / self.A4_HEIGHT)
        cam_width = 0.33
        cam_height = cam_width * (self.A4_WIDTH / self.A4_HEIGHT) 
        
        gauge_ax = self.fig.add_axes([self.MARGIN_X, band_top - gauge_draw_height, gauge_width, gauge_draw_height])
        self._draw_gauge(gauge_ax)

        right_margin_x = 1.0 - self.MARGIN_X - cam_width
        camera_ax = self.fig.add_axes([right_margin_x, band_top - cam_height, cam_width, cam_height])
        self._draw_camera_frame(camera_ax)
        self.band_height = max(standard_gauge_height, cam_height)
    
    def _draw_gauge(self, ax):
        import numpy as np
        import matplotlib.patches as patches
        import matplotlib.colors as mcolors
        import json

        category = self.config.get('target_category', '')
        try:
            all_rules = self.config.get('gauge_rules')
            if not isinstance(all_rules, dict):
                config_path = self.config.get('gauge_rules_path')
                if not config_path or not os.path.exists(config_path):
                    config_path = resource_path('config/gauge_rules.json')
                if os.path.exists(config_path):
                    with open(config_path, 'r', encoding='utf-8') as f:
                        all_rules = json.load(f)
                else:
                    all_rules = {}
        except Exception:
            all_rules = {}
            
        gauge_conf = all_rules.get("Other", {'min': 0, 'max': 5, 'ticks': [0, 1, 2, 3, 4, 5], 'green_range': (2, 4)})
        for key, conf in all_rules.items():
            if key != "Other" and key in category:
                gauge_conf = conf
                break

        t_event_value = self.config.get('t_event', 'No warn')
        val_for_needle = gauge_conf['min']
        if isinstance(t_event_value, (int, float)):
            val_for_needle = float(t_event_value)
            val_for_needle = max(gauge_conf['min'], min(gauge_conf['max'], val_for_needle))
        elif t_event_value == 'No warn':
            val_for_needle = gauge_conf['min']
            
        if isinstance(t_event_value, (int, float)):
            display_text = f"{t_event_value:.2f}s"
        else:
            display_text = f"{t_event_value}"

        ax.axis('off')
        ax.set_aspect('equal')
        vmin = gauge_conf['min']
        vmax = gauge_conf['max']
        green_min, green_max = gauge_conf['green_range']
        
        def val_to_angle(v):
            return 180.0 - (180.0 * (v - vmin) / (vmax - vmin))

        n_segments = 200
        vals = np.linspace(vmin, vmax, n_segments)
        R_OUT = 1.0
        R_IN = 0.85
        CX, CY = 0.5, 0.0
        
        for i in range(len(vals)-1):
            v1, v2 = vals[i], vals[i+1]
            a1, a2 = val_to_angle(v1), val_to_angle(v2)
            center_v = (v1+v2)/2
            if green_min <= center_v <= green_max:
                color = '#54C63E'
            else:
                dist = (green_min - center_v) / (green_min - vmin + 1e-6) if center_v < green_min else (center_v - green_max) / (vmax - green_max + 1e-6)
                if dist < 0.5:
                    ratio = dist * 2
                    color = mcolors.to_hex((1.0*ratio + 84/255*(1-ratio), 180/255*ratio + 198/255*(1-ratio), 62/255*(1-ratio)))
                else:
                    ratio = (dist - 0.5) * 2
                    color = mcolors.to_hex((220/255*ratio + 1.0*(1-ratio), 30/255*ratio + 180/255*(1-ratio), 30/255*ratio))
            
            end_angle = a1 + 0.6 if a1 < 179 else 180.0
            w = patches.Wedge(center=(CX, CY), r=R_OUT, theta1=a2, theta2=end_angle, width=R_OUT-R_IN, facecolor=color, edgecolor='none')
            ax.add_patch(w)

        for t in gauge_conf['ticks']:
            if t < vmin or t > vmax: continue
            a = val_to_angle(t)
            a_rad = np.radians(a)
            x1, y1 = CX + R_IN * np.cos(a_rad), CY + R_IN * np.sin(a_rad)
            x2, y2 = CX + (R_IN - 0.05) * np.cos(a_rad), CY + (R_IN - 0.05) * np.sin(a_rad)
            ax.plot([x1, x2], [y1, y2], color=self.COLORS['text'], linewidth=1.5, solid_capstyle='round')
            txt_x, txt_y = CX + (R_IN - 0.17) * np.cos(a_rad), CY + (R_IN - 0.17) * np.sin(a_rad)
            ax.text(txt_x, txt_y, str(t), fontsize=9, color=self.COLORS['text'], ha='center', va='center')

        a_needle = np.radians(val_to_angle(val_for_needle))
        needle_length = R_IN - 0.05
        needle_base_width = 0.05
        tip_x, tip_y = CX + needle_length * np.cos(a_needle), CY + needle_length * np.sin(a_needle)
        b1x, b1y = CX + needle_base_width * np.cos(a_needle + np.pi/2), CY + needle_base_width * np.sin(a_needle + np.pi/2)
        b2x, b2y = CX + needle_base_width * np.cos(a_needle - np.pi/2), CY + needle_base_width * np.sin(a_needle - np.pi/2)
        ax.add_patch(patches.Polygon([[b1x, b1y], [tip_x, tip_y], [b2x, b2y]], facecolor='#1E293B', edgecolor='none', zorder=10))
        ax.add_patch(patches.Circle((CX, CY), needle_base_width * 1.5, facecolor='#1E293B', edgecolor='#CBD5E1', linewidth=1.5, zorder=11))
        ax.text(CX, CY - 0.32, display_text, fontsize=19, fontweight='bold', color=self.COLORS['text'], ha='center', va='top')
        ax.set_xlim(CX - R_OUT - 0.05, CX + R_OUT + 0.05)
        ax.set_ylim(CY - 0.45, CY + R_OUT + 0.05)
    
    def _draw_camera_frame(self, ax, video_path_override=None, frame_time_override=None):
        import numpy as np
        from PIL import Image
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')
        self._draw_frame_with_header(ax, "Gaze Location/Behaviour", header_height_ratio=0.12)

        if self.config.get('om_use_video_frame'):
            video_path = video_path_override if isinstance(video_path_override, str) else self.config.get('om_video_path')
            frame_time = frame_time_override if isinstance(frame_time_override, (int, float)) else self.config.get('om_video_time_s', 0.0)
            span = self.config.get('om_audio_event_span')
            if isinstance(span, (list, tuple)) and len(span) == 2:
                try: frame_time = float(span[0])
                except Exception: pass
            else:
                metrics = self.config.get('om_audio_metrics', {}) or {}
                warn_start = metrics.get('warning_start')
                if isinstance(warn_start, (int, float)): frame_time = float(warn_start)
            try: frame_time = float(frame_time)
            except Exception: frame_time = 0.0

            frame = self._extract_frame_from_video(video_path, frame_time)
            if frame is not None:
                try:
                    img = Image.fromarray(frame)
                    min_dim = min(img.width, img.height)
                    left, top = (img.width - min_dim) / 2, (img.height - min_dim) / 2
                    img = img.crop((left, top, left + min_dim, top + min_dim))
                    img = img.resize((600, 600), Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS)
                    sq_sz, cx, cy = 0.85, 0.5, 0.44
                    extent = [cx - sq_sz/2, cx + sq_sz/2, cy - sq_sz/2, cy + sq_sz/2]
                    ax.imshow(np.array(img), extent=extent, zorder=3)
                    ax.text(extent[0] + 0.02, extent[3] - 0.02, f"T = {frame_time:.2f}s", fontsize=8, color=self.COLORS['text_white'], ha='left', va='top', bbox=dict(facecolor='black', alpha=0.5, edgecolor='none', pad=1.5))
                    return
                except Exception: pass
            ax.text(0.5, 0.45, "No Video Frame", fontsize=9, color=self.COLORS['text_light'], ha='center', va='center')
            return
        
        camera_path = self.config.get('camera_image_path')
        if not camera_path:
            filename = self.config.get('filename', '')
            import re
            basename = os.path.splitext(filename)[0].replace('_tracking', '')
            match_f = re.match(r'^F_?0?(\d+)', basename, re.IGNORECASE)
            if match_f:
                fid = int(match_f.group(1))
                img_name = "sleep.png" if fid in (1, 2) else ("drowsiness.png" if fid == 3 else "unresponsive.png" if fid in (4, 5) else None)
                if img_name:
                    guessed_path = resource_path(f'assets/ncap/{img_name}')
                    if os.path.exists(guessed_path): camera_path = guessed_path
            if not camera_path:
                match_d = re.match(r'^D_?(\d+)', basename, re.IGNORECASE)
                if match_d:
                    guessed_path = resource_path(f'assets/ncap/{match_d.group(1)}.png')
                    if os.path.exists(guessed_path): camera_path = guessed_path
                    
        if camera_path and os.path.exists(camera_path):
            try:
                img = Image.open(camera_path)
                min_dim = min(img.width, img.height)
                left, top = (img.width - min_dim) / 2, (img.height - min_dim) / 2
                img = img.crop((left, top, left + min_dim, top + min_dim))
                img = img.resize((600, 600), Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS)
                sq_sz, cx, cy = 0.85, 0.5, 0.44
                extent = [cx - sq_sz/2, cx + sq_sz/2, cy - sq_sz/2, cy + sq_sz/2]
                ax.imshow(np.array(img), extent=extent, zorder=3)
            
                filename = self.config.get('filename', '')
                import re
                match_o = re.search(r'O_?(\d+)', os.path.splitext(filename)[0].replace('_tracking', ''), re.IGNORECASE)
                if match_o:
                    oid = int(match_o.group(1))
                    o_img = {9: "facemask.png", 5: "sunglasses.png", 10: "cap.png", 4: "clear_glasses.png", 6: "eyelash.png"}.get(oid)
                    if o_img:
                        overlay_path = resource_path(f'assets/{o_img}')
                        if os.path.exists(overlay_path):
                            from matplotlib.offsetbox import OffsetImage, AnnotationBbox
                            overlay_img = Image.open(overlay_path)
                            ab = AnnotationBbox(OffsetImage(np.array(overlay_img), zoom=0.5), (extent[1] - 0.09, extent[2] + 0.09), frameon=True, bboxprops=dict(facecolor="white", edgecolor="black", boxstyle="round,pad=0.2", lw=1.5), pad=0.0)
                            ab.set_zorder(5)
                            ax.add_artist(ab)
            except Exception:
                ax.text(0.5, 0.45, "Error Loading Image", fontsize=9, color=self.COLORS['fail'], ha='center', va='center')
        else:
            ax.text(0.5, 0.45, "No Image", fontsize=9, color=self.COLORS['text_light'], ha='center', va='center')

    def _pixelate_faces(self, image_rgb, blocks=15):
        if not OPENCV_AVAILABLE or image_rgb is None: return image_rgb
        try:
            gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
            faces = []
            for cname in ['haarcascade_frontalface_default.xml', 'haarcascade_profileface.xml', 'haarcascade_frontalface_alt.xml']:
                cpath = os.path.join(cv2.data.haarcascades, cname)
                if not os.path.exists(cpath): continue
                clf = cv2.CascadeClassifier(cpath)
                dtc = clf.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
                for f in dtc: faces.append(f)
                if 'profile' in cname:
                    dtcf = clf.detectMultiScale(cv2.flip(gray, 1), scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
                    _, w = gray.shape
                    for (x, y, fw, fh) in dtcf: faces.append((w - x - fw, y, fw, fh))
            if not faces: return image_rgb
            out = image_rgb.copy()
            for (x, y, w, h) in faces:
                if w <= 0 or h <= 0: continue
                roi = out[y:y+h, x:x+w]
                hr, wr = roi.shape[:2]
                if hr <= blocks or wr <= blocks: continue
                pix = cv2.resize(cv2.resize(roi, (max(1, wr//blocks), max(1, hr//blocks)), interpolation=cv2.INTER_LINEAR), (wr, hr), interpolation=cv2.INTER_NEAREST)
                out[y:y+h, x:x+w] = pix
            return out
        except Exception: return image_rgb

    def _extract_frame_from_video(self, video_path, target_time_sec):
        if not OPENCV_AVAILABLE or not video_path or not os.path.exists(video_path): return None
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened(): return None
        fps, total = cap.get(cv2.CAP_PROP_FPS), int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if fps <= 0 or total <= 0: cap.release(); return None
        cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, min(int(float(target_time_sec) * fps), total - 1)))
        ok, fbgr = cap.read(); cap.release()
        if not ok or fbgr is None: return None
        return self._pixelate_faces(cv2.cvtColor(fbgr, cv2.COLOR_BGR2RGB))

    def _add_plots(self):
        try:
            signals = self.config.get('signals', {})
            names = list(signals.keys())
            total_plots = len(names) + 1
            band_btm = 0.88 - self.band_height
            p_top, p_btm = band_btm - 0.025, 0.23 
            p_h = p_top - p_btm
            fax = self.fig.add_axes([self.MARGIN_X, p_btm, self.CONTENT_WIDTH, p_h])
            fax.axis('off')
            self._draw_frame_with_header(fax, "SIGNAL(S) ANALYSIS", header_height_ratio=0.08)
            pad_x = 0.04
            avl_w, start_x = self.CONTENT_WIDTH - (2 * pad_x), self.MARGIN_X + pad_x
            all_p = names + ['__DRIVER_BEHAVIOUR__']
            if total_plots <= 2: nr, rcfg = 1, [2]
            elif total_plots == 3: nr, rcfg = 2, [2, 1]
            elif total_plots <= 4: nr, rcfg = 2, [2, 2]
            else: nr, rcfg = 2, [3, 3]
            rgap = 0.03
            rh = (p_h - (rgap * (nr - 1))) / nr
            pidx = 0
            for ridx, nc in enumerate(rcfg):
                pspc = 0.06
                rw = avl_w - (nc - 1) * pspc
                cw = rw / nc
                sx = start_x + (avl_w - (nc * cw + (nc-1)*pspc)) / 2 if nc < max(rcfg) else start_x
                for col in range(nc):
                    if pidx >= len(all_p): break
                    pname = all_p[pidx]
                    lt = sx + col * (cw + pspc)
                    off = 0.025 if ridx == 0 else 0
                    rt = p_top - ridx * (rh + rgap)
                    bt = rt - rh + (0.055 if nr == 1 else 0.03) - off
                    ax = self.fig.add_axes([lt, bt, cw, rh - (0.09 if nr == 1 else 0.06)])
                    if pname == '__DRIVER_BEHAVIOUR__': self._draw_driver_behaviour_plot(ax)
                    else: self._draw_signal_plot(ax, pname, signals[pname])
                    pidx += 1
        except Exception: raise
                
    def _draw_driver_behaviour_plot(self, ax):
        import matplotlib.pyplot as plt
        ax.set_facecolor('white')
        ax.set_title("Driver Behaviour", fontsize=8, fontweight='bold', color=self.COLORS['text'])
        marks = sorted([float(t) for t in (self.config.get('driver_marks', []) or []) if t is not None])
        if not marks:
            ax.text(0.5, 0.5, "Post-Processing Required", ha='center', va='center', fontsize=8, color=self.COLORS['text_light'], style='italic')
        else:
            max_t = None
            for d in self.config.get('signals', {}).values():
                ts = d.get('timestamps', [])
                if ts:
                    try: max_t = max(max_t or 0, float(max(ts)))
                    except Exception: pass
            if max_t is None: max_t = marks[-1] + 1.0
            xs, ys, st, lt = [0.0], [0], 0, 0.0
            for t in marks:
                xs.extend([t, t]); ys.extend([st, 1-st]); st = 1-st; lt = t
            xs.append(max_t); ys.append(st)
            ax.step(xs, ys, where='post', color=self.COLORS['primary'], linewidth=0.8)
            ax.set_ylim(-0.1, 1.1)
            ax.set_yticks([0, 1])
            ax.set_yticklabels(['Troad', 'Taway'], fontsize=6, color=self.COLORS['text_light'])
            psig = self.config.get('pass_signal_name')
            if psig:
                pt = self.signal_times.get(psig)
                if pt is not None: ax.axvline(x=pt, color=self._get_signal_color(psig), linestyle='-', linewidth=0.8, alpha=0.9)
        ax.set_xlabel("Time (s)", fontsize=6, color=self.COLORS['text_light'])
        ax.grid(True, linestyle='--', color=self.COLORS['grid'], alpha=0.5, linewidth=0.5)
        ax.tick_params(labelsize=6, colors=self.COLORS['text_light'])
        for s in ['top', 'right']: ax.spines[s].set_visible(False)
        for s in ['bottom', 'left']: ax.spines[s].set_color(self.COLORS['border_light'])
    
    def _draw_signal_plot(self, ax, name: str, data: dict):
        import numpy as np
        from scipy import signal
        ts, smp = data.get('timestamps', []), data.get('samples', [])
        thr, op, unt = data.get('threshold'), data.get('operator', 'None'), data.get('unit', 'Value')
        dn = data.get('alias') or name
        if isinstance(thr, bytes): thr = thr.decode('utf-8')
        elif thr and isinstance(thr, str):
            if thr.startswith("b'") and thr.endswith("'"): thr = thr[2:-1]
        tn, is_nt = None, False
        if thr:
            try: tn, is_nt = float(thr), True
            except (ValueError, TypeError): is_nt = False
        ax.set_facecolor('white')
        ax.set_title(dn, fontsize=8, fontweight='bold', color=self.COLORS['text'])
        if not ts or not smp:
            ax.text(0.5, 0.5, "No Data", ha='center', va='center'); ax.axis('off'); return
        vmap = None
        try: sn, tsn, is_ns = np.array(smp, dtype=float), np.array(ts, dtype=float), True
        except:
            uv = list(set(smp)); vmap = {v: i for i, v in enumerate(uv)}
            sn, tsn, is_ns = np.array([vmap[v] for v in smp]), np.array(ts), False
        if name == "SoundPressure":
             ap = self.config.get('audio_params', {})
             minf, maxf, th = ap.get('min_freq', 0), ap.get('max_freq', 0), ap.get('threshold', 0)
             suf = ""
             if minf > 0 or maxf > 0:
                 try:
                    nyq = 0.5 / np.mean(np.diff(tsn))
                    lo = max(1e-6, minf / nyq)
                    hi = min(1.0 - 1e-6, maxf / nyq)
                    if lo >= hi:
                        hi = lo + 0.1
                        if hi >= 1.0:
                            lo = 0.1
                            hi = 0.9
                    b, a = signal.butter(4, [lo, hi], btype='band')
                    sn = signal.filtfilt(b, a, sn); suf = f" ({minf}-{maxf} Hz)"
                 except Exception: pass
             ax.set_title(dn + suf, fontsize=8, fontweight='bold', color=self.COLORS['text'])
             if th > 0: ax.axhline(y=th, color=self.COLORS['fail'], linestyle='-', linewidth=0.6)
        ax.plot(tsn, sn, color=self.COLORS['primary'], linewidth=0.8)
        if self.config.get('om_plot_show_marks'):
            marks = sorted([float(t) for t in (self.config.get('driver_marks', []) or []) if isinstance(t, (int, float))])
            if self.config.get('om_plot_show_shading'):
                for i in range(0, len(marks) - 1, 2):
                    if marks[i+1] > marks[i]: ax.axvspan(marks[i], marks[i+1], color=self.COLORS['primary'], alpha=0.08)
            for mt in marks: ax.axvline(x=mt, color=self.COLORS['text_light'], linestyle='--', linewidth=0.6, alpha=0.65)
        if self.config.get('om_plot_show_shading'):
            mstart = self.config.get('movement_start', self.config.get('tgaze'))
            try: mstart = float(mstart) if mstart is not None else None
            except Exception: mstart = None
            if mstart is not None: ax.axvline(x=mstart, color='black', linestyle='--', linewidth=0.8, alpha=0.7)
            psig, pt = self.config.get('pass_signal_name'), self.signal_times.get(self.config.get('pass_signal_name'))
            if psig == name and mstart is not None and isinstance(pt, (int, float)) and pt > mstart: ax.axvspan(mstart, pt, color='#FFB74D', alpha=0.18)
            if name == "SoundPressure":
                spn = self.config.get('om_audio_event_span')
                if isinstance(spn, (list, tuple)) and len(spn) == 2:
                    try:
                        s0, s1 = float(spn[0]), float(spn[1])
                        if s1 > s0: ax.axvspan(s0, s1, color=self.COLORS['primary'], alpha=0.12)
                    except Exception: pass
        fmt = self.signal_times.get(name)
        if fmt is not None and not self._is_first_match_line_hidden(name):
            ax.axvline(x=fmt, color=self._get_first_match_line_color(name), linestyle='-', linewidth=0.8)
        for _x, _c, _ls, _lw, _a in self._get_extra_axvlines(name): ax.axvline(x=_x, color=_c, linestyle=_ls, linewidth=_lw, alpha=_a)
        psig = self.config.get('pass_signal_name')
        if psig and psig != name:
            pt = self.signal_times.get(psig)
            if pt is not None: ax.axvline(x=pt, color=self._get_signal_color(psig), linestyle='-', linewidth=0.8, alpha=0.9)
        ax.set_xlabel("Time (s)", fontsize=6, color=self.COLORS['text_light'])
        ax.set_ylabel(unt, fontsize=6, color=self.COLORS['text_light'])
        if not is_ns and vmap:
            lbls = [(v.decode('utf-8') if isinstance(v, bytes) else str(v)) for v in vmap.keys()]
            ax.set_yticks(list(vmap.values())); ax.set_yticklabels(lbls, fontsize=5, rotation=90, ha='center', va='center')
        ax.tick_params(axis='both', labelsize=6, colors=self.COLORS['text_light'])
        ax.grid(True, linestyle='--', color=self.COLORS['grid'], alpha=0.5, linewidth=0.5)
        for s in ['top', 'right']: ax.spines[s].set_visible(False)
        ax.spines['bottom'].set_color(self.COLORS['border_light'])
        ax.spines['left'].set_color(self.COLORS['border_light'])

    def _is_first_match_line_hidden(self, name: str) -> bool: return False
    def _get_first_match_line_color(self, name: str) -> str: return self._get_signal_color(name)
    def _get_sound_pressure_fallback_time(self): return None
    def _get_extra_axvlines(self, name: str) -> list: return []
    def _add_om_bottom_legend(self): return
    def _add_om_bottom_legend_impl(self):
        import matplotlib.pyplot as plt
        from matplotlib.lines import Line2D
        ms = self.config.get('movement_start', self.config.get('tgaze'))
        try: ms = float(ms) if ms is not None else None
        except Exception: ms = None
        ws = None
        spn = self.config.get('om_audio_event_span')
        if isinstance(spn, (list, tuple)) and len(spn) >= 1:
            try: ws = float(spn[0])
            except Exception: pass
        if ws is None:
            m = self.config.get('om_audio_metrics') or {}
            if isinstance(m, dict):
                w = m.get('warning_start')
                if isinstance(w, (int, float)): ws = float(w)
        items = []
        if ms is not None: items.append((Line2D([0], [0], color='black', linestyle='--', linewidth=0.9), 'Movement Start'))
        if ws is not None: items.append((Line2D([0], [0], color=self.COLORS['fail'], linestyle='-', linewidth=0.9), 'Audible Warning Activation'))
        if not items: return
        lax = self.fig.add_axes([self.MARGIN_X, 0.062, self.CONTENT_WIDTH, 0.015]); lax.axis('off')
        lax.legend(handles=[h for h, _ in items], labels=[l for _, l in items], loc='center', ncol=max(1, len(items)), frameon=False, fontsize=6, handlelength=2.8, columnspacing=1.2)
        
    def _get_signal_color(self, name: str) -> str:
        if name == "SoundPressure": return self.COLORS.get('secondary', '#d93d04')
        pal = ['#099440', '#8E24AA', '#E91E63', '#00897B', '#FF6F00', '#1565C0', '#C62828', '#6A1B9A']
        names = list(self.config.get('signals', {}).keys())
        idx = names.index(name) % len(pal) if name in names else sum(ord(c) for c in name) % len(pal)
        return pal[idx]

    def _add_summary_table(self):
        try:
            import textwrap
            import matplotlib.pyplot as plt
            mx, tb, th = float(self.MARGIN_X), 0.08, 0.12
            fax = self.fig.add_axes([mx, tb, float(self.CONTENT_WIDTH), th]); fax.axis('off')
            self._draw_frame_with_header(fax, "SUMMARY DATA TABLE", header_height_ratio=0.25)
            hhr, cw = 0.25, 1.0 - 0.25
            tax = self.fig.add_axes([mx, tb, float(self.CONTENT_WIDTH), float(th * cw)]); tax.axis('off')
            sigs = self.config.get('signals', {})
            snames = list(sigs.keys())
            msl, ms = self.config.get('movement_start_label', 'T_gaze'), self.config.get('movement_start', self.config.get('tgaze'))
            tgs = f"{ms:.2f}" if ms is not None else "--"
            tev = self.config.get('t_event', 'No warn')
            res = "PASS" if self.config.get('t_event_color') == "green" else "FAIL"
            tes = f"{tev:.2f}" if isinstance(tev, (int, float)) else str(tev)
            if not snames:
                hdrs = ['Metrics', msl, 'T_event']
                data = [['Time [s]', tgs, tes], ['Status', '--', res]]
                cols = [1.0/3]*3
            else:
                ah = [sigs[n].get('alias') or n for n in snames]
                hdrs = ['Metrics', msl] + ah + ['T_event']
                ww = max(6, int(24 - len(hdrs)))
                hdrs = [textwrap.fill(h, width=ww) if isinstance(h, str) else h for h in hdrs]
                tc, sc = [], []
                for n in snames:
                    v = self.signal_times.get(n)
                    if v is not None: tc.append(f"{v:.2f}"); sc.append(res)
                    else: tc.append("--"); sc.append("--")
                data = [['Time [s]', tgs] + tc + [tes], ['Status', '--'] + sc + [res]]
                cols = [1.0/len(hdrs)]*len(hdrs)
            tbl = tax.table(cellText=data, colLabels=hdrs, loc='center', cellLoc='center', colWidths=cols, bbox=[0.0, 0.0, 1.0, 1.0])
            tbl.auto_set_font_size(False); tbl.set_fontsize(7)
            for (r, c), cell in tbl.get_celld().items():
                cell.set_edgecolor(self.COLORS['grid'])
                if r == 0: cell.set_facecolor(self.COLORS['primary']); cell.set_text_props(fontweight='bold', color=self.COLORS['text_white'])
                else:
                    cell.set_facecolor('white')
                    if r == 1 and 1 < c < len(hdrs)-1:
                        sname = snames[c-2]
                        cell.set_text_props(color=self._get_signal_color(sname), fontweight='bold')
        except Exception: raise

    def _add_footer(self):
        fax = self.fig.add_axes([self.MARGIN_X, 0.02, self.CONTENT_WIDTH, 0.04]); fax.axis('off')
        fax.axhline(y=0.9, xmin=0, xmax=1, color=self.COLORS['border_light'], linewidth=1)
        test_date = self.config.get('test_date', datetime.now())
        lt = f"Date: {test_date.strftime('%d-%b-%Y')}"
        if self.config.get('filename'): lt += f" | File: {self.config.get('filename')}"
        if self.config.get('vehicle'): lt += f" | Vehicle: {self.config.get('vehicle')}"
        fax.text(0.0, 0.4, lt, fontsize=6, color=self.COLORS['text_light'], ha='left', va='center')
        rt = f"Analyst: {self.config.get('analyst', '')} | Engineer: {self.config.get('engineer', '')}"
        if self.config.get('track'): rt += f" | Track: {self.config.get('track', '')}"
        fax.text(1.0, 0.4, rt, fontsize=6, color=self.COLORS['text_light'], ha='right', va='center')

    def _draw_frame_with_header(self, ax, title, header_height_ratio=0.15):
        import matplotlib.patches as patches
        f = patches.FancyBboxPatch((0.0, 0.0), 1.0, 1.0, boxstyle="round,pad=0.0,rounding_size=0.03", facecolor='white', edgecolor=self.COLORS['border'], linewidth=1.5, clip_on=False)
        ax.add_patch(f)
        hr = patches.Rectangle((0.0, 1.0 - header_height_ratio), 1.0, header_height_ratio, facecolor=self.COLORS['frame_header'], edgecolor='none')
        hr.set_clip_path(f); ax.add_patch(hr)
        b = patches.FancyBboxPatch((0.0, 0.0), 1.0, 1.0, boxstyle="round,pad=0.0,rounding_size=0.03", facecolor='none', edgecolor=self.COLORS['border'], linewidth=1.5, clip_on=False, zorder=5)
        ax.add_patch(b)
        ax.text(0.5, 1.0 - header_height_ratio/2, title, fontsize=8, fontweight='bold', color=self.COLORS['primary'], ha='center', va='center', zorder=6)

    def _add_logo(self, ax, image_path: str, position: tuple, max_size: tuple = (1.0, 1.0)):
        from PIL import Image
        import numpy as np
        from matplotlib.offsetbox import OffsetImage, AnnotationBbox
        try:
            img = Image.open(image_path)
            if img.mode != 'RGBA': img = img.convert('RGBA')
            if max(img.width, img.height) > 1000:
                sf = 1000 / max(img.width, img.height)
                img = img.resize((int(img.width * sf), int(img.height * sf)), Image.LANCZOS)
            bbox = ax.get_window_extent().transformed(self.fig.dpi_scale_trans.inverted())
            apx, hpx = bbox.width * self.fig.dpi, bbox.height * self.fig.dpi
            tw, th = apx * max_size[0], hpx * max_size[1]
            iw, ih = img.size
            if iw > 0 and ih > 0:
                z = min(tw/iw, th/ih)
                if z < 0.001: z = 0.05
            else: z = 0.1
            ib = OffsetImage(np.array(img), zoom=z); ib.image.axes = ax
            ax.add_artist(AnnotationBbox(ib, position, frameon=False, xycoords='axes fraction', box_alignment=(0.5 if position[0] == 0.5 else position[0], 0.5)))
        except Exception: pass
