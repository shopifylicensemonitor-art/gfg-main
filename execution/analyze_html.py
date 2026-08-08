import os
import re

def main():
    html_path = r"c:\Users\HP\Downloads\Vibe code with me.html"
    if not os.path.exists(html_path):
        print(f"Error: HTML file not found at {html_path}")
        return

    with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
        html_content = f.read()

    print(f"HTML length: {len(html_content)}")
    
    # Check for <pre> or <code> tags
    pre_count = len(re.findall(r'<pre', html_content, re.IGNORECASE))
    code_count = len(re.findall(r'<code', html_content, re.IGNORECASE))
    print(f"Found {pre_count} <pre> tags and {code_count} <code> tags.")
    
    # Check for copy buttons or headers, often Claude has code blocks inside elements with "copy"
    copy_count = len(re.findall(r'Copy code', html_content, re.IGNORECASE))
    print(f"Found {copy_count} 'Copy code' references.")
    
    # Let's print a sample around a 'Copy code' button or code block to understand the structure
    # Search for a specific file like "db.js" or "server.js" in the html
    for filename in ["server.js", "db.js", "package.json"]:
        pos = html_content.find(filename)
        if pos != -1:
            print(f"\nFound '{filename}' at index {pos}. Surrounding 1000 characters:")
            print(html_content[max(0, pos-200):pos+800])
            break

if __name__ == "__main__":
    main()
