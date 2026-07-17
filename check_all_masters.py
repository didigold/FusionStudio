import os
from asammdf import MDF

folder = 'J:/IDIADA/ES/HQ/KP02A_ADAS/Internal/Projects/Hyundai/26ADAS_HMC_DE_OM_RS4/26AT_ADAS00142/3_Data/OM/E01'
master_files = [f for f in os.listdir(folder) if f.lower().endswith('.mf4') and 'E01 - ' in f]

for f in master_files:
    path = os.path.join(folder, f)
    try:
        m = MDF(path)
        print(f"\n==========================================")
        print(f"File: {f}")
        print(f"Start Time: {m.header.start_time}")
        
        # Check if distraction signals exist
        if 'Distraction_type' in m:
            t_type = m.get('Distraction_type').samples
            t_num = m.get('Distraction_number').samples
            t_test = m.get('Distraction_test_number').samples
            timestamps = m.get('Distraction_type').timestamps
            
            # Find contiguous active segments
            inicios = [i for i in range(1, len(t_test)) if t_test[i] > 0 and t_test[i-1] == 0]
            if len(t_test) > 0 and t_test[0] > 0:
                inicios.insert(0, 0)
            fines = [i for i in range(1, len(t_test)) if t_test[i] == 0 and t_test[i-1] > 0]
            if fines and fines[0] < inicios[0]:
                fines.pop(0)
                
            for idx, (ini, fin) in enumerate(zip(inicios, fines)):
                t_start = timestamps[ini]
                t_stop = timestamps[fin]
                val_type = t_type[ini]
                val_num = t_num[ini]
                val_test = t_test[ini]
                if val_type == 11 and val_num == 5 and val_test == 1:
                    print(f"  --> MATCH (11, 5, 1) at Trigger {idx}: start={t_start}, stop={t_stop}, duration={t_stop-t_start}")
                else:
                    print(f"  Trigger {idx}: start={t_start}, stop={t_stop}, duration={t_stop-t_start}, type={val_type}, num={val_num}, test={val_test}")
        else:
            print("  No Distraction signals found in this file.")
    except Exception as e:
        print(f"  Error reading {f}: {e}")
