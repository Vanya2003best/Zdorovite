import os
import re
from pathlib import Path
from collections import defaultdict

def extract_buttons_detailed(filepath, content):
    """Extract all interactive elements with context"""
    results = []
    
    # Split file into lines with numbers
    lines = content.split('\n')
    
    # 1. Find <button> elements
    for i, line in enumerate(lines, 1):
        if '<button' in line:
            # Get text until </button>
            text_match = re.search(r'<button[^>]*>([^<]+)<', line)
            button_text = text_match.group(1) if text_match else "[dynamic]"
            
            # Find onClick
            onclick_match = re.search(r'onClick=', line)
            onclick = "YES" if onclick_match else "NO"
            
            results.append({
                'type': 'button',
                'text': button_text[:40],
                'line': i,
                'handler': onclick,
            })
    
    # 2. Find <Link href=
    for i, line in enumerate(lines, 1):
        if '<Link' in line and 'href=' in line:
            href_match = re.search(r'href=["\']([^"\']+)["\']', line)
            href = href_match.group(1) if href_match else "?"
            
            # Get label
            text_match = re.search(r'href=[^>]*>([^<]+)<', line)
            text = text_match.group(1) if text_match else "[dynamic]"
            
            results.append({
                'type': 'Link',
                'text': text[:40],
                'line': i,
                'href': href,
            })
    
    # 3. Find <a href=
    for i, line in enumerate(lines, 1):
        if '<a ' in line and 'href=' in line and '<Link' not in line:
            href_match = re.search(r'href=["\']([^"\']+)["\']', line)
            href = href_match.group(1) if href_match else "?"
            
            text_match = re.search(r'href=[^>]*>([^<]+)<', line)
            text = text_match.group(1) if text_match else "[dynamic]"
            
            results.append({
                'type': 'a',
                'text': text[:40],
                'line': i,
                'href': href,
            })
    
    return results

# Analyze all files
buttons_by_page = {}

for tsx_file in sorted(Path("src/app/studio").rglob("*.tsx")):
    rel_path = str(tsx_file).replace("\\", "/").replace("src/app/studio/", "")
    
    try:
        with open(tsx_file, 'r', encoding='utf-8') as f:
            content = f.read()
            buttons = extract_buttons_detailed(str(tsx_file), content)
            if buttons:
                buttons_by_page[rel_path] = buttons
    except Exception as e:
        pass

# Print results
print(f"Found buttons in {len(buttons_by_page)} files\n")

for page in sorted(buttons_by_page.keys()):
    buttons = buttons_by_page[page]
    print(f"\n## {page} ({len(buttons)} interactive elements)")
    for btn in buttons:
        if btn['type'] == 'button':
            print(f"  [Button] {btn['text']} | Handler: {btn['handler']}")
        else:
            href = btn.get('href', '?')
            print(f"  [{btn['type']}] {btn['text']} → {href}")

