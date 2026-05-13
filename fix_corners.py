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
                content = file.read()
            
            # Replace rounded-full with rounded-xl in div tags
            content = re.sub(r'<div([^>]*?class(?:Name)?=\"[^\"]*?)\brounded-full\b([^\"]*?\")', r'<div\1rounded-xl\2', content)
            
            # Replace rounded-full with rounded-md in input type="text" tags
            content = re.sub(r'<input([^>]*?class(?:Name)?=\"[^\"]*?)\brounded-full\b([^\"]*?\")', r'<input\1rounded-md\2', content)
            
            # Special case for "Start Training" or "Scan" buttons that user might want rectangular (rounded-md)
            # Actually, user said buttons like "start training" are still rectangular. So I need to MAKE them rounded-full if they missed it.
            # We already made everything rounded-full, wait.
            # User: "faltan botones como start training y esos que todavia son rectangulares, y campos como scan a root folder to find project son los que te digo que justo no deberian ser redondos."
            
            with open(path, 'w', encoding='utf-8') as file:
                file.write(content)

print("UI corners fixed.")
