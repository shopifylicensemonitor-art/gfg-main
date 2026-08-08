import os
import re
from html import unescape

def main():
    html_path = r"c:\Users\HP\Downloads\Vibe code with me.html"
    if not os.path.exists(html_path):
        print(f"Error: HTML file not found at {html_path}")
        return

    print("Reading HTML file...")
    with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
        html_content = f.read()

    # Find all pre blocks
    pre_pattern = re.compile(r'<pre[^>]*>(.*?)</pre>', re.DOTALL | re.IGNORECASE)
    pre_matches = list(pre_pattern.finditer(html_content))
    print(f"Found {len(pre_matches)} <pre> blocks.")

    # Replace <pre>...</pre> in the HTML with placeholders
    # We do it sequentially
    placeholder_html = html_content
    pre_contents = []
    
    # We must replace them from last to first so indices don't shift
    for idx in range(len(pre_matches) - 1, -1, -1):
        match = pre_matches[idx]
        pre_contents.append((idx + 1, match.group(1)))
        placeholder_html = placeholder_html[:match.start()] + f" __PRE_BLOCK_{idx+1}__ " + placeholder_html[match.end():]

    # Clean the HTML (strip all other tags)
    print("Stripping HTML tags and cleaning text...")
    clean_text = re.sub(r'<script.*?</script>', ' ', placeholder_html, flags=re.DOTALL | re.IGNORECASE)
    clean_text = re.sub(r'<style.*?</style>', ' ', clean_text, flags=re.DOTALL | re.IGNORECASE)
    clean_text = re.sub(r'<[^>]+>', ' ', clean_text)
    clean_text = unescape(clean_text)
    # Remove multiple spaces
    clean_text = re.sub(r'\s+', ' ', clean_text)

    # Let's search for filenames around placeholders in the clean text
    # Regex to find filenames
    file_regex = re.compile(r'([\w\-\./]+\.(?:js|json|css|html|ts|tsx|yaml|yml|env|example))')

    block_to_file = {}
    file_to_blocks = {}
    
    print("Mapping blocks in clean text...")
    for block_num in range(1, len(pre_matches) + 1):
        placeholder = f"__PRE_BLOCK_{block_num}__"
        pos = clean_text.find(placeholder)
        if pos == -1:
            continue
            
        # Get 1000 characters of clean text before this placeholder
        lookback = clean_text[max(0, pos - 1500):pos]
        
        # Search for filename candidates in lookback text
        candidates = file_regex.findall(lookback)
        if candidates:
            # Clean candidates
            cleaned = []
            for c in candidates:
                c_clean = c.strip(" .(),;:\"'")
                if not re.match(r'^\d+\.\d+\.\d+$', c_clean) and len(c_clean) > 2:
                    # Filter out obvious false positives like "npm.js" or "node.js" unless they are the code files
                    if c_clean.lower() not in ['node.js', 'npm.js', 'react.js', 'express.js']:
                        cleaned.append(c_clean)
            
            if cleaned:
                # Use the last candidate (closest to the block)
                file_name = cleaned[-1]
                file_name = file_name.replace('\\', '/')
                # Strip leading/trailing slashes or dots
                file_name = file_name.strip('/')
                
                block_to_file[block_num] = file_name
                if file_name not in file_to_blocks:
                    file_to_blocks[file_name] = []
                file_to_blocks[file_name].append(block_num)

    print(f"Successfully mapped {len(block_to_file)} blocks.")
    
    # Save the files
    output_dir = r"c:\Users\HP\Downloads\gfg-main\.tmp\mailflow_clean_extracted"
    os.makedirs(output_dir, exist_ok=True)
    
    summary_path = r"c:\Users\HP\Downloads\gfg-main\.tmp\mailflow_clean_summary.txt"
    
    # Let's save pre_contents as a lookup list
    pre_contents.reverse() # Restore original order (1 to 227)
    
    with open(summary_path, "w", encoding="utf-8") as f_sum:
        f_sum.write("LATEST EXTRACTED CODE FILES:\n")
        f_sum.write("=" * 80 + "\n\n")
        
        for file_name, blocks in sorted(file_to_blocks.items()):
            latest_block_num = blocks[-1]
            f_sum.write(f"File: {file_name}\n")
            f_sum.write(f"  Versions in chat: {len(blocks)} (Blocks: {blocks})\n")
            f_sum.write(f"  Latest Block: {latest_block_num}\n")
            
            # Extract content from the corresponding pre block
            # In pre_contents list, index is block_num - 1
            raw_code = pre_contents[latest_block_num - 1][1]
            # Strip tags and unescape html inside the code
            code_text = unescape(re.sub(r'<[^>]+>', '', raw_code))
            
            # Save file
            local_path = os.path.join(output_dir, file_name)
            local_dir = os.path.dirname(local_path)
            os.makedirs(local_dir, exist_ok=True)
            
            with open(local_path, "w", encoding="utf-8") as f_code:
                f_code.write(code_text)
                
            f_sum.write(f"  Saved to: {local_path}\n\n")

    print(f"Finished mapping. Summary saved to {summary_path}")

if __name__ == "__main__":
    main()
