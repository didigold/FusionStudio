import os
import pandas as pd
import re
from collections import Counter

# Participant Data: traits and lux conditions
PARTICIPANT_DATA = {
    'P1': {'traits': ['Long Hair', 'Light Makeup'], 'lux': '1-20k Lux'},
    'P2': {'traits': ['Long Hair', 'Light Makeup', 'Clear Glasses'], 'lux': '>20k Lux'},
    'P3': {'traits': ['Short Beard'], 'lux': '>20k Lux'},
    'P4': {'traits': ['Long Hair'], 'lux': '>20k Lux'},
    'P6': {'traits': ['Short Beard'], 'lux': '>20k Lux'},
    'P7': {'traits': ['Short Beard'], 'lux': '>20k Lux'},
    'P8': {'traits': ['Short Beard'], 'lux': '>20k Lux'},
    'P9': {'traits': ['Clear Glasses'], 'lux': '1-20k Lux'},
    'P10': {'traits': ['Clear Glasses', 'Long Hair'], 'lux': '>20k Lux'},
    'P12': {'traits': ['Long Hair'], 'lux': '>20k Lux'},
    'P13': {'traits': ['Clear Glasses', 'Short Beard'], 'lux': '>20k Lux'},
    'P15': {'traits': ['Short Beard'], 'lux': '1-20k Lux'},
    'P16': {'traits': ['Long Hair'], 'lux': '>20k Lux'},
    'P17': {'traits': ['Clear Glasses', 'Short Beard'], 'lux': '>20k Lux'},
    'P20': {'traits': ['Clear Glasses', 'Long Hair'], 'lux': '>20k Lux'},
}

# Label Mapping for Occlusions
LABEL_MAPPING = {
    'O5': 'Sunglasses',
    'O9': 'Facemask',
    'O10': 'Cap'
}

def normalize_pid(p_id):
    if not p_id: return None
    # P01 -> P1, P12 -> P12
    match = re.match(r'^([A-Z])0?(\d+)$', p_id, re.IGNORECASE)
    if match:
        return f"{match.group(1).upper()}{match.group(2)}"
    return p_id.upper()

def count_scenarios(root_path):
    counts = Counter()
    
    print(f"Scanning directory: {root_path}")
    
    if not os.path.exists(root_path):
        print(f"Error: Path {root_path} does not exist.")
        return

    # Recursive search for Excel files
    for root, dirs, files in os.walk(root_path):
        # Extract participant ID from path (e.g. ...\_FUSION_RESULTS\P01\...)
        p_id_raw = None
        path_parts = root.split(os.sep)
        for part in reversed(path_parts):
            if re.match(r'^[A-Z]\d{1,2}$', part, re.IGNORECASE):
                p_id_raw = part.upper()
                break
        
        p_id = normalize_pid(p_id_raw)
        
        for file in files:
            if file.endswith(".xlsx") and not file.startswith("~$"):
                file_path = os.path.join(root, file)
                print(f"Processing: {file_path} (ID: {p_id or 'Unknown'})")
                
                try:
                    df = pd.read_excel(file_path)
                    if "File Name" not in df.columns:
                        continue
                    
                    p_info = PARTICIPANT_DATA.get(p_id, {'traits': [], 'lux': '>20k Lux'})
                    
                    for _, row in df.iterrows():
                        fname = str(row["File Name"]).split('.')[0]
                        parts = fname.split("_")
                        
                        row_scenarios = set()
                        for part in parts:
                            match = re.match(r'^([DFO]\d+)', part, re.IGNORECASE)
                            if match:
                                code = match.group(1).upper()
                                # Apply label mapping (e.g. O5 -> Sunglasses)
                                label = LABEL_MAPPING.get(code, code)
                                row_scenarios.add(label)
                        
                        # Add standard scenarios to counts
                        for s in row_scenarios:
                            counts[s] += 1
                        
                        # Add Lux condition
                        counts[p_info['lux']] += 1
                        
                        # Add Traits
                        has_sunglasses = 'Sunglasses' in row_scenarios
                        for trait in p_info['traits']:
                            # Special rule: if wearing Sunglasses, ignore Clear Glasses
                            if trait == 'Clear Glasses' and has_sunglasses:
                                continue
                            counts[trait] += 1
                            
                except Exception as e:
                    print(f"  [ERROR] Could not process {file}: {e}")

    return counts

if __name__ == "__main__":
    RESULTS_PATH = r"J:\IDIADA\ES\HQ\KP02A_ADAS\Internal\Projects\Seat\22XC_SEAT_SMALLBEV\25AT_ADAS00373 - Cupra Raval Pre NCAP 2026\3_Data\DSM\_FUSION_RESULTS"
    
    counts = count_scenarios(RESULTS_PATH)
    
    if counts:
        print("\n" + "="*30)
        print("FINAL SCENARIO COUNT SUMMARY")
        print("="*30)
        
        # Define categories for reporting
        categories = {
            "Distraction (D)": lambda x: x.startswith('D'),
            "Fatigue (F)": lambda x: x.startswith('F') and x not in LABEL_MAPPING.values(),
            "Standard Occlusions (O)": lambda x: x in LABEL_MAPPING.values(),
            "Participant Traits": lambda x: x in ['Long Hair', 'Light Makeup', 'Short Beard', 'Clear Glasses'],
            "Lighting Conditions": lambda x: 'Lux' in x
        }
        
        # Sort function
        def sort_key(code):
            if code.startswith('D'): return (0, int(code[1:]) if code[1:].isdigit() else 0)
            if code.startswith('F'): return (1, int(code[1:]) if code[1:].isdigit() else 0)
            if code in LABEL_MAPPING.values(): return (2, code)
            if code in ['Long Hair', 'Light Makeup', 'Short Beard', 'Clear Glasses']: 
                # Sub-sorting traits
                trait_order = {'Long Hair': 0, 'Light Makeup': 1, 'Short Beard': 2, 'Clear Glasses': 3}
                return (3, trait_order.get(code, 4))
            return (4, code)

        for cat_name, filter_func in categories.items():
            cat_items = sorted([(k, v) for k, v in counts.items() if filter_func(k)], key=lambda x: sort_key(x[0]))
            if cat_items:
                print(f"\n--- {cat_name} ---")
                for k, v in cat_items:
                    print(f"{k: <15}: {v}")
            
        print("\n" + "="*30)
        # Total base entries (using D1 as proxy or sum of Lux)
        total_cases = counts['1-20k Lux'] + counts['>20k Lux']
        print(f"Total Unique Cases Processed: {total_cases}")
    else:
        print("No data found.")
