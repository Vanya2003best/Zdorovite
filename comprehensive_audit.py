import re
from pathlib import Path
from collections import defaultdict

buttons_data = []

# Specific pages to analyze
pages_to_scan = [
    "src/app/studio/page.tsx",
    "src/app/studio/bookings/page.tsx",
    "src/app/studio/calendar/page.tsx",
    "src/app/studio/calendar/CalendarClient.tsx",
    "src/app/studio/calendar/DayHoursDialog.tsx",
    "src/app/studio/design/page.tsx",
    "src/app/studio/design/EditorClient.tsx",
    "src/app/studio/klienci/page.tsx",
    "src/app/studio/klienci/AddClientButton.tsx",
    "src/app/studio/messages/page.tsx",
    "src/app/studio/profile/page.tsx",
    "src/app/studio/reviews/page.tsx",
    "src/app/studio/pages/page.tsx",
    "src/app/studio/finanse/page.tsx",
]

for page_path in pages_to_scan:
    path = Path(page_path)
    if not path.exists():
        continue
    
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Search for interactive elements
    # Buttons with onClick
    buttons = re.finditer(r'<button[^>]*>([^<]*)<', content)
    for m in buttons:
        text = m.group(1).strip()[:40]
        buttons_data.append((page_path, "button", text, "onClick handler", "✓"))
    
    # Links
    links = re.finditer(r'<Link[^>]*href=["\']([^"\']*)["\'][^>]*>([^<]*)<', content)
    for m in links:
        href = m.group(1)
        text = m.group(2).strip()[:40]
        if href and href != '#':
            buttons_data.append((page_path, "Link", text, href, "✓"))
    
    # a href
    alinks = re.finditer(r'<a[^>]*href=["\']([^"\']*)["\'][^>]*>([^<]*)<', content)
    for m in alinks:
        href = m.group(1)
        text = m.group(2).strip()[:40]
        if '<Link' not in content[max(0, m.start()-50):m.start()]:
            buttons_data.append((page_path, "a", text, href, "✓"))

# Group by page
by_page = defaultdict(list)
for page, btn_type, text, target, status in buttons_data:
    by_page[page].append((btn_type, text, target, status))

print("# AUDIT: Interactive Elements in Studio\n")
print(f"Found {len(buttons_data)} interactive elements across {len(by_page)} pages\n")

for page in sorted(by_page.keys()):
    elements = by_page[page]
    print(f"\n## {page}")
    print(f"**Elements: {len(elements)}**\n")
    print("| Type | Label | Target | Status |")
    print("|------|-------|--------|--------|")
    
    for btn_type, text, target, status in elements:
        target_short = target[:50] if len(target) < 50 else target[:47] + "..."
        print(f"| {btn_type} | {text} | {target_short} | {status} |")

