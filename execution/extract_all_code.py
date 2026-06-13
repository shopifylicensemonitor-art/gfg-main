import os
import re

def main():
    chat_path = r"c:\Users\HP\Downloads\gfg-main\.tmp\extracted_chat_raw.txt"
    if not os.path.exists(chat_path):
        print("Error: extracted_chat_raw.txt not found!")
        return
        
    with open(chat_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # We want to search for occurrences of:
    # "type exactly:" or "filename box, type exactly:" or "type exactly: <filename>"
    # or just list code blocks.
    # Let's extract all sections of the conversation to see what files are mentioned.
    
    # Let's use regex to find filenames followed by code blocks.
    # For example, "type exactly:\n\n[filename]\n\nThen paste this:\n\n```[lang]\n[code]\n```"
    # or "routes/accounts.js" or "scheduler.js".
    # Let's search for filenames in the text and see if we can locate code blocks right after.
    
    # Actually, let's search for all markdown code blocks (```lang ... ```) in the file
    # and print their surrounding context (500 characters before and after) to see if we can identify what file they belong to.
    
    pattern = r"```([a-zA-Z0-9+#-]+)?\n(.*?)\n```"
    matches = list(re.finditer(pattern, content, re.DOTALL))
    
    print(f"Found {len(matches)} code blocks in the chat.")
    
    output_dir = r"c:\Users\HP\Downloads\gfg-main\.tmp\mailflow_extracted"
    os.makedirs(output_dir, exist_ok=True)
    
    # Let's save each code block with its surrounding context
    with open(r"c:\Users\HP\Downloads\gfg-main\.tmp\extracted_code_blocks_context.txt", "w", encoding="utf-8") as f_out:
        for idx, match in enumerate(matches):
            lang = match.group(1) or "txt"
            code = match.group(2)
            start_pos = match.start()
            
            # Get 400 characters before the match to find the filename
            before = content[max(0, start_pos - 400):start_pos]
            
            f_out.write(f"=== BLOCK {idx+1} (LANG: {lang}) ===\n")
            f_out.write("CONTEXT BEFORE:\n")
            f_out.write(before.strip())
            f_out.write("\n------------------\n")
            f_out.write("CODE PREVIEW (first 5 lines):\n")
            code_lines = code.split("\n")
            f_out.write("\n".join(code_lines[:5]))
            f_out.write("\n\n=====================================\n\n")
            
            # Let's write the code block to a temp file in mailflow_extracted folder
            # If we can guess the file name from before context, use it.
            guessed_name = f"block_{idx+1}.{lang}"
            # Look for filename patterns like "routes/accounts.js" or "server.js" or similar
            filename_matches = re.findall(r'([\w\-]+\.(?:js|json|css|html|ts|tsx))', before)
            # Check for folder structures like routes/contacts.js
            folder_file_matches = re.findall(r'([\w\-]+/\[?[\w\-]+\.?[\w\-]*\]?\.(?:js|json|css|html|ts|tsx|sh))', before)
            # Also check patterns like "routes/accounts" or "scheduler" or "db"
            
            if folder_file_matches:
                guessed_name = folder_file_matches[-1].replace('/', '_')
            elif filename_matches:
                guessed_name = filename_matches[-1]
            
            # Write file
            with open(os.path.join(output_dir, f"{idx+1}_{guessed_name}"), "w", encoding="utf-8") as f_code:
                f_code.write(code)
                
    print(f"Extracted all code blocks to {output_dir}")

if __name__ == "__main__":
    main()
