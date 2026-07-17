from asammdf import MDF
import glob

mdfs = glob.glob('J:/IDIADA/ES/HQ/KP02A_ADAS/Internal/Projects/Hyundai/26ADAS_HMC_DE_OM_RS4/26AT_ADAS00142/3_Data/OM/E01/*.MF4')
res = {}
for m in mdfs:
    print(f"Processing {m}")
    try:
        mdf = MDF(m)
        t = mdf.get('Distraction_type').samples
        n = mdf.get('Distraction_number').samples
        test = mdf.get('Distraction_test_number').samples
        res[m.split('/')[-1].split('\\')[-1]] = set(zip(t[t>0], n[t>0], test[t>0]))
    except Exception as e:
        print(f"Error reading {m}: {e}")

print(res)
