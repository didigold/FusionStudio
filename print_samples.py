from asammdf import MDF
import numpy as np

master_path = 'J:/IDIADA/ES/HQ/KP02A_ADAS/Internal/Projects/Hyundai/26ADAS_HMC_DE_OM_RS4/26AT_ADAS00142/3_Data/OM/E01/E01 - 3_7_2026 - 10_21_06 (1).MF4'
m = MDF(master_path)

t_type = m.get('Distraction_type')
t_num = m.get('Distraction_number')
t_test = m.get('Distraction_test_number')

# Print the timestamps and values where there is a change
print("Distraction_test_number samples:")
for t, val in zip(t_test.timestamps, t_test.samples):
    if 650 <= t <= 1200:
        print(f"Time: {t}, Test_num: {val}")

print("\nDistraction_type samples:")
for t, val in zip(t_type.timestamps, t_type.samples):
    if 650 <= t <= 1200:
        print(f"Time: {t}, Type: {val}")

print("\nDistraction_number samples:")
for t, val in zip(t_num.timestamps, t_num.samples):
    if 650 <= t <= 1200:
        print(f"Time: {t}, Number: {val}")
