# AutoHotkey Backend Integration Guide

This guide provides a comprehensive approach to connecting your AutoHotkey desktop automation scripts to a backend Node.js API server, enabling you to trigger bulk email campaigns via API instead of relying on UI automation.

---

## Part 1: Global Variables

Define these at the top of your AutoHotkey script:

```autohotkey
; Backend API Configuration
BackendServerUrl := "http://localhost:3000"  ; Change to your server URL
UseFallbackAutomation := true  ; If true, falls back to UI automation if API fails
BackendTimeout := 30000  ; Timeout in milliseconds (30 seconds)
```

---

## Part 2: Core Functions

### 2.1 SendCampaignToBackend()

This is the main function that collects data from your ListView and sends it to the backend:

```autohotkey
SendCampaignToBackend()
{
    global BackendServerUrl, BackendTimeout
    
    ; Collect subjects from ListView
    subjects := []
    Loop, Parse, A_LoopReadLine
    {
        ; Assuming subjects are in column 1
        LV_GetText(subject, A_Index, 1)
        if (subject != "")
            subjects.Push(subject)
    }
    
    ; Collect recipients from ListView
    recipients := []
    LV_GetText(recipientData, , 2)  ; Column 2
    if (recipientData != "")
    {
        Loop, Parse, recipientData, ","
        {
            recipient := Trim(A_LoopField)
            if (recipient != "")
                recipients.Push(recipient)
        }
    }
    
    ; Build JSON payload
    payload := ObjToJson({
        subjects: subjects,
        recipients: recipients,
        timestamp: A_Now,
        campaignName: "Bulk Email Campaign"
    })
    
    ; Send to backend via curl
    RunWait, powershell.exe -NoProfile -Command "
        (
            $headers = @{
                'Authorization' = 'Bearer YOUR_API_TOKEN'
                'Content-Type' = 'application/json'
            }
            
            $body = @'
%payload%
'@
            
            try {
                $response = Invoke-WebRequest `
                    -Uri '%BackendServerUrl%/api/campaigns/create-from-csv' `
                    -Method POST `
                    -Headers $headers `
                    -Body $body `
                    -TimeoutSec 30
                
                Write-Output $response.Content
            }
            catch {
                Write-Output "Error: $($_.Exception.Message)"
            }
        )
    ", output
    
    ; Parse response
    if (output ~= "success|created|200")
    {
        MsgBox, 64, Success, Campaign sent successfully to backend!
        return true
    }
    else
    {
        MsgBox, 48, Error, Backend request failed.`nResponse: %output%
        return false
    }
}
```

### 2.2 ObjToJson()

Converts AutoHotkey objects/arrays to JSON format:

```autohotkey
ObjToJson(obj)
{
    if (obj == "")
        return ""
    
    type := obj.GetType()
    
    if (type == "Array")
    {
        result := "["
        Loop, % obj.Length
        {
            if (A_Index > 1)
                result .= ","
            result .= ObjToJson(obj[A_Index])
        }
        result .= "]"
        return result
    }
    else if (type == "Object" || type == "Map")
    {
        result := "{"
        first := true
        for key, value in obj
        {
            if (!first)
                result .= ","
            first := false
            result .= """" . EscapeJson(key) . """:"
            result .= ObjToJson(value)
        }
        result .= "}"
        return result
    }
    else if (obj is number)
        return obj
    else
        return """" . EscapeJson(obj) . """"
}

EscapeJson(str)
{
    str := StrReplace(str, "\", "\\")
    str := StrReplace(str, """", "\""")
    str := StrReplace(str, "`n", "\n")
    str := StrReplace(str, "`r", "\r")
    str := StrReplace(str, A_Tab, "\t")
    return str
}
```

### 2.3 ValidateBackendConnection()

Tests connectivity to the backend server:

```autohotkey
ValidateBackendConnection()
{
    global BackendServerUrl, BackendTimeout
    
    RunWait, powershell.exe -NoProfile -Command "
        (
            try {
                $response = Invoke-WebRequest `
                    -Uri '%BackendServerUrl%/api/health' `
                    -Method GET `
                    -TimeoutSec 5
                
                if ($response.StatusCode -eq 200) {
                    Write-Output 'Connected'
                }
            }
            catch {
                Write-Output 'Failed'
            }
        )
    ", output
    
    if (output == "Connected")
    {
        MsgBox, 64, Success, Backend server is reachable!
        return true
    }
    else
    {
        MsgBox, 48, Error, Cannot reach backend server at %BackendServerUrl%
        return false
    }
}
```

---

## Part 3: Updated DashboardToggleScript()

Modify your main campaign trigger to use the backend first:

```autohotkey
DashboardToggleScript()
{
    global UseFallbackAutomation
    
    ; Try backend API first
    success := SendCampaignToBackend()
    
    ; Fall back to UI automation if API fails
    if (!success && UseFallbackAutomation)
    {
        MsgBox, 36, Fallback, Backend failed. Use UI automation?
        IfMsgBox, Yes
        {
            ; Call your original UI automation code here
            RunOriginalAutomation()
        }
    }
    else if (success)
    {
        MsgBox, 64, Complete, Campaign processed via backend!
    }
}

RunOriginalAutomation()
{
    ; Your original AutoHotkey UI automation code here
}
```

---

## Part 4: UI Settings in Tab 3 (Advanced Settings)

Add these controls to your GUI for backend configuration:

```autohotkey
Gui, Add, GroupBox, x10 y200 w500 h150, Backend Configuration
Gui, Add, Text, x20 y220, Backend Server URL:
Gui, Add, Edit, x20 y240 w470 v_BackendUrl, http://localhost:3000

Gui, Add, Text, x20 y270, API Token:
Gui, Add, Edit, x20 y290 w470 v_ApiToken Password, 

Gui, Add, CheckBox, x20 y320 v_UseFallback checked, Use UI fallback if API fails

Gui, Add, Button, x20 y350 w100 h30 gTestBackendConnection, Test Connection
```

---

## Part 5: INI Configuration

Save backend settings to your INI file:

```autohotkey
SaveBackendSettings()
{
    Gui, Submit, NoHide
    
    IniWrite, %_BackendUrl%, MyConfig.ini, Backend, ServerUrl
    IniWrite, %_UseFallback%, MyConfig.ini, Backend, UseFallback
    
    MsgBox, 64, Saved, Backend settings saved!
}

LoadBackendSettings()
{
    IniRead, BackendServerUrl, MyConfig.ini, Backend, ServerUrl, http://localhost:3000
    IniRead, UseFallbackAutomation, MyConfig.ini, Backend, UseFallback, true
}
```

---

## Part 6: Test Connection Handler

Add this button handler to test the connection:

```autohotkey
TestBackendConnection:
{
    ValidateBackendConnection()
    return
}
```

---

## Backend API Endpoint Requirements

Your Node.js backend should implement:

### POST /api/campaigns/create-from-csv

**Request:**
```json
{
  "subjects": ["Subject 1", "Subject 2"],
  "recipients": ["email1@example.com", "email2@example.com"],
  "timestamp": "20231215143022",
  "campaignName": "Campaign Name"
}
```

**Response:**
```json
{
  "success": true,
  "campaignId": "unique-id",
  "message": "Campaign created successfully"
}
```

### GET /api/health

Returns HTTP 200 if the backend is operational.

---

## Integration Summary

1. **Add the functions** (SendCampaignToBackend, ObjToJson, ValidateBackendConnection) to your script
2. **Configure globals** with your backend server URL
3. **Update your main trigger** to call SendCampaignToBackend() first
4. **Add UI controls** for backend configuration in your settings tab
5. **Test the connection** before running campaigns
6. **Implement the backend API** endpoints documented above

This approach gives you the flexibility to use backend API by default while falling back to UI automation if needed, making your campaigns more robust and scalable.
