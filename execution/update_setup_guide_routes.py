import os
import re

def main():
    root_dir = r"c:\Users\HP\Downloads\gfg-main"
    guide_path = os.path.join(root_dir, "SETUP_GUIDE.md")

    if not os.path.exists(guide_path):
        print(f"Error: {guide_path} not found.")
        return

    with open(guide_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Define the mapping between target section headers and files relative to root
    # Value is a tuple: (relative_file_path, language)
    mapping = {
        # Section 5: Backend Core Implementations
        r"### 5\.1 Logger Config \(`logger\.js`\)": ("logger.js", "javascript"),
        r"### 5\.2 Session Middleware \(`middleware/session\.js`\)": ("middleware/session.js", "javascript"),
        r"### 5\.3 Database Adapter \(`db\.js`\)": ("db.js", "javascript"),
        r"### 5\.4 Server Entry \(`server\.js`\)": ("server.js", "javascript"),
        r"### 5\.5 Admin Session Login Route \(`routes/auth\.js`\)": ("routes/auth.js", "javascript"),
        r"### 5\.6 Connected Sender Accounts \(`routes/accounts\.js`\)": ("routes/accounts.js", "javascript"),
        r"### 5\.7 Campaigns \(`routes/campaigns\.js`\)": ("routes/campaigns.js", "javascript"),
        r"### 5\.8 Contacts \(`routes/contacts\.js`\)": ("routes/contacts.js", "javascript"),
        r"### 5\.9 Open & Link Redirection Click Tracker \(`routes/tracking\.js`\)": ("routes/tracking.js", "javascript"),
        r"#### Queue Router \(`routes/queue\.js`\)": ("routes/queue.js", "javascript"),
        r"#### Templates Router \(`routes/templates\.js`\)": ("routes/templates.js", "javascript"),
        
        # Section 6: Background Scheduler & Personalization
        r"### 6\.1 Spintax Personalizer \(`execution/spintax\.js`\)": ("execution/spintax.js", "javascript"),
        r"### 6\.2 Scheduler Service \(`scheduler\.js`\)": ("scheduler.js", "javascript"),
        
        # Section 7: Frontend API Client Integration
        r"## 7\. Frontend API Client Integration": ("gfg-main/src/api.ts", "typescript"),
    }

    modified_content = content

    for header_pattern, (rel_path, lang) in mapping.items():
        file_path = os.path.join(root_dir, rel_path)
        if not os.path.exists(file_path):
            print(f"Warning: file {file_path} not found. Skipping...")
            continue

        with open(file_path, "r", encoding="utf-8", errors="ignore") as rf:
            file_code = rf.read().strip()

        # Find the header section, and then find the first ```lang ... ``` following it
        pattern = re.compile(
            rf"({header_pattern}.*?```{lang}\n)(.*?)(```)",
            re.DOTALL
        )

        match = pattern.search(modified_content)
        if match:
            # Replace the old code block with the new file code
            modified_content = pattern.sub(
                lambda m: m.group(1) + file_code + "\n" + m.group(3),
                modified_content,
                count=1
            )
            print(f"Successfully updated code block for {rel_path} in guide.")
        else:
            print(f"Error: Could not locate code block for pattern: {header_pattern} with language: {lang}")

    with open(guide_path, "w", encoding="utf-8") as f:
        f.write(modified_content)

    print("Update complete!")

if __name__ == "__main__":
    main()
