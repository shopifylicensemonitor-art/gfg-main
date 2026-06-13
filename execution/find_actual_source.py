import os
import re

def is_actual_code(content, filename):
    # Filter out empty or extremely small files
    if len(content.strip()) < 30:
        return False
        
    # Filter out console outputs or logs
    log_indicators = [
        "npm ERR!",
        "Database initialized successfully",
        "MailFlow server running",
        "node server.js",
        "git init",
        "git add",
        "git commit",
        "Railway URL",
        "Successfully deployed",
        "Listening on port",
        "Scheduler started"
    ]
    for indicator in log_indicators:
        if indicator.lower() in content.lower():
            # Check if it's just a log message, not code containing the string
            if "function" not in content and "const" not in content and "import" not in content:
                return False

    # Check language characteristics
    if filename.endswith('.json') or filename == 'package.js':
        # Should look like JSON
        return content.strip().startswith('{') and content.strip().endswith('}')
        
    if filename.endswith('.js') or filename.endswith('.ts') or filename.endswith('.tsx'):
        # Should contain typical JS keywords
        js_keywords = ['const', 'let', 'var', 'function', 'import', 'export', 'require', 'module.exports', 'return', '=>']
        matches = [kw in content for kw in js_keywords]
        return sum(matches) >= 2

    if filename.endswith('.yaml') or filename.endswith('.yml'):
        return 'services:' in content or 'build:' in content

    return True

def main():
    # Load the mappings we established earlier
    summary_path = r"c:\Users\HP\Downloads\gfg-main\.tmp\mailflow_clean_summary.txt"
    if not os.path.exists(summary_path):
        print("Error: clean summary not found!")
        return

    # Parse clean summary to get block to filename mapping
    block_to_file = {}
    with open(summary_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    current_file = None
    for line in lines:
        if line.startswith("File: "):
            current_file = line.replace("File: ", "").strip()
        elif "Versions in chat:" in line and current_file:
            # Extract block list from line, e.g. "Versions in chat: 2 (Blocks: [121, 122])"
            blocks_match = re.search(r'Blocks:\s*\[(.*?)\]', line)
            if blocks_match:
                block_ids = [int(b.strip()) for b in blocks_match.group(1).split(',')]
                for bid in block_ids:
                    block_to_file[bid] = current_file

    print(f"Loaded {len(block_to_file)} block-to-file mappings.")

    # Now let's scan all blocks in mailflow_code_files
    code_files_dir = r"c:\Users\HP\Downloads\gfg-main\.tmp\mailflow_code_files"
    output_dir = r"c:\Users\HP\Downloads\gfg-main\.tmp\mailflow_source_code"
    os.makedirs(output_dir, exist_ok=True)
    
    file_to_valid_blocks = {}
    
    for filename in sorted(os.listdir(code_files_dir)):
        # Filename format: "{block_num}_{guessed_name}"
        match = re.match(r'^(\d+)_(.*)$', filename)
        if not match:
            continue
            
        block_num = int(match.group(1))
        guessed_name = match.group(2)
        
        # Determine actual filename associated with this block
        mapped_name = block_to_file.get(block_num, guessed_name)
        
        # Read content
        filepath = os.path.join(code_files_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Verify if it is actual code
        if is_actual_code(content, mapped_name):
            if mapped_name not in file_to_valid_blocks:
                file_to_valid_blocks[mapped_name] = []
            file_to_valid_blocks[mapped_name].append((block_num, content))

    # Save the latest valid code block for each file
    print("\nSaving latest valid source code files:")
    print("=" * 80)
    
    for file_name, blocks in sorted(file_to_valid_blocks.items()):
        # Normalize package.js to package.json if it looks like json
        save_name = file_name
        if file_name == 'package.js':
            save_name = 'package.json'
            
        latest_block_num, code_content = blocks[-1]
        
        local_path = os.path.join(output_dir, save_name)
        local_dir = os.path.dirname(local_path)
        os.makedirs(local_dir, exist_ok=True)
        
        with open(local_path, 'w', encoding='utf-8') as f_out:
            f_out.write(code_content)
            
        print(f"File: {save_name} (Latest Block: {latest_block_num}, size: {len(code_content)} bytes) -> Saved to {local_path}")

if __name__ == "__main__":
    main()
