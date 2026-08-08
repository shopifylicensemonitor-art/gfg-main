import os
import re

def main():
    html_path = r"c:\Users\HP\Downloads\Vibe code with me.html"
    with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()
        
    pre_pattern = re.compile(r'<pre[^>]*>(.*?)</pre>', re.DOTALL | re.IGNORECASE)
    matches = list(pre_pattern.finditer(html))
    
    print(f"Found {len(matches)} pre tags.")
    
    # Print context of the first 5 pre tags
    for i in range(min(5, len(matches))):
        idx = i + 1
        match = matches[i]
        start_pos = match.start()
        context = html[max(0, start_pos - 800):start_pos]
        
        print(f"\n--- PRE BLOCK {idx} ---")
        print("HTML CONTEXT BEFORE:")
        print(context)
        print("-" * 50)
        
if __name__ == "__main__":
    main()
