from asammdf import MDF

master_path = 'J:/IDIADA/ES/HQ/KP02A_ADAS/Internal/Projects/Hyundai/26ADAS_HMC_DE_OM_RS4/26AT_ADAS00142/3_Data/OM/E01/E01 - 3_7_2026 - 10_21_06 (1).MF4'
m = MDF(master_path)

t_type = m.get('Distraction_type')
t_num = m.get('Distraction_number')
t_test = m.get('Distraction_test_number')

# Find active segments
inicios = [i for i in range(1, len(t_test.samples)) if t_test.samples[i] > 0 and t_test.samples[i-1] == 0]
if len(t_test.samples) > 0 and t_test.samples[0] > 0:
    inicios.insert(0, 0)
fines = [i for i in range(1, len(t_test.samples)) if t_test.samples[i] == 0 and t_test.samples[i-1] > 0]
if fines and fines[0] < inicios[0]:
    fines.pop(0)
    
for idx, (ini, fin) in enumerate(zip(inicios, fines)):
    t_start = t_test.timestamps[ini]
    t_stop = t_test.timestamps[fin]
    val_type = t_type.samples[ini]
    val_num = t_num.samples[ini]
    val_test = t_test.samples[ini]
    print(f"Trigger {idx}: start={t_start}, stop={t_stop}, duration={t_stop-t_start}, type={val_type}, num={val_num}, test={val_test}")
