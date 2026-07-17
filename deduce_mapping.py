import os
from collections import defaultdict
import glob

# Data from master
master_data = {
    'E01 - 3_7_2026 - 10_21_06 (1).MF4': {(11, 6, 2), (11, 4, 1), (11, 5, 1), (11, 3, 2), (11, 6, 1), (11, 3, 1)}, 
    'E01 - 3_7_2026 - 10_21_06 (2).MF4': {(11, 4, 1), (11, 5, 1), (11, 3, 2), (11, 6, 1), (11, 3, 1)}, 
    'E01 - 3_7_2026 - 11_21_50.MF4': {(12, 8, 1)}, 
    'E01 - 3_7_2026 - 11_33_39.MF4': {(12, 3, 2), (12, 7, 1), (12, 3, 1), (12, 5, 1), (12, 6, 1)}
}

master_counts = defaultdict(lambda: defaultdict(int))
for cases in master_data.values():
    for tipo, num, test in cases:
        master_counts[tipo][num] += 1

print("Master counts (tipo -> num -> tests):")
for tipo, nums in master_counts.items():
    print(f"Tipo {tipo}:")
    for num, tests in nums.items():
        print(f"  Num {num}: {tests} tests")

print("\nSatellite counts:")
sat_files = [
    r"\Correct Belt Routing\Change of Status Lap Belt Only\CBR_Change_of_Status_Lap_Belt_Only_1.mf4",
    r"\Correct Belt Routing\Change of Status Lap Belt Only\CBR_Change_of_Status_Lap_Belt_Only_2.mf4",
    r"\Correct Belt Routing\Change of Status Lap Belt Only\CBR_Change_of_Status_Lap_Belt_Only_3.mf4",
    r"\Correct Belt Routing\Initial Phase Buckle Only\CBR_Initial_Phase_Buckle_Only_1.mf4",
    r"\Correct Belt Routing\Initial Phase Buckle Only\CBR_Initial_Phase_Buckle_Only_2.mf4",
    r"\Correct Belt Routing\Initial Phase Completely Behind Back\CBR_Initial_Phase_Completely_Behind_Back_1.mf4",
    r"\Correct Belt Routing\Initial Phase Completely Behind Back\CBR_Initial_Phase_Completely_Behind_Back_2.mf4",
    r"\Correct Belt Routing\Initial Phase Lap Belt Only\CBR_Initial_Phase_Lap_Belt_Only_1.mf4",
    r"\Correct Belt Routing\Initial Phase Lap Belt Only\CBR_Initial_Phase_Lap_Belt_Only_2.mf4",
    r"\Out of Position\Change of Status Face on Facia\20cm\OOP_Change_of_Status_Face_on_Facia_20cm_1.mf4",
    r"\Out of Position\Change of Status Face on Facia\20cm\OOP_Change_of_Status_Face_on_Facia_20cm_2.mf4",
    r"\Out of Position\Change of Status Face on Facia\20cm\OOP_Change_of_Status_Face_on_Facia_20cm_3.mf4",
    r"\Out of Position\Change of Status Feet on Dashboard\Center\OOP_Change_of_Status_Feet_on_Dashboard_Center_1.mf4",
    r"\Out of Position\Change of Status Feet on Dashboard\Center\OOP_Change_of_Status_Feet_on_Dashboard_Center_2.mf4",
    r"\Out of Position\Change of Status Feet on Dashboard\Center\OOP_Change_of_Status_Feet_on_Dashboard_Center_3.mf4",
    r"\Out of Position\Change of Status Feet on Dashboard\Inboard\OOP_Change_of_Status_Feet_on_Dashboard_Inboard_1.mf4",
    r"\Out of Position\Change of Status Feet on Dashboard\Outboard\OOP_Change_of_Status_Feet_on_Dashboard_Outboard_1.mf4",
    r"\Out of Position\Change of Status Feet on Dashboard\Outboard\OOP_Change_of_Status_Feet_on_Dashboard_Outboard_2.mf4",
    r"\Out of Position\Initial Phase Face on Facia\20cm\OOP_Initial_Phase_Face_on_Facia_20cm_1.mf4",
    r"\Out of Position\Initial Phase Face on Facia\20cm\OOP_Initial_Phase_Face_on_Facia_20cm_2.mf4",
    r"\Out of Position\Initial Phase Feet on Dashboard\Inboard\OOP_Initial_Phase_Feet_on_Dashboard_Inboard_1.mf4"
]

sat_counts = defaultdict(int)
for f in sat_files:
    # Get base name without number and extension
    name = os.path.basename(f)
    base = name.rsplit('_', 1)[0]
    sat_counts[base] += 1

for base, count in sat_counts.items():
    print(f"{base}: {count} tests")
