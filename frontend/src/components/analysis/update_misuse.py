file_path = r"C:\Software\OSM\FusionStudio\frontend\src\components\analysis\MisuseLogicTab.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add omApi import
if "import { omApi } from" not in content:
    content = content.replace('import { reportingApi } from "@/api/reportingApi";', 'import { reportingApi } from "@/api/reportingApi";\nimport { omApi } from "@/api/omApi";')

# Replace reportingApi.gazePreview with omApi.omPreview
content = content.replace("reportingApi.gazePreview", "omApi.omPreview")

# Replace reportingApi.gazeGenerate with omApi.omGenerate
content = content.replace("reportingApi.gazeGenerate", "omApi.omGenerate")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated MisuseLogicTab.tsx successfully")
