import re
import os

# --- Case Definitions (Ported from facetracker.py) ---
OWL_Distractions = [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 16, 17, 20, 21, 22, 23, 29, 30, 31, 32, 33] 
LIZ_Distractions = [6, 7, 14, 15, 18, 19, 25, 26, 27, 28, 39, 41, 42]
EYE_Distractions = [13, 24, 34, 35, 36, 37, 38, 40]

class ChronosManager:
    @staticmethod
    def get_logic_for_file(filename):
        """
        Determines if the file requires OWL, LIZ, or EYE tracking based on its name.
        Returns: 'OWL', 'LIZ', 'EYE', or None if not applicable.
        """
        # Determine Distraction Type
        if 'O' in filename: d_type = 'Occlusion'
        elif 'B' in filename: d_type = 'Behaviour'
        elif filename.startswith('ADDW') or filename.startswith('gaze'): d_type = 'ADDW'
        elif 'F' in filename: d_type = 'Fatigue'
        else: d_type = 'Distraction'
        
        # Determine Case
        case_num = None
        
        if d_type == 'Distraction':
            match = re.search(r'^D(\d+)_', filename)
            if match: case_num = int(match.group(1))
            
        elif d_type == 'Occlusion':
            # Occlusion logic:
            if filename.startswith('F'): return 'EYE' # Occlusion starting with F -> EYE per script
            
            # Logic for D?_O?
            match = re.search(r'^[DF](\d+)_O', filename)
            if match:
                case_num = int(match.group(1))
                # Logic: Check lists
                if case_num in [29, 30, 31, 33]: return 'OWL' # OWL_V
                if case_num in OWL_Distractions: return 'OWL'
                if case_num in LIZ_Distractions: return 'LIZ'
                if case_num in EYE_Distractions: return 'EYE'
                
        elif d_type == 'Behaviour':
            # No specific logic in ref other than pattern matching, assume similar distribution or default?
            # Ref script didn't explicitly route behaviour to algo, but let's assume Distraction lists apply or default
            # Actually ref script has `if Cases in ...` block generic for the rest.
            match = re.search(r'^D(\d+)_B', filename)
            if match: case_num = int(match.group(1))
            
        elif d_type == 'ADDW':
             # ADDW -> OWL per script lines 63-66 (commented out LIZ, runs OWL)
             return 'OWL'
             
        elif d_type == 'Fatigue':
            # F -> EYE
            return 'EYE'
            
        # Generic List Check
        if case_num is not None:
            if case_num in OWL_Distractions: return 'OWL'
            if case_num in LIZ_Distractions: return 'LIZ'
            if case_num in EYE_Distractions: return 'EYE'
            
        return None
        
    @staticmethod
    def filter_camera_files(file_list, camera_id):
        """Filters files that match the requested camera ID (e.g. _cam1)."""
        suffix = f"_cam{camera_id}"
        valid = []
        for f in file_list:
            if suffix in f or f.endswith(".avi"): # If strict suffix not enforced, check logic. 
                # Ref script enforces _camX in patterns.
                # If we have only .avi names, check if they contain _cam{id}
                if f".avi" in f and (suffix in f):
                    valid.append(f)
        return valid
