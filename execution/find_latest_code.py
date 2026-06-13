import os
import re

def main():
    chat_path = r"c:\Users\HP\Downloads\gfg-main\.tmp\extracted_chat_raw.txt"
    if not os.path.exists(chat_path):
        print("Error: extracted_chat_raw.txt not found!")
        return

    with open(chat_path, 'r', encoding='utf-8') as f:
        chat_content = f.read()

    # Find all pre blocks with their text position
    # Let's extract the actual HTML file for positions or use the raw text file.
    # The html file is c:\Users\HP\Downloads\Vibe code with me.html
    html_path = r"c:\Users\HP\Downloads\Vibe code with me.html"
    with open(html_path, 'r', encoding='utf-8', errors='ignore') as f_html:
        html_content = f_html.read()

    # Find all <pre> tags and their starting indices in the HTML
    pre_pattern = re.compile(r'<pre[^>]*>(.*?)</pre>', re.DOTALL | re.IGNORECASE)
    pre_matches = list(pre_pattern.finditer(html_content))
    print(f"Found {len(pre_matches)} <pre> blocks in HTML.")

    # We want to scan the HTML content for file designations.
    # When a file name is typed, like "routes/accounts.js", "server.js", it's in the text before a <pre> block.
    # Let's build a map: for each <pre> block, we look at the text in the 2000 characters before it.
    # We find all files matching standard patterns:
    # - /routes/[a-zA-Z0-9_\-]+\.js
    # - frontend/src/[a-zA-Z0-9_\-\/]+\.(js|json|css|html)
    # - [a-zA-Z0-9_\-]+\.(js|json|yaml|yml|env|example)
    
    file_regex = re.compile(r'([\w\-\./]+\.(?:js|json|css|html|ts|tsx|yaml|yml|env|example))')
    
    from html import unescape
    def clean_text(html_text):
        return unescape(re.sub(r'<[^>]+>', ' ', html_text))

    block_to_file = {}
    file_to_blocks = {}
    
    for idx, match in enumerate(pre_matches):
        start_pos = match.start()
        context_html = html_content[max(0, start_pos - 1500):start_pos]
        context_text = clean_text(context_html)
        
        # Find all filename candidates in the context
        candidates = file_regex.findall(context_text)
        if candidates:
            # Clean up the candidate names
            cleaned_candidates = []
            for c in candidates:
                c_clean = c.strip(" .(),;:\"'")
                # Exclude common noise or versions like 1.0.0
                if not re.match(r'^\d+\.\d+\.\d+$', c_clean) and len(c_clean) > 2:
                    cleaned_candidates.append(c_clean)
            
            if cleaned_candidates:
                # Use the last candidate (closest to the code block)
                file_name = cleaned_candidates[-1]
                # Normalize file path (forward slashes)
                file_name = file_name.replace('\\', '/')
                block_to_file[idx + 1] = file_name
                
                if file_name not in file_to_blocks:
                    file_to_blocks[file_name] = []
                file_to_blocks[file_name].append(idx + 1)

    print(f"Mapped {len(block_to_file)} blocks to files.")
    
    # Save the latest version of each file
    output_dir = r"c:\Users\HP\Downloads\gfg-main\.tmp\mailflow_latest_code"
    os.makedirs(output_dir, exist_ok=True)
    
    summary_path = r"c:\Users\HP\Downloads\gfg-main\.tmp\mailflow_latest_files_summary.txt"
    with open(summary_path, "w", encoding="utf-8") as f_sum:
        f_sum.write("LATEST FILES EXTRACTED FROM CHAT:\n\n")
        
        for file_name, blocks in sorted(file_to_blocks.items()):
            latest_block_idx = blocks[-1]
            f_sum.write(f"File: {file_name}\n")
            f_sum.write(f"  Total versions in chat: {len(blocks)}\n")
            f_sum.write(f"  Latest version is in Block {latest_block_idx}\n")
            f_sum.write(f"  All blocks: {blocks}\n")
            
            # Read block content
            block_match = pre_matches[latest_block_idx - 1]
            code_content = clean_text(block_match.group(1))
            
            # Write to output folder
            # Recreate directories if needed
            local_file_path = os.path.join(output_dir, file_name)
            local_dir = os.path.dirname(local_file_path)
            os.makedirs(local_dir, exist_ok=True)
            
            with open(local_file_path, "w", encoding="utf-8") as f_code:
                f_code.write(code_content)
                
            f_sum.write(f"  Saved to: {local_file_path}\n\n")
            
    print(f"Saved latest file summary to {summary_path}")

if __name__ == "__main__":
    main()
