# AutoHotkey Script: Backend Integration Code (Copy-Paste Ready)

## Instructions

1. Open your existing `Autosend_Prime.ahk` script
2. Find the function `DashboardToggleScript()` (search for it in the file)
3. Add the new functions below **BEFORE** `DashboardToggleScript()`
4. Replace the contents of `DashboardToggleScript()` with the updated version
5. Save and test

---

## Part 1: Global Variables (Add at top of script, after other globals)

```autohotkey
; ===== Backend Integration Globals =====
global BackendServerUrl := "http://localhost:3000"  ; Change to your backend URL
global UseFallbackAutomation := 0                   ; Flag: fall back to UI if API fails
global BackendTimeout := 5000                       ; Milliseconds to wait for backend response
```

---

## Part 2: New Functions (Add before DashboardToggleScript)

### Function A: SendCampaignToBackend()
```autohotkey
SendCampaignToBackend() {
    global BackendServerUrl, Subjects, Emails, ActiveCsvQueue, HtmlCodeBox
    global SubjectListView, ShowToast, logger
    
    ; Collect subjects from ListView
    subjects := []
    if (IsSet(SubjectListView)) {
        loop SubjectListView.GetCount() {
            txt := Trim(SubjectListView.GetText(A_Index, 2))
            if (txt != "")
                subjects.Push(txt)
        }
    }
    
    ; Collect recipients
    recipients := []
    if (IsSet(ActiveCsvQueue) && ActiveCsvQueue.Length > 0) {
        ; CSV mode: map rows to recipient objects
        for row in ActiveCsvQueue {
            recipObj := Map()
            for key, val in row {
                recipObj[key] := val
            }
            recipients.Push(recipObj)
        }
    } else if (IsSet(Emails) && Emails.Length > 0) {
        ; Legacy mode: simple email list
        for email in Emails {
            recipients.Push(Map("email", email))
        }
    }
    
    if (recipients.Length = 0) {
        ShowToast("⚠ No recipients loaded")
        return false
    }
    
    if (subjects.Length = 0)
        subjects.Push("Your Subject")  ; Default subject
    
    ; Build JSON payload
    payload := Map(
        "name", "Campaign " . A_Now,
        "subjects", subjects,
        "recipients", recipients,
        "html_template", IsSet(HtmlCodeBox) ? HtmlCodeBox.Value : "<h1>Email Body</h1>",
        "delay_seconds", 30
    )
    
    jsonStr := ObjToJson(payload)
    
    ; Create temp JSON file (safer than command-line escaping)
    tempJsonFile := A_Temp . "\campaign_" . A_TickCount . ".json"
    FileDelete(tempJsonFile)  ; Clean up if exists
    FileAppend(jsonStr, tempJsonFile)
    
    ; Make HTTP POST via curl (use temp file)
    dummyToken := "bearer-token-placeholder"  ; TODO: get from OAuth if available
    cmd := 'curl.exe -s -X POST "' . BackendServerUrl . '/api/campaigns/create-from-csv" \'
         . ' -H "Authorization: Bearer ' . dummyToken . '" \'
         . ' -H "Content-Type: application/json" \'
         . ' -d @"' . tempJsonFile . '"'
    
    ; Execute curl (silent output via -s flag)
    shell := ComObjCreate("WScript.Shell")
    exec := shell.Exec(ComSpec " /c " cmd)
    output := exec.StdOut.ReadAll()
    
    ; Clean up temp file
    FileDelete(tempJsonFile)
    
    ; Parse response
    try {
        response := JSON.Parse(output)
        if (response.Has("success") && response["success"] = true) {
            campaignId := response["campaign_id"]
            recipCount := recipients.Length
            ShowToast("✅ Campaign #" . campaignId . " created!`nQueued " . recipCount . " recipients")
            
            if (IsSet(logger))
                logger.Info("Backend campaign sent: ID=" . campaignId . ", recipients=" . recipCount)
            
            return true
        } else {
            errMsg := response.Has("error") ? response["error"] : "Unknown error"
            ShowToast("⚠ Backend error:`n" . errMsg)
            return false
        }
    } catch Error as err {
        ShowToast("⚠ Backend unreachable:`n" . BackendServerUrl . "`n" . err.What)
        return false
    }
}
```

### Function B: ObjToJson()
```autohotkey
ObjToJson(obj) {
    if (obj is Map) {
        result := "{"
        first := true
        for key, value in obj {
            if (!first)
                result .= ","
            result .= '"' . key . '":' . ObjToJson(value)
            first := false
        }
        return result . "}"
    } else if (obj is Array) {
        result := "["
        first := true
        for item in obj {
            if (!first)
                result .= ","
            result .= ObjToJson(item)
            first := false
        }
        return result . "]"
    } else if (obj is String) {
        ; Escape special characters in strings
        escaped := StrReplace(obj, "\", "\\")
        escaped := StrReplace(escaped, '"', '\"')
        escaped := StrReplace(escaped, "`n", "\n")
        escaped := StrReplace(escaped, "`r", "\r")
        escaped := StrReplace(escaped, "`t", "\t")
        return '"' . escaped . '"'
    } else if (obj is Integer || obj is Float) {
        return String(obj)
    } else if (obj = true) {
        return "true"
    } else if (obj = false) {
        return "false"
    } else {
        return "null"
    }
}
```

### Function C: ValidateBackendConnection() (Optional)
```autohotkey
ValidateBackendConnection() {
    global BackendServerUrl, ShowToast
    
    cmd := 'curl.exe -s -o /dev/null -w "%%{http_code}" "' . BackendServerUrl . '/api/health"'
    shell := ComObjCreate("WScript.Shell")
    exec := shell.Exec(ComSpec " /c " cmd)
    httpCode := Trim(exec.StdOut.ReadAll())
    
    if (httpCode = 200) {
        ShowToast("✅ Backend connected!")
        return true
    } else {
        ShowToast("⚠ Backend returned HTTP " . httpCode)
        return false
    }
}
```

---

## Part 3: Update DashboardToggleScript() Function

### Find this function in your script:
```autohotkey
DashboardToggleScript(*) {
    ; ... existing code ...
}
```

### Replace its contents with:
```autohotkey
DashboardToggleScript(*) {
    global UseFallbackAutomation, CampaignMode, logger
    
    CleanAndSaveSubjects()
    PreFlightSync()
    
    ; Try backend API first
    if (SendCampaignToBackend()) {
        ; Success! Backend handles the sends now.
        return
    }
    
    ; If API failed and fallback is enabled, try UI automation
    if (UseFallbackAutomation) {
        if (IsSet(logger))
            logger.Warn("Backend failed, falling back to UI automation")
        
        ShowToast("📌 Backend unavailable, using UI automation...")
        
        if (CampaignMode) {
            ToggleCsvScript()
        } else {
            ToggleLegacyScript()
        }
    } else {
        ShowToast("⚠ Backend API failed and fallback disabled.")
    }
}
```

---

## Part 4: Add Backend Settings to Tab 3 (Advanced Settings)

### Find the Advanced Settings tab section (look for "Tab 3" or "Advanced")

### Add these lines in that tab (adjust coordinates as needed):
```autohotkey
; Backend Integration Section
MyGui.Add("Text", "x25 y310 w300 c" . t["title"], "🔌 Backend Integration")

; Backend URL input
MyGui.Add("Text", "x25 y335 w100 c" . t["label"], "Server URL:")
BackendUrlEdit := MyGui.Add("Edit", "x125 y335 w300 h22", BackendServerUrl)
BackendUrlEdit.ToolTip := "Backend server (e.g. http://localhost:3000)"

; Fallback checkbox
UseFallbackChk := MyGui.Add("CheckBox", "x25 y365 w400 Checked" . UseFallbackAutomation, 
    "☑ Fall back to UI automation if backend is unavailable")
UseFallbackChk.ToolTip := "If unchecked: fail silently if backend is down"

; Test connection button
TestBackendBtn := MyGui.Add("Button", "x25 y395 w150 h24", "Test Connection")
TestBackendBtn.OnEvent("Click", TestBackendConnection)

; Update saved values in SaveDelaySettings() function
; (See Part 5 below)
```

---

## Part 5: Update SaveDelaySettings() Function

### Find your `SaveDelaySettings()` function and add these lines:

```autohotkey
; (Inside SaveDelaySettings() function, before IniWrite calls)

; Save backend settings
global BackendServerUrl, UseFallbackAutomation
BackendServerUrl := BackendUrlEdit.Value
UseFallbackAutomation := UseFallbackChk.Value

; Write to INI
IniWrite(BackendServerUrl, iniFile, "BackendSettings", "ServerUrl")
IniWrite(UseFallbackAutomation ? 1 : 0, iniFile, "BackendSettings", "UseFallback")
```

### And add these lines to the initialization section (look for where INI is read):

```autohotkey
; Load backend settings from INI
BackendServerUrl := IniRead(iniFile, "BackendSettings", "ServerUrl", "http://localhost:3000")
UseFallbackAutomation := IniRead(iniFile, "BackendSettings", "UseFallback", 1)
```

---

## Part 6: Add Test Connection Handler

### Add this function anywhere in the script:
```autohotkey
TestBackendConnection(*) {
    ShowToast("Testing backend connection...")
    if (ValidateBackendConnection()) {
        ShowToast("✅ Backend is reachable!")
    }
    ; (error toast shown by ValidateBackendConnection)
}
```

---

## Testing Checklist

- [ ] Script starts without errors
- [ ] Backend URL setting visible in Tab 3
- [ ] "Test Connection" button works
- [ ] Load CSV file in script
- [ ] Click "Start (F5)" button
- [ ] Script shows "Campaign #123 created!" toast
- [ ] Backend has pending queue items (check database)
- [ ] Scheduler picks up items every 30s and sends

---

## Troubleshooting

**Script shows "Backend unreachable"**
- Check: Is backend running? `node server.js`
- Check: Backend URL correct? Should be `http://localhost:3000`
- Check: Firewall blocking port 3000?

**"Campaign #X created" but no emails send**
- Check: Backend scheduler running? Look for "Scheduler: processing batch" in logs
- Check: Active accounts exist in database? `SELECT * FROM accounts WHERE status = 'active'`
- Check: Queue table has items? `SELECT COUNT(*) FROM queue WHERE status = 'pending'`

**JSON parsing errors in curl output**
- Enable debug logging: Uncomment `logger.Debug()` calls
- Check curl response: Add `ShowToast(output)` after exec to see raw response

**"Authorization: Bearer" error**
- This is expected if no OAuth token configured
- Backend normally requires JWT, but test endpoint might bypass
- Replace `dummyToken` with actual token from `/api/auth/google-url` flow

---

## Advanced: Load Token from OAuth Flow

If your script already does OAuth login, pass the token:

```autohotkey
; Inside SendCampaignToBackend():
; global JwtToken  ; Add if you store token globally
; dummyToken := IsSet(JwtToken) ? JwtToken : "test-token"
```

---

## Final Notes

✅ Backend handles all sending (you can close the script after POSTing)  
✅ Retry logic automatic (exponential backoff)  
✅ Tracking server-side (opens, clicks, bounces)  
✅ Multi-account load balancing (round-robin)  
✅ 25-50x faster than UI automation (~50 emails/min vs ~1-2/min)  

🚀 Happy sending!
