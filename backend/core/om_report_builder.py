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

        video_primary = self.config.get('om_video_path')
        video_secondary = self.config.get('om_video_path_secondary')
        use_dual_om_frames = (
            isinstance(video_primary, str)
            and isinstance(video_secondary, str)
            and video_primary
            and video_secondary
            and video_primary != video_secondary
            and os.path.exists(video_primary)
            and os.path.exists(video_secondary)
        )

        if use_dual_om_frames:
            cam_width_dual = 0.28
            cam_height_dual = cam_width_dual * (self.A4_WIDTH / self.A4_HEIGHT)
            gap = 0.02
            total_dual_width = (2 * cam_width_dual) + gap
            left_cam_x = (1.0 - total_dual_width) / 2.0
            right_margin_x = left_cam_x + cam_width_dual + gap

            camera_ax_left = self.fig.add_axes(
                [left_cam_x, band_top - cam_height_dual, cam_width_dual, cam_height_dual]
            )
            self._draw_camera_frame(camera_ax_left, video_path_override=video_secondary)

            camera_ax_right = self.fig.add_axes(
                [right_margin_x, band_top - cam_height_dual, cam_width_dual, cam_height_dual]
            )
            self._draw_camera_frame(camera_ax_right, video_path_override=video_primary)

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

    def _draw_camera_frame(self, ax, video_path_override=None, frame_time_override=None):
        from PIL import Image

        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')
        self._draw_frame_with_header(ax, "Gaze Location/Behaviour", header_height_ratio=0.12)

        video_path = (
            video_path_override
            if isinstance(video_path_override, str)
            else self.config.get('om_video_path')
        )
        frame_time = (
            frame_time_override
            if isinstance(frame_time_override, (int, float))
            else self.config.get('om_video_time_s', 0.0)
        )

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
                img = Image.fromarray(frame)
                min_dim = min(img.width, img.height)
                left = (img.width - min_dim) / 2
                top = (img.height - min_dim) / 2
                right = (img.width + min_dim) / 2
                bottom = (img.height + min_dim) / 2
                img = img.crop((left, top, right, bottom))
                img = img.resize(
                    (600, 600),
                    Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS,
                )

                square_size = 0.85
                cx, cy = 0.5, 0.44
                extent = [
                    cx - square_size / 2, cx + square_size / 2,
                    cy - square_size / 2, cy + square_size / 2,
                ]

                ax.imshow(np.array(img), extent=extent, zorder=3)
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
        try:
            margin_x = float(self.MARGIN_X)
            table_bottom = 0.08
            table_height = 0.12

            frame_ax = self.fig.add_axes(
                [margin_x, table_bottom, float(self.CONTENT_WIDTH), table_height]
            )
            frame_ax.axis('off')
            self._draw_frame_with_header(frame_ax, "SUMMARY DATA TABLE", header_height_ratio=0.25)

            header_h_ratio = 0.25
            table_geo = [
                margin_x,
                table_bottom,
                float(self.CONTENT_WIDTH),
                float(table_height * (1.0 - header_h_ratio)),
            ]
            table_ax = self.fig.add_axes(table_geo)
            table_ax.axis('off')

            metrics = self.config.get('om_audio_metrics', {}) or {}
            variant = str(self.config.get('om_report_variant', '') or '').strip().lower()
            target_category = str(self.config.get('target_category', '') or '').strip().lower()
            is_out_of_position = (
                variant == 'out_of_position'
            ) or ('out of position' in target_category)

            def _fmt(v):
                return f"{float(v):.2f} s" if isinstance(v, (int, float)) else "--"

            movement_start = metrics.get(
                'movement_start',
                self.config.get('movement_start', self.config.get('tgaze')),
            )
            warning_start = metrics.get('warning_start')
            if warning_start is None:
                pass_sig = self.config.get('pass_signal_name')
                if pass_sig:
                    warning_start = (self.signal_times or {}).get(pass_sig)

            detection_delay = metrics.get('detection_delay')
            audio_duration = metrics.get('audio_duration')
            max_audio_gap = metrics.get('max_audio_gap')

            rows = [
                ["Movement Start", _fmt(movement_start), "", ""],
                ["Warning Start", _fmt(warning_start), "", ""],
                [
                    "Detection Delay",
                    _fmt(detection_delay),
                    "<= 30 s",
                    "PASS"
                    if isinstance(detection_delay, (int, float)) and detection_delay <= 30.0
                    else "FAIL",
                ],
            ]

            if is_out_of_position:
                rows.append(["Audio Duration", _fmt(audio_duration), "", ""])
            else:
                rows.append(
                    [
                        "Audio Duration",
                        _fmt(audio_duration),
                        ">= 90 s",
                        "PASS"
                        if isinstance(audio_duration, (int, float)) and audio_duration >= 90.0
                        else "FAIL",
                    ]
                )
                rows.append(
                    [
                        "Max Audio Gap",
                        _fmt(max_audio_gap),
                        "<= 3 s",
                        "PASS"
                        if isinstance(max_audio_gap, (int, float)) and max_audio_gap <= 3.0
                        else "FAIL",
                    ]
                )

            headers = ["Metric", "Value", "Limit", "Result"]
            col_widths = [0.34, 0.23, 0.22, 0.21]

            table = table_ax.table(
                cellText=rows,
                colLabels=headers,
                loc='center',
                cellLoc='center',
                colWidths=col_widths,
                bbox=[0.0, 0.0, 1.0, 1.0],
            )
            table.auto_set_font_size(False)
            table.set_fontsize(7)

            for (row, col), cell in table.get_celld().items():
                cell.set_edgecolor(self.COLORS['grid'])
                if row == 0:
                    cell.set_facecolor(self.COLORS['primary'])
                    cell.set_text_props(
                        fontweight='bold', color=self.COLORS['text_white']
                    )
                    continue

                cell.set_facecolor('white')
                if col == 3 and row >= 3:
                    txt = (cell.get_text().get_text() or '').upper()
                    if txt == 'PASS':
                        cell.set_facecolor('#C6E0B4')
                    elif txt == 'FAIL':
                        cell.set_facecolor('#F8CBAD')

        except Exception:
            raise

    # ------------------------------------------------------------------
    # Bottom legend specific to OM warning reports
    # ------------------------------------------------------------------

    def _add_om_bottom_legend(self):
        self._add_om_bottom_legend_impl()
