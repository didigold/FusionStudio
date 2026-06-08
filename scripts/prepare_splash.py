import os

def main():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(current_dir, ".."))
    
    splash_path = os.path.join(project_root, "backend", "assets", "splash.html")
    loading_path = os.path.join(project_root, "backend", "assets", "loading.json")
    
    if not os.path.exists(splash_path):
        print(f"[ERROR] splash.html not found at {splash_path}")
        return
        
    if not os.path.exists(loading_path):
        print(f"[ERROR] loading.json not found at {loading_path}")
        return
        
    print(f"Reading Lottie data from {loading_path}...")
    with open(loading_path, "r", encoding="utf-8") as f:
        lottie_json = f.read().strip()
        
    print(f"Reading template from {splash_path}...")
    with open(splash_path, "r", encoding="utf-8") as f:
        splash_content = f.read()
        
    placeholder = "// ANIMATION_DATA_PLACEHOLDER"
    replacement = f"const animationData = {lottie_json};"
    
    if placeholder not in splash_content:
        print("[WARNING] Placeholder not found in splash.html. It might have been already injected.")
        return
        
    new_content = splash_content.replace(placeholder, replacement)
    
    print(f"Writing injected splash.html to {splash_path}...")
    with open(splash_path, "w", encoding="utf-8") as f:
        f.write(new_content)
        
    print("[SUCCESS] Lottie animation embedded successfully in splash.html.")

if __name__ == "__main__":
    main()
