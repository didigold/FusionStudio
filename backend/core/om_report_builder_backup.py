"""
OM (Occupant Monitoring) Report Builder for FusionStudio.
Extends MatplotlibReportBuilder with all OM-specific rendering logic.
"""
import os
import numpy as np

from backend.core.report_builder import MatplotlibReportBuilder


class OMReportBuilder(MatplotlibReportBuilder):
    """
    Generates A4 OM reports (Correct Belt Routing / Out of Position variants).
    Overrides layout, camera frames, signal plots and summary table for OM specifics.
    """

    # ------------------------------------------------------------------
    # Title
    # ------------------------------------------------------------------

    def _add_title(self):
        title_ax = self.fig.add_axes([self.MARGIN_X, 0.89, self.CONTENT_WIDTH, 0.035])
        title_ax.axis('off')
        title_ax.text(
            0.5, 0.5,
            "EURO NCAP - OCCUPANT MONITORING REPORT",
            fontsize=14, fontweight='bold',
            color=self.COLORS['text'],
            ha='center', va='center',
            transform=title_ax.transAxes,
        )

    # ------------------------------------------------------------------
    # Top band: no gauge, support dual camera frames
    # ------------------------------------------------------------------

    def _add_top_band(self):
        band_top = 0.88

        # Keep a reference height for layout calculations below (same as base class)
        standard_gauge_height = 0.28 * (self.A4_WIDTH / self.A4_HEIGHT)

        cam_width = 0.33
        cam_height = cam_width * (self.A4_WIDTH / self.A4_HEIGHT)

        # For misuse (OoP/CSR), always use dual frames
        video_left = self.config.get('om_video_left')
        video_right = self.config.get('om_video_right')
        
        # Get frame times
        tgaze = self.config.get('tgaze', 0.0)
        signal_times = self.config.get('signal_times', {})
        detection_time = signal_times.get('phase_0')  # First phase is detection
        
        use_dual_om_frames = (
            isinstance(video_left, str)
            and isinstance(video_right, str)
            and video_left
            and video_right
            and os.path.exists(video_left)
            and os.path.exists(video_right)
        )

        if use_dual_om_frames:
            # Keep same height as before
            cam_height_dual = 0.28 * (self.A4_WIDTH / self.A4_HEIGHT)
            # Use width = 0.41 to occupy most of the page (0.41 * 2 = 0.82, leaving 0.08 for margins and 0.02 for gap)
            cam_width_dual = 0.41
            
            left_cam_x = self.MARGIN_X
            right_margin_x = 1.0 - self.MARGIN_X - cam_width_dual

            # Left frame: "Misuse" at tgaze time
            camera_ax_left = self.fig.add_axes(
                [left_cam_x, band_top - cam_height_dual, cam_width_dual, cam_height_dual]
            )
            self._draw_camera_frame(camera_ax_left, video_path_override=video_left, frame_time_override=tgaze, title="Misuse")

            # Right frame: "Detection" at detection time
            camera_ax_right = self.fig.add_axes(
                [right_margin_x, band_top - cam_height_dual, cam_width_dual, cam_height_dual]
            )
            self._draw_camera_frame(camera_ax_right, video_path_override=video_right, frame_time_override=detection_time, title="Detection")

            cam_height = cam_height_dual
        else:
            right_margin_x = 1.0 - self.MARGIN_X - cam_width
            camera_ax = self.fig.add_axes(
                [right_margin_x, band_top - cam_height, cam_width, cam_height]
            )
            self._draw_camera_frame(camera_ax)

        self.band_height = max(standard_gauge_height, cam_height)

    # ------------------------------------------------------------------
    # Camera frame: always extract from video for OM
    # ------------------------------------------------------------------

    def _draw_camera_frame(self, ax, video_path_override=None, frame_time_override=None, title="Gaze Location/Behaviour"):
        from PIL import Image

        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')
        self._draw_frame_with_header(ax, title, header_height_ratio=0.12)

        video_path = (
            video_path_override
            if isinstance(video_path_override, str)
            else self.config.get('om_video_left') or self.config.get('om_video_path')
        )
        
        # Use frame_time_override if provided, otherwise fall back to config values
        if isinstance(frame_time_override, (int, float)):
            frame_time = float(frame_time_override)
        else:
            frame_time = self.config.get('om_video_time_s', 0.0)
            
            # Prefer audio span start as frame timestamp
            span = self.config.get('om_audio_event_span')
            if isinstance(span, (list, tuple)) and len(span) == 2:
                try:
                    frame_time = float(span[0])
                except Exception:
                    pass
            else:
                metrics = self.config.get('om_audio_metrics', {}) or {}
                warn_start = metrics.get('warning_start')
                if isinstance(warn_start, (int, float)):
                    frame_time = float(warn_start)

        try:
            frame_time = float(frame_time)
        except Exception:
            frame_time = 0.0

        frame = self._extract_frame_from_video(video_path, frame_time)
        if frame is not None:
            try:
                import matplotlib.patches as patches
                from backend.core.report_builder import _get_rounded_rect_path
                
                img = Image.fromarray(frame)
                
                # Target physical aspect ratio of the image area (which is the bottom 88% of the frame)
                pos = ax.get_position()
                W_in = pos.width * self.A4_WIDTH
                H_in = pos.height * self.A4_HEIGHT * 0.88
                target_aspect = W_in / H_in
                
                current_aspect = img.width / img.height
                if current_aspect > target_aspect:
                    new_width = int(img.height * target_aspect)
                    left = (img.width - new_width) / 2
                    img = img.crop((left, 0, left + new_width, img.height))
                else:
                    new_height = int(img.width / target_aspect)
                    top = (img.height - new_height) / 2
                    img = img.crop((0, top, img.width, top + new_height))
                
                img = img.resize(
                    (800, int(800 / target_aspect)),
                    Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS,
                )

                extent = [0.0, 1.0, 0.0, 0.88]
                
                # Corner radii
                rx_img = min(0.2, 0.08 / W_in)
                ry_img = min(0.2, 0.08 / H_in)
                from backend.core.report_builder import _get_bottom_rounded_rect_path
                img_path = _get_bottom_rounded_rect_path(0.0, 0.0, 1.0, 0.88, rx_img, ry_img)
                clip_patch = patches.PathPatch(img_path, facecolor='none', edgecolor='none', transform=ax.transAxes)
                ax.add_patch(clip_patch)

                im = ax.imshow(np.array(img), extent=extent, aspect='auto', zorder=3)
                im.set_clip_path(clip_patch)
                
                ax.text(
                    extent[0] + 0.02,
                    extent[3] - 0.02,
                    f"T = {frame_time:.2f}s",
                    fontsize=8,
                    color=self.COLORS['text_white'],
                    ha='left',
                    va='top',
                    bbox=dict(facecolor='black', alpha=0.5, edgecolor='none', pad=1.5),
                )
                return
            except Exception as e:
                print(f"Error drawing OM video frame: {e}")

        ax.text(
            0.5, 0.45,
            "No Video Frame",
            fontsize=9,
            color=self.COLORS['text_light'],
            ha='center',
            va='center',
        )

    # ------------------------------------------------------------------
    # Plots: no Driver Behaviour row for OM
    # ------------------------------------------------------------------

    def _add_plots(self):
        try:
            signals = self.config.get('signals', {})
            signal_names = list(signals.keys())
            total_plots = len(signal_names)  # no Driver Behaviour column

            band_bottom = 0.88 - self.band_height
            plot_top_frame = band_bottom - 0.025
            plot_bottom_frame = 0.23
            total_height_frame = plot_top_frame - plot_bottom_frame

            frame_ax = self.fig.add_axes(
                [self.MARGIN_X, plot_bottom_frame, self.CONTENT_WIDTH, total_height_frame]
            )
            frame_ax.axis('off')
            self._draw_frame_with_header(frame_ax, "SIGNAL(S) ANALYSIS", header_height_ratio=0.08)

            internal_padding_x = 0.04
            available_plot_width = self.CONTENT_WIDTH - (2 * internal_padding_x)
            plot_start_x = self.MARGIN_X + internal_padding_x

            if total_plots <= 2:
                n_rows = 1
                rows_config = [2]
            elif total_plots == 3:
                n_rows = 2
                rows_config = [2, 1]
            elif total_plots <= 4:
                n_rows = 2
                rows_config = [2, 2]
            else:
                n_rows = 2
                rows_config = [3, 3]

            row_gap = 0.03
            available_height = total_height_frame - (row_gap * (n_rows - 1))
            row_height = available_height / n_rows

            plot_idx = 0
            for row_idx, n_cols in enumerate(rows_config):
                plot_spacing = 0.06
                row_width = available_plot_width - (n_cols - 1) * plot_spacing
                col_width = row_width / n_cols

                if n_cols < max(rows_config):
                    start_x = plot_start_x + (
                        available_plot_width - (n_cols * col_width + (n_cols - 1) * plot_spacing)
                    ) / 2
                else:
                    start_x = plot_start_x

                for col in range(n_cols):
                    if plot_idx >= len(signal_names):
                        break
                    plot_name = signal_names[plot_idx]

                    left = start_x + col * (col_width + plot_spacing)
                    extra_top_offset = 0.025 if row_idx == 0 else 0
                    row_top = plot_top_frame - row_idx * (row_height + row_gap)
                    bottom = row_top - row_height + (0.055 if n_rows == 1 else 0.03) - extra_top_offset
                    width = col_width
                    height = row_height - (0.09 if n_rows == 1 else 0.06)

                    ax = self.fig.add_axes([left, bottom, width, height])
                    self._draw_signal_plot(ax, plot_name, signals[plot_name])
                    plot_idx += 1

        except Exception:
            raise

    # ------------------------------------------------------------------
    # Extension hooks: OM-specific first-match line behaviour
    # ------------------------------------------------------------------

    def _is_first_match_line_hidden(self, name: str) -> bool:
        """Hide the first-match line for the CBR detection helper signal."""
        cbr_detection_signal = self.config.get('cbr_detection_signal')
        return (
            isinstance(cbr_detection_signal, str)
            and cbr_detection_signal
            and name == cbr_detection_signal
        )

    def _get_first_match_line_color(self, name: str) -> str:
        """SoundPressure uses the fail (red) colour in OM reports."""
        if name == "SoundPressure":
            return self.COLORS['fail']
        return self._get_signal_color(name)

    def _get_sound_pressure_fallback_time(self):
        """Use om_audio_event_span as fallback first_match_time for SoundPressure."""
        span = self.config.get('om_audio_event_span')
        if isinstance(span, (list, tuple)) and len(span) == 2:
            try:
                return float(span[0])
            except Exception:
                pass
        return None

    def _get_extra_axvlines(self, name: str) -> list:
        """Add the OM warning-time red vertical line to every signal plot."""
        om_warning_time = self._get_om_warning_time()
        if om_warning_time is not None:
            return [(om_warning_time, self.COLORS['fail'], '-', 0.8, 0.95)]
        return []

    def _get_om_warning_time(self):
        span = self.config.get('om_audio_event_span')
        if isinstance(span, (list, tuple)) and len(span) >= 1:
            try:
                return float(span[0])
            except Exception:
                pass
        metrics = self.config.get('om_audio_metrics') or {}
        if isinstance(metrics, dict):
            ws = metrics.get('warning_start')
            if isinstance(ws, (int, float)):
                return float(ws)
        return None

    # ------------------------------------------------------------------
    # Summary table: OM metrics layout
    # ------------------------------------------------------------------

    def _add_summary_table(self):
        self._add_unresponsive_timeline()

    # ------------------------------------------------------------------
    # Bottom legend specific to OM warning reports
    # ------------------------------------------------------------------

    def _add_om_bottom_legend(self):
        self._add_om_bottom_legend_impl()
