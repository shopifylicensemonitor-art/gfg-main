import os
import re

def main():
    chat_path = r"c:\Users\HP\Downloads\gfg-main\.tmp\extracted_chat_raw.txt"
    if not os.path.exists(chat_path):
        print("Error: extracted_chat_raw.txt not found!")
        return

    with open(chat_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    print(f"Read {len(lines)} lines of chat history.")

    # Search for files created or discussed
    # We look for lines with patterns like:
    # - "type exactly:"
    # - "routes/"
    # - ".js"
    # - ".json"
    
    file_declarations = []
    for idx, line in enumerate(lines):
        if "type exactly" in line.lower() or "create new file" in line.lower() or "filename box" in line.lower():
            # Gather context of 5 lines before and 10 lines after
            start = max(0, idx - 3)
            end = min(len(lines), idx + 10)
            context = "".join(lines[start:end])
            file_declarations.append((idx + 1, line.strip(), context))

    print(f"Found {len(file_declarations)} file creation markers.")
    
    out_path = r"c:\Users\HP\Downloads\gfg-main\.tmp\file_creation_markers.txt"
    with open(out_path, "w", encoding="utf-8") as f_out:
        for line_num, marker, ctx in file_declarations:
            f_out.write(f"Line {line_num}: {marker}\n")
            f_out.write("CONTEXT:\n")
            f_out.write(ctx)
            f_out.write("\n" + "="*80 + "\n\n")
            
    print(f"Saved markers to {out_path}")

if __name__ == "__main__":
    main()
