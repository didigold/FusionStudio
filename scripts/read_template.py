import pandas as pd
import xlwings as xw

template_path = r"C:\Software\OSM\FusionStudio\assets\templates\Driver_Engagement.xlsx"

try:
    df_dist = pd.read_excel(template_path, sheet_name="DISTRACTION", header=None, nrows=10)
    print("DISTRACTION Top 10:")
    print(df_dist.iloc[:, :7])

    df_fat = pd.read_excel(template_path, sheet_name="FATIGUE", header=None, nrows=10)
    print("\nFATIGUE Top 10:")
    print(df_fat.iloc[:, :7])
except Exception as e:
    print(e)
