import os
import re

base_path = r"C:\Software\OSM\FusionStudio\backend\core"
ga_path = os.path.join(base_path, "report_builder.py")
om_path = os.path.join(base_path, "om_report_builder.py")
backup_path = os.path.join(base_path, "om_report_builder_backup.py")

with open(ga_path, "r", encoding="utf-8") as f:
    ga_content = f.read()

with open(backup_path, "r", encoding="utf-8") as f:
    backup_content = f.read()

# Rename class
om_content = ga_content.replace("class MatplotlibReportBuilder", "class OMReportBuilder")

# Find all overridden methods in backup_content
# They start with `    def _method_name(self` and go until the next `    def ` or end of file
method_pattern = re.compile(r"(    def _[a-zA-Z0-9_]+\(self.*?\):.*?)(?=\n    def |\Z)", re.DOTALL)
backup_methods = method_pattern.findall(backup_content)

for method_code in backup_methods:
    # Extract method name
    match = re.search(r"    def (_[a-zA-Z0-9_]+)\(", method_code)
    if not match: continue
    method_name = match.group(1)
    
    # Now find this method in om_content and replace it
    om_method_pattern = re.compile(rf"(    def {method_name}\(self.*?\):.*?)(?=\n    def |\Z)", re.DOTALL)
    
    # Need to be careful with replace not to process escape characters
    if om_method_pattern.search(om_content):
        # We replace the matched section with the new method code
        om_content = om_method_pattern.sub(lambda m, mc=method_code: mc, om_content)
    else:
        pass

# Also replace MatplotlibReportBuilder references inside the file if any
om_content = om_content.replace("MatplotlibReportBuilder", "OMReportBuilder")

with open(om_path, "w", encoding="utf-8") as f:
    f.write(om_content)

print("Successfully merged OM overrides into standalone OMReportBuilder")
