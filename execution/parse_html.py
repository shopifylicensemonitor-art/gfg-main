import os
import re
from html.parser import HTMLParser

class ClaudeChatParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.messages = []
        self.current_message = []
        self.in_message = False
        self.message_type = None  # 'user' or 'assistant'
        self.div_depth = 0
        self.message_div_depth = -1

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        
        # Track div depth
        if tag == 'div':
            self.div_depth += 1
            
            # Check for message container
            # Claude.ai messages typically have certain classes or data attributes
            cls = attrs_dict.get('class', '')
            data_testid = attrs_dict.get('data-testid', '')
            
            is_user = 'user' in data_testid or 'user-message' in cls or 'font-user' in cls
            is_assistant = 'assistant' in data_testid or 'claude-message' in cls or 'font-claude' in cls
            
            # Fallback check on classes
            if not is_user and not is_assistant:
                if 'prompt' in cls or 'user-message' in data_testid:
                    is_user = True
                elif 'response' in cls or 'model-message' in data_testid:
                    is_assistant = True
            
            if is_user or is_assistant:
                # If we were already in a message, save it
                if self.in_message:
                    self.save_current_message()
                
                self.in_message = True
                self.message_type = 'user' if is_user else 'assistant'
                self.message_div_depth = self.div_depth
                self.current_message = []

        # Also capture text within code blocks, paragraphs, lists, etc.
        # But only if we are inside a message
        
    def handle_endtag(self, tag):
        if tag == 'div':
            if self.in_message and self.div_depth == self.message_div_depth:
                self.save_current_message()
                self.in_message = False
                self.message_type = None
                self.message_div_depth = -1
            self.div_depth -= 1

    def handle_data(self, data):
        if self.in_message:
            text = data.strip()
            if text:
                self.current_message.append(text)

    def save_current_message(self):
        if self.current_message:
            full_text = "\n".join(self.current_message)
            self.messages.append((self.message_type, full_text))
            self.current_message = []

def main():
    html_path = r"c:\Users\HP\Downloads\Vibe code with me.html"
    if not os.path.exists(html_path):
        print(f"Error: HTML file not found at {html_path}")
        return

    print(f"Reading file: {html_path}...")
    with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
        html_content = f.read()

    print("Parsing HTML...")
    parser = ClaudeChatParser()
    parser.feed(html_content)
    
    # If parser finished but was still in a message
    if parser.in_message:
        parser.save_current_message()

    print(f"Extracted {len(parser.messages)} message blocks.")
    
    # Let's save a raw dump first
    os.makedirs(r"c:\Users\HP\Downloads\gfg-main\.tmp", exist_ok=True)
    out_path = r"c:\Users\HP\Downloads\gfg-main\.tmp\extracted_chat_raw.txt"
    with open(out_path, 'w', encoding='utf-8') as f:
        for i, (msg_type, content) in enumerate(parser.messages):
            f.write(f"=== MESSAGE {i+1} ({msg_type.upper()}) ===\n")
            f.write(content)
            f.write("\n\n")
            
    print(f"Saved raw extract to: {out_path}")

    # If messages is empty, let's try a regex fallback on the file since Claude markup can be complex
    if not parser.messages:
        print("Parser found no message structures. Running regex heuristic fallback...")
        # Search for text around typical Claude markers or just grab all paragraphs/code
        # Let's search for "data-testid" or classes
        user_msgs = re.findall(r'data-testid="user-message"[^>]*>(.*?)</div>', html_content, re.DOTALL)
        assistant_msgs = re.findall(r'data-testid="assistant-message"[^>]*>(.*?)</div>', html_content, re.DOTALL)
        print(f"Regex found {len(user_msgs)} user messages and {len(assistant_msgs)} assistant messages.")
        
        # Let's also do a simple text strip of all script/style and dump readable lines
        # clean html
        clean_text = re.sub(r'<script.*?</script>', '', html_content, flags=re.DOTALL)
        clean_text = re.sub(r'<style.*?</style>', '', clean_text, flags=re.DOTALL)
        clean_text = re.sub(r'<[^>]+>', ' ', clean_text)
        clean_text = re.sub(r'\s+', ' ', clean_text)
        
        fallback_path = r"c:\Users\HP\Downloads\gfg-main\.tmp\extracted_text_fallback.txt"
        with open(fallback_path, 'w', encoding='utf-8') as f:
            f.write(clean_text[:100000]) # write first 100k chars
        print(f"Saved text fallback sample to: {fallback_path}")

if __name__ == "__main__":
    main()
