import subprocess

commands = [
    ("Memory Server", ["npx", "-y", "@modelcontextprotocol/server-memory", "--help"]),
    ("Filesystem Server", ["npx", "-y", "@modelcontextprotocol/server-filesystem", "--help"]),
    ("Brave Search Server", ["npx", "-y", "@modelcontextprotocol/server-brave-search", "--help"]),
    ("Context7 Server", ["npx", "-y", "@upstash/context7-mcp", "--help"]),
    ("Playwright Server", ["npx", "-y", "@playwright/mcp", "--help"])
]

print("Verifying and caching MCP server installations...")
for name, cmd in commands:
    print(f"\n--- Testing {name} ---")
    try:
        # Run command with 15s timeout
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=30, shell=True)
        print(f"Exit code: {res.returncode}")
        print("Stdout (first 3 lines):")
        print("\n".join(res.stdout.splitlines()[:3]))
        if res.stderr:
            print("Stderr (first 3 lines):")
            print("\n".join(res.stderr.splitlines()[:3]))
    except subprocess.TimeoutExpired:
        print("Timeout expired (likely succeeded in downloading but did not exit immediately)")
    except Exception as e:
        print(f"Error running command: {e}")
