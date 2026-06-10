import os
import re
from pathlib import Path
from collections import defaultdict

def extract_buttons_detailed(filepath, content):
    """Извлечь все интерактивные элементы с контекстом"""
    results = []
    
    # Разбить файл на строки с номерами
    lines = content.split('\n')
    
    # 1. Ищем <button> элементы
    for i, line in enumerate(lines, 1):
        # <button type="button" onClick={...}
        if '<button' in line:
            # Получить текст до конца </button>
            text_match = re.search(r'<button[^>]*>([^<]+)<', line)
            button_text = text_match.group(1) if text_match else "[dynamic content]"
            
            # Ищем onClick
            onclick_match = re.search(r'onClick=\{([^}]+)\}', line)
            onclick = onclick_match.group(1) if onclick_match else "no handler"
            
            # Ищем disabled
            disabled = 'disabled' in line
            
            results.append({
                'type': 'button',
                'text': button_text[:50],
                'line': i,
                'handler': onclick,
                'has_handler': bool(onclick_match),
                'disabled': disabled,
                'raw': line.strip()[:80]
            })
    
    # 2. Ищем <Link href=
    for i, line in enumerate(lines, 1):
        if '<Link' in line and 'href=' in line:
            href_match = re.search(r'href=["\']([^"\']+)["\']', line)
            href = href_match.group(1) if href_match else "?"
            
            # Получить label из строки или следующих
            text_match = re.search(r'href=[^>]*>([^<]+)<', line)
            text = text_match.group(1) if text_match else "[dynamic]"
            
            results.append({
                'type': 'Link',
                'text': text[:50],
                'line': i,
                'href': href,
                'raw': line.strip()[:80]
            })
    
    # 3. Ищем <a href=
    for i, line in enumerate(lines, 1):
        if '<a ' in line and 'href=' in line and '<Link' not in line:
            href_match = re.search(r'href=["\']([^"\']+)["\']', line)
            href = href_match.group(1) if href_match else "?"
            
            text_match = re.search(r'href=[^>]*>([^<]+)<', line)
            text = text_match.group(1) if text_match else "[dynamic]"
            
            results.append({
                'type': 'a',
                'text': text[:50],
                'line': i,
                'href': href,
                'raw': line.strip()[:80]
            })
    
    return results

# Анализировать все файлы
pages = []
buttons_by_page = defaultdict(list)

for tsx_file in sorted(Path("src/app/studio").rglob("*.tsx")):
    rel_path = str(tsx_file).replace('\', '/').replace('src/app/studio/', '')
    
    try:
        with open(tsx_file, 'r', encoding='utf-8') as f:
            content = f.read()
            buttons = extract_buttons_detailed(str(tsx_file), content)
            if buttons:
                pages.append(rel_path)
                buttons_by_page[rel_path] = buttons
    except Exception as e:
        print(f"Error: {tsx_file}: {e}")

# Вывести результаты
print(f"Found buttons in {len(pages)} files:\n")

for page in sorted(pages):
    buttons = buttons_by_page[page]
    print(f"\n### {page}")
    for btn in buttons:
        if btn['type'] == 'button':
            print(f"  - [{btn['type']}] {btn['text'][:40]} | Handler: {btn['has_handler']} | Line: {btn['line']}")
        else:
            print(f"  - [{btn['type']}] {btn['text'][:40]} → {btn.get('href', '?')} | Line: {btn['line']}")

