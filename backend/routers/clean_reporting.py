import os

base_path = r"C:\Software\OSM\FusionStudio\backend\routers"
reporting_path = os.path.join(base_path, "reporting.py")

with open(reporting_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace MatplotlibReportBuilder with GAReportBuilder
content = content.replace("from backend.core.report_builder import MatplotlibReportBuilder", "from backend.core.ga_report_builder import GAReportBuilder")
content = content.replace("builder = MatplotlibReportBuilder(config)", "builder = GAReportBuilder(config)")

# Remove OMReportBuilder logic from _GazeReportingWorker
om_builder_block = """                        if config.get("target_category", "").startswith("OoP") or config.get("target_category", "").startswith("CSR"):
                            builder = OMReportBuilder(config)
                        else:
                            builder = MatplotlibReportBuilder(config)"""
content = content.replace(om_builder_block, '                        builder = GAReportBuilder(config)')

content = content.replace("from backend.core.om_report_builder import OMReportBuilder\n", "")

with open(reporting_path, "w", encoding="utf-8") as f:
    f.write(content)

print("reporting.py cleaned for GA")
