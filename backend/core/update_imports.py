import os

base_path = r"C:\Software\OSM\FusionStudio\backend"

# 1. Update ga_report_builder.py
ga_path = os.path.join(base_path, "core", "ga_report_builder.py")
with open(ga_path, "r", encoding="utf-8") as f:
    ga_content = f.read()
ga_content = ga_content.replace("class MatplotlibReportBuilder", "class GAReportBuilder")
with open(ga_path, "w", encoding="utf-8") as f:
    f.write(ga_content)

# 2. Update om_report_builder.py
om_path = os.path.join(base_path, "core", "om_report_builder.py")
with open(om_path, "r", encoding="utf-8") as f:
    om_content = f.read()
om_content = om_content.replace("from backend.core.report_builder import _get_rounded_rect_path", "from backend.core.ga_report_builder import _get_rounded_rect_path")
om_content = om_content.replace("from backend.core.report_builder import _get_bottom_rounded_rect_path", "from backend.core.ga_report_builder import _get_bottom_rounded_rect_path")
om_content = om_content.replace("backend.core.report_builder", "backend.core.ga_report_builder")
with open(om_path, "w", encoding="utf-8") as f:
    f.write(om_content)

print("Renames completed in core.")
