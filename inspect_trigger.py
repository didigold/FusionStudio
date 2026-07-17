from asammdf import MDF
import numpy as np

master_path = 'J:/IDIADA/ES/HQ/KP02A_ADAS/Internal/Projects/Hyundai/26ADAS_HMC_DE_OM_RS4/26AT_ADAS00142/3_Data/OM/E01/E01 - 3_7_2026 - 10_21_06 (1).MF4'
m = MDF(master_path)

t_type = m.get('Distraction_type').samples
t_num = m.get('Distraction_number').samples
t_test = m.get('Distraction_test_number').samples
timestamps = m.get('Distraction_type').timestamps

# Find where Distraction_type == 11, Distraction_number == 5, Distraction_test_number == 1
# Let's find contiguous segments
in_segment = (t_type == 11) & (t_num == 5) & (t_test == 1)
indices = np.where(in_segment)[0]
if len(indices) > 0:
    start_time = timestamps[indices[0]]
    stop_time = timestamps[indices[-1]]
    print(f"Matched segment: start={start_time}, stop={stop_time}, duration={stop_time - start_time}")
    
    # Let's find when the test trigger (any distraction) starts and stops around this segment
    # In other words, when Distraction_test_number went above 0 and back to 0
    t_test_active = t_test > 0
    active_indices = np.where(t_test_active)[0]
    
    # Find the boundary of the test containing start_time
    # Find active segments
    inicios = [i for i in range(1, len(t_test)) if t_test[i] > 0 and t_test[i-1] == 0]
    if len(t_test) > 0 and t_test[0] > 0:
        inicios.insert(0, 0)
    fines = [i for i in range(1, len(t_test)) if t_test[i] == 0 and t_test[i-1] > 0]
    if fines and fines[0] < inicios[0]:
        fines.pop(0)
        
    for idx, (ini, fin) in enumerate(zip(inicios, fines)):
        t_ini = timestamps[ini]
        t_fin = timestamps[fin]
        if t_ini <= start_time <= t_fin:
            print(f"Parent test trigger (Trigger {idx}): start={t_ini}, stop={t_fin}, duration={t_fin-t_ini}")
            break
else:
    print("No segment matched (11, 5, 1) in this master file.")
