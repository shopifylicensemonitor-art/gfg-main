import os
import re
from html import unescape

def clean_html(text):
    # Strip HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Unescape HTML entities (e.g., &quot;, &lt;, &gt;)
    return unescape(text)

def main():
    html_path = r"c:\Users\HP\Downloads\Vibe code with me.html"
    if not os.path.exists(html_path):
        print(f"Error: HTML file not found at {html_path}")
        return

    print("Reading HTML file...")
    with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
        html_content = f.read()

    print("Extracting <pre> tags...")
    # Find all <pre> tags and their start/end indices
    pattern = re.compile(r'<pre[^>]*>(.*?)</pre>', re.DOTALL | re.IGNORECASE)
    matches = list(pattern.finditer(html_content))
    print(f"Found {len(matches)} <pre> blocks.")

    output_dir = r"c:\Users\HP\Downloads\gfg-main\.tmp\mailflow_code_files"
    os.makedirs(output_dir, exist_ok=True)

    summary_file = r"c:\Users\HP\Downloads\gfg-main\.tmp\extracted_files_summary.txt"
    
    with open(summary_file, "w", encoding="utf-8") as f_sum:
        f_sum.write(f"Total <pre> blocks found: {len(matches)}\n\n")
        
        for idx, match in enumerate(matches):
            raw_code_html = match.group(1)
            code_text = clean_html(raw_code_html)
            
            # Find context before <pre>
            start_pos = match.start()
            before_context = html_content[max(0, start_pos - 1000):start_pos]
            before_text = clean_html(before_context)
            
            # Search for filenames in context before the pre block
            # Matches routes/accounts.js, db.js, etc.
            filename_matches = re.findall(r'([\w\-\./]+\.(?:js|json|css|html|ts|tsx|py|sh|env))', before_text)
            
            guessed_filename = f"block_{idx+1}.txt"
            if filename_matches:
                # Get the last filename match (usually closest to the code block)
                candidate = filename_matches[-1]
                # Clean up any trailing dots or characters
                candidate = candidate.strip(" .(),;:")
                if "/" in candidate or "\\" in candidate:
                    # Replace slashes with underscores for local saving
                    guessed_filename = candidate.replace("/", "_").replace("\\", "_")
                else:
                    guessed_filename = candidate

            # Let's clean the name further to make sure it's valid
            guessed_filename = re.sub(r'[^\w\.\-]', '_', guessed_filename)
            
            # Save the code block
            file_path = os.path.join(output_dir, f"{idx+1}_{guessed_filename}")
            with open(file_path, "w", encoding="utf-8") as f_code:
                f_code.write(code_text)
                
            # Log in summary
            f_sum.write(f"BLOCK {idx+1}:\n")
            f_sum.write(f"File saved: {file_path}\n")
            f_sum.write(f"Context snippet (before):\n{before_text[-300:].strip()}\n")
            f_sum.write("-" * 50 + "\n\n")
            
    print(f"Extraction complete! Summary saved to {summary_file}")

if __name__ == "__main__":
    main()
