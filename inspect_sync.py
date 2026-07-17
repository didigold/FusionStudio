from asammdf import MDF
import glob

# Master file
master_path = 'J:/IDIADA/ES/HQ/KP02A_ADAS/Internal/Projects/Hyundai/26ADAS_HMC_DE_OM_RS4/26AT_ADAS00142/3_Data/OM/E01/E01 - 3_7_2026 - 10_21_06 (1).MF4'
# Satellite file
sat_path = 'J:/IDIADA/ES/HQ/KP02A_ADAS/Internal/Projects/Hyundai/26ADAS_HMC_DE_OM_RS4/26AT_ADAS00142/3_Data/OM/E01/Correct Belt Routing/Initial Phase Completely Behind Back/CBR_Initial_Phase_Completely_Behind_Back_1.mf4'

print("Reading master...")
m_master = MDF(master_path)
print("Master start_time:", m_master.header.start_time)

print("\nReading satellite...")
m_sat = MDF(sat_path)
print("Satellite start_time:", m_sat.header.start_time)

# Find trigger times in master
t = m_master.get('Distraction_type').samples
timestamps = m_master.get('Distraction_type').timestamps
inicios = [i for i in range(1, len(t)) if t[i] > 0 and t[i-1] == 0]
if len(t) > 0 and t[0] > 0:
    inicios.insert(0, 0)
fines = [i for i in range(1, len(t)) if t[i] == 0 and t[i-1] > 0]
if fines and fines[0] < inicios[0]:
    fines.pop(0)

print("\nMaster test triggers:")
for idx, (ini, fin) in enumerate(zip(inicios, fines)):
    print(f"Trigger {idx}: start={timestamps[ini]}, stop={timestamps[fin]}, duration={timestamps[fin]-timestamps[ini]}")

print("\nSatellite SoundPressure duration:")
sp = m_sat.get('SoundPressure')
print(f"SoundPressure first={sp.timestamps[0]}, last={sp.timestamps[-1]}, duration={sp.timestamps[-1]-sp.timestamps[0]}")
