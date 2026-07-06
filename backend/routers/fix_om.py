import os

om_path = r"C:\Software\OSM\FusionStudio\backend\routers\om.py"

with open(om_path, "r", encoding="utf-8") as f:
    content = f.read()

# I will find the class _OMReportingWorker definition and the end of the class.
# The class ends when the indentation goes back to 0.
# Actually, since I know the structure, I can just use a regex or string replacement.

# Let's extract the class string
import re
match_worker = re.search(r"(class _OMReportingWorker.*?)(?=\n\n    worker = _OMReportingWorker\(\))", content, re.DOTALL)
if match_worker:
    worker_cls = match_worker.group(1)
    
    # Remove worker_cls from its current location
    content = content.replace(worker_cls, "")
    
    # Put worker_cls BEFORE @router.post("/generate")
    content = content.replace('@router.post("/generate")', worker_cls + '\n\n@router.post("/generate")')

    with open(om_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed om.py indentation")
else:
    print("Could not find worker class")
