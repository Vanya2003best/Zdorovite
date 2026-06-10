import os
import re
from pathlib import Path

def find_buttons_in_file(filepath, content):
    """Найти все кнопки в файле"""
    buttons = []
    
    # Паттерны поиска:
    # 1. <button>
    button_pattern = r'<button[^>]*>([^<]+)</button>'
    # 2. <a href=
    link_pattern = r'<a[^>]*href=["\'](.*?)["\'][^>]*>([^<]+)</a>'
    # 3. <Link
    nextlink_pattern = r'<Link[^>]*href=["\'](.*?)["\'][^>]*>([^<]+)</Link>'
    # 4. onClick handlers
    onclick_pattern = r'onClick=\{?([^}]+)\}?'
    
    buttons_raw = re.findall(button_pattern, content, re.DOTALL)
    for btn in buttons_raw:
        buttons.append(('button', btn.strip(), filepath))
    
    links_raw = re.findall(link_pattern, content, re.DOTALL)
    for href, text in links_raw:
        buttons.append(('a href', text.strip(), filepath, href))
    
    nextlinks_raw = re.findall(nextlink_pattern, content, re.DOTALL)
    for href, text in nextlinks_raw:
        buttons.append(('Link', text.strip(), filepath, href))
    
    return buttons

# Сканируем все tsx файлы в studio
studio_path = Path("src/app/studio")
all_buttons = []

for tsx_file in studio_path.rglob("*.tsx"):
    try:
        with open(tsx_file, 'r', encoding='utf-8') as f:
            content = f.read()
            buttons = find_buttons_in_file(str(tsx_file), content)
            all_buttons.extend(buttons)
    except Exception as e:
        print(f"Error reading {tsx_file}: {e}")

# Вывод
for btn in all_buttons[:100]:  # First 100
    print(f"{btn}")

print(f"\n\nTotal buttons found: {len(all_buttons)}")
