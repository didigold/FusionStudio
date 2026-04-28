import pandas as pd
import xlwings as xw

template_path = r"C:\Software\OSM\FusionStudio\assets\templates\Driver_Engagement.xlsx"

try:
    # Let's just use openpyxl via pandas to read it without opening excel
    df = pd.read_excel(template_path, sheet_name="DISTRACTION", header=None, nrows=20)
    print("Top 10 rows, first 20 columns:")
    print(df.iloc[:10, :20])
except Exception as e:
    print(e)
