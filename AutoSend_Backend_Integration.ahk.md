# AutoHotkey → Backend Integration Guide

## Summary
The existing `Autosend_Prime.ahk` script automates Gmail UI by clicking/pasting. The backend now accepts campaign data via `/api/campaigns/create-from-csv` endpoint, which:
- Creates a campaign in draft mode
- Queues all recipients atomically with round-robin account assignment
- Returns campaign ID for polling/tracking

## Integration Pattern

### Option A: UI Automation Fallback (Safest)
**Default behavior:**
1. AutoHotkey collects CSV data, subjects, HTML from UI
2. POSTs to `/api/campaigns/create-from-csv`
3. On success → shows campaign ID, script exits (backend sends asynchronously)
4. On failure → falls back to UI automation (optional, checkbox in settings)

**Workflow:**
- User loads CSV in AutoHotkey
- Clicks "Start (F5)"
- Script POSTs campaign data to backend
- Backend returns campaign ID
- Toast shows "Campaign #123 queued!" → backend handles sends
- Optionally: if checkbox enabled AND backend unreachable → fall back to UI loop

### Option B: API-Only (No Fallback)
- Script ONLY sends to backend
- If backend is down → show error, do nothing
- User must have backend running at configured URL

---

## Required Code Changes to Script

### 1. Add Global Server Config
```ahk
global BackendServerUrl := "http://localhost:3000"  ; Set at top of script
global UseFallbackAutomation := 0  ; Checkbox: fall back to UI if API fails
```

### 2. Add Backend Integration Function
```ahk
SendCampaignToBackend() {
    global BackendServerUrl, Subjects, Emails, CsvRows, HtmlCodeBox, ActiveCsvQueue
    global StatusText, ShowToast, ProgressBar
    
    ; Collect subjects from ListView
    subjects := []
    loop SubjectListView.GetCount() {
        txt := Trim(SubjectListView.GetText(A_Index, 2))
        if (txt != "")
            subjects.Push(txt)
    }
    
    ; Collect recipients from ActiveCsvQueue (CSV mode) or Emails (legacy)
    recipients := []
    if (ActiveCsvQueue.Length > 0) {
        ; CSV mode: map ActiveCsvQueue rows to recipient objects
        for row in ActiveCsvQueue {
            recipObj := Map()
            for key, val in row {
                recipObj[key] := val
            }
            recipients.Push(recipObj)
        }
    } else if (Emails.Length > 0) {
        ; Legacy mode: convert email list to recipient objects
        for email in Emails {
            recipients.Push(Map("email", email))
        }
    } else {
        ShowToast("⚠ No recipients loaded")
        return false
    }
    
    ; Build JSON payload
    payload := Map(
        "name", A_Now,  ; or let user enter campaign name
        "subjects", subjects,
        "recipients", recipients,
        "html_template", HtmlCodeBox.Value,
        "delay_seconds", 30
    )
    
    jsonStr := ObjToJson(payload)
    
    ; Make HTTP POST via curl
    cmd := 'curl.exe -X POST "' BackendServerUrl '/api/campaigns/create-from-csv" -H "Content-Type: application/json" -d ' . Chr(34) . jsonStr . Chr(34)
    
    shell := ComObjCreate("WScript.Shell")
    exec := shell.Exec(ComSpec " /c " cmd)
    output := exec.StdOut.ReadAll()
    
    try {
        response := JSON.Parse(output)
        if (response.success) {
            campaignId := response.campaign_id
            ShowToast("✅ Campaign #" campaignId " created! Backend will send asynchronously.")
            return true
        } else {
            ShowToast("⚠ Backend error: " response.error)
            return false
        }
    } catch {
        ShowToast("⚠ Backend unreachable at " BackendServerUrl)
        return false
    }
}

; JSON helper (simple object-to-JSON serializer)
ObjToJson(obj) {
    if (obj is Map) {
        result := "{"
        for key, value in obj {
            result .= '"' key '":' ObjToJson(value) ","
        }
        return Trim(result, ",") "}"
    } else if (obj is Array) {
        result := "["
        for item in obj {
            result .= ObjToJson(item) ","
        }
        return Trim(result, ",") "]"
    } else if (obj is String) {
        return '"' StrReplace(obj, '"', '\"') '"'
    } else {
        return obj  ; numbers, booleans
    }
}
```

### 3. Update DashboardToggleScript()
```ahk
DashboardToggleScript(*) {
    global UseFallbackAutomation
    
    CleanAndSaveSubjects()
    PreFlightSync()
    
    ; Try backend first
    if (SendCampaignToBackend()) {
        return  ; Success, exit
    }
    
    ; Fall back to UI automation if checkbox enabled
    if (UseFallbackAutomation) {
        ShowToast("Falling back to UI automation...")
        if (CampaignMode) {
            ToggleCsvScript()
        } else {
            ToggleLegacyScript()
        }
    }
}
```

### 4. Add Backend Settings Tab Control
```ahk
; In Tab 3 (Advanced Settings):
MyGui.Add("Text", "x25 y310 w200 c" t["title"], "Backend Integration")
BackendUrlEdit := MyGui.Add("Edit", "x25 y335 w400 h22", BackendServerUrl)
BackendUrlEdit.ToolTip := "Backend server URL (e.g. http://localhost:3000)"
UseFallbackChk := MyGui.Add("CheckBox", "x25 y365 w280 Checked" UseFallbackAutomation, "Fall back to UI automation if backend fails")

; In SaveDelaySettings():
BackendServerUrl := BackendUrlEdit.Value
UseFallbackAutomation := UseFallbackChk.Value
```

---

## Backend Endpoint Specification

**POST** `/api/campaigns/create-from-csv`

**Request Body:**
```json
{
  "name": "Campaign Name",
  "subjects": ["Subject 1", "Subject 2"],
  "recipients": [
    { "email": "user1@example.com", "name": "John", "store": "MyStore" },
    { "email": "user2@example.com", "name": "Jane", "store": "OtherStore" }
  ],
  "html_template": "<h1>Hello {name}</h1><p>Your store: {store}</p>",
  "account_id": null,
  "delay_seconds": 30,
  "start_time": "08:00",
  "end_time": "22:00"
}
```

**Response (Success):**
```json
{
  "success": true,
  "campaign_id": 42,
  "message": "Campaign \"Campaign Name\" created with 2 recipients queued (draft mode)."
}
```

**Response (Error):**
```json
{
  "error": "No active sender accounts available."
}
```

---

## Workflow After Integration

1. **User opens script** → loads existing UI
2. **Sets up campaign**:
   - Browse/paste CSV
   - Edit subjects (ListView)
   - Edit HTML template
   - (Optional) configure backend URL in Tab 3
3. **Clicks "Start (F5)"**
   - Script collects CSV, subjects, HTML
   - POSTs to backend at `/api/campaigns/create-from-csv`
   - Backend creates campaign + queues all recipients atomically
   - Backend response returns campaign ID
4. **Script shows success toast** with campaign ID
5. **Backend scheduler** (every 30s) picks up pending items and sends via SMTP/Gmail API
6. **Tracking** happens server-side (opens, clicks, bounces)

---

## Advantages

✅ **Backend handles sends** — no more single-machine UI automation bottleneck  
✅ **Atomic queuing** — no race conditions on daily-sent limits  
✅ **Automatic retries** — exponential backoff built in  
✅ **Tracking** — server-side pixel tracking + click wrapping  
✅ **Multi-account round-robin** — distributes load across accounts  
✅ **Fallback safety** — script can still do UI automation if backend is down  
✅ **Faster sends** — backend can send 50+ emails/min vs. UI tempo of ~30-60s/email  

---

## Implementation Checklist

- [ ] Add `SendCampaignToBackend()` function to script
- [ ] Add `BackendServerUrl` and `UseFallbackAutomation` globals
- [ ] Add backend URL input + fallback checkbox to Tab 3
- [ ] Update `DashboardToggleScript()` to call backend first
- [ ] Update `SaveDelaySettings()` to save backend URL
- [ ] Test: POSTs campaign data to `/api/campaigns/create-from-csv`
- [ ] Test: handles backend success (shows campaign ID)
- [ ] Test: handles backend error (shows error or falls back)
- [ ] Backend queues recipients and scheduler picks them up
- [ ] Verify sent_log.csv is created with sent emails

---

## Quick Start (Development)

```powershell
# Terminal 1: Start backend
$env:USE_SQLITE = 'true'
$env:LOG_LEVEL = 'debug'
node server.js

# Terminal 2: Run script (after adding code changes above)
AutoSend_Backend_Integration.ahk

# GUI opens → Load CSV → Edit subjects → Click Start (F5)
# Backend receives campaign → Queues recipients → Scheduler sends
```

Done — script now delegates sending to backend API! 🚀
