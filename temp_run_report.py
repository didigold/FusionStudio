import sys
import os

sys.path.append(r"c:\Software\OSM\FusionStudio")

from backend.core.dsm_processor import DSMProcessor

class CustomDSMProcessor(DSMProcessor):
    def find_excel_in_subfolder(self, root_folder, target_name):
        valid_files = super().find_excel_in_subfolder(root_folder, target_name)
        # Filter out anything with 'to_be_flipped' in the path
        filtered = [f for f in valid_files if 'to_be_flipped' not in f.lower().replace('\\', '/')]
        return filtered

if __name__ == "__main__":
    template_path = r"c:\Software\OSM\FusionStudio\backend\assets\templates\Driver_Engagement.xlsx"
    base_output_path = r"J:\IDIADA\ES\HQ\KP02A_ADAS\Internal\Projects\MERCEDES BENZ\26ADAS_MB_OSM_GLE \26AT_ADAS00080\3_Data\DSM\_FUSION_RESULTS\CAN_Report_Results.xlsx"
    
    # Ensure we don't overwrite existing files
    output_path = base_output_path
    if os.path.exists(output_path):
        folder, filename = os.path.split(base_output_path)
        name, ext = os.path.splitext(filename)
        counter = 1
        output_path = os.path.join(folder, f"{name}_{counter}{ext}")
        while os.path.exists(output_path):
            counter += 1
            output_path = os.path.join(folder, f"{name}_{counter}{ext}")
            
    root_folder = r"J:\IDIADA\ES\HQ\KP02A_ADAS\Internal\Projects\MERCEDES BENZ\26ADAS_MB_OSM_GLE \26AT_ADAS00080\3_Data\DSM\_FUSION_RESULTS"
    folders_to_process = ["Distractions", "Fatigue", "Occlusions"]

    import traceback
    print(f"Starting custom reporting generation...\nOutput will be saved to: {output_path}")
    processor = CustomDSMProcessor(callback=print)
    try:
        processor.process_dsm_data(template_path, output_path, root_folder, folders_to_process)
    except Exception as e:
        print("An error occurred:")
        traceback.print_exc()
        sys.exit(1)
