import os
import re

directories = ['frontend/src/pages', 'frontend/src/components', 'frontend/src/components/layout']

for d in directories:
    if not os.path.exists(d):
        continue
    for f in os.listdir(d):
        if f.endswith('.tsx'):
            path = os.path.join(d, f)
            with open(path, 'r', encoding='utf-8') as file:
                c = file.read()
            
            # Apply dark mode color replacements (since BrainTab missed out)
            c = re.sub(r'bg-\[#111\]|bg-\[#1e1e1e\]', 'bg-transparent', c)
            c = re.sub(r'border-\[#333\]|border-\[#444\]', 'border-border/50', c)
            c = re.sub(r'text-white|text-\[#ccc\]|text-\[#aaa\]', 'text-foreground', c)
            c = re.sub(r'text-\[#888\]|text-\[#666\]|text-\[#555\]', 'text-muted-foreground', c)
            c = re.sub(r'text-\[#F39200\]', 'text-foreground font-bold', c)
            c = re.sub(r'bg-\[#222\]|bg-\[#1a1a1a\]|bg-\[#2a2a2a\]|bg-\[#333\]', 'bg-card', c)

            # Ensure ALL buttons and selects are rounded-full
            c = re.sub(r'<button([^>]*?class(?:Name)?=\"[^\"]*?)\brounded(?:-[a-z0-9\[\]]+)?\b([^\"]*?\")', r'<button\1rounded-full\2', c)
            c = re.sub(r'<select([^>]*?class(?:Name)?=\"[^\"]*?)\brounded(?:-[a-z0-9\[\]]+)?\b([^\"]*?\")', r'<select\1rounded-full\2', c)
            
            with open(path, 'w', encoding='utf-8') as file:
                file.write(c)

print("Buttons fixed globally.")
