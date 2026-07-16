# Quick Start: Backend Integration (3 Steps)

## Overview
You now have:
- ✅ Backend endpoint `/api/campaigns/create-from-csv` (ready)
- ✅ AutoHotkey integration guide (ready)
- ✅ Test script (ready)
- ⏳ AutoHotkey script updates (copy-paste code provided)

---

## Step 1: Start Backend Server

**Terminal Window 1:**
```powershell
cd c:\Users\HP\Downloads\gfg-main
$env:USE_SQLITE = 'true'
$env:LOG_LEVEL = 'debug'
node server.js
```

**Expected Output:**
```
[INFO] Server listening on port 3000
[INFO] Scheduler started (batch every 30s)
[INFO] Database initialized (SQLite)
```

---

## Step 2: Test Endpoint (Validate Backend Works)

**Terminal Window 2:**
```powershell
cd c:\Users\HP\Downloads\gfg-main
.\test_backend_campaign_api.ps1
```

**Expected Output:**
```
✅ Got token: ...
✅ Campaign created: ID=42
✅ Campaign in database (status=draft, 3 recipients)
✅ All tests completed!
```

If test passes → Backend is ready ✅

---

## Step 3: Update AutoHotkey Script

1. **Open** `Autosend_Prime.ahk` in your editor
2. **Copy functions** from `AutoHotkey_Backend_Integration_Code.md`
3. **Paste** into your script:
   - Add global variables (top of script)
   - Add `SendCampaignToBackend()` function
   - Add `ObjToJson()` function
   - Add `ValidateBackendConnection()` function
   - Replace `DashboardToggleScript()` contents
   - Add Tab 3 settings controls
   - Update `SaveDelaySettings()` function
4. **Save** script
5. **Run** script (AutoHotkey will execute it)

---

## Test the Integration

**In AutoHotkey Script:**
1. ✓ Click "Advanced Settings" tab (Tab 3)
2. ✓ Verify Backend Server URL = `http://localhost:3000`
3. ✓ Click "Test Connection" button
4. ✓ Load a CSV file (or paste test data)
5. ✓ Click "Start (F5)" button
6. ✓ Should see: **"✅ Campaign #42 created!"** toast

**In Backend:**
- Check `queue` table: `SELECT COUNT(*) FROM queue WHERE status = 'pending'` should show `N` rows
- Scheduler picks them up every 30s: look for `[INFO] Scheduler: processing batch` in logs
- Emails sent: `SELECT COUNT(*) FROM queue WHERE status = 'sent'` increases over time

---

## File Reference

| File | Purpose | Action |
|------|---------|--------|
| `routes/campaigns.js` | Backend endpoint | ✅ Already modified |
| `test_backend_campaign_api.ps1` | Validation test | ✅ Run to verify |
| `AutoHotkey_Backend_Integration_Code.md` | Integration code | ⏳ Copy into script |
| `AutoSend_Backend_Integration.ahk.md` | Full guide | 📖 Reference |
| `INTEGRATION_SUMMARY.md` | Architecture + details | 📖 Reference |

---

## What Happens When User Clicks "Start (F5)"

```
User Machine                        Backend Server
================                    ==============
1. Collect CSV data
2. Collect subjects
3. Collect HTML
       │
       ├─→ POST /api/campaigns/create-from-csv
       │                          ├─ Validate data
       │                          ├─ Create campaign (draft)
       │                          ├─ Queue all recipients (atomic)
       │                          └─ Return campaign_id
       │
4. Show "Campaign #42 created!"
5. Script exits
                                   6. Scheduler (30s interval)
                                      ├─ Pick up pending items
                                      ├─ Reserve daily-sent slot
                                      ├─ Send via SMTP/Gmail
                                      ├─ Log opens/clicks
                                      └─ Retry if needed
```

---

## Verify Everything Works

**Backend Logs Should Show:**
```
[DEBUG] POST /api/campaigns/create-from-csv
[DEBUG] Created campaign 42 with 100 recipients
[INFO] Scheduler: processing batch...
[INFO] Account 1: reserving slot for email@example.com
[INFO] Email sent: email@example.com (Campaign 42)
[DEBUG] Tracking pixel: /api/track/{token}
```

**Database Should Show:**
```sql
-- Campaign created:
SELECT * FROM campaigns WHERE id = 42;
-- Result: status='draft', total_contacts=100

-- Recipients queued:
SELECT COUNT(*) FROM queue WHERE campaign_id = 42 AND status = 'pending';
-- Result: 100

-- Emails sent:
SELECT COUNT(*) FROM queue WHERE campaign_id = 42 AND status = 'sent';
-- Result: increases every 30 seconds
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Backend unreachable" | 1) Check `node server.js` is running. 2) Check URL is `http://localhost:3000`. 3) Check Windows firewall allows port 3000. |
| Script crashes on Start | 1) Check syntax errors with `Ctrl+Shift+O` in AutoHotkey. 2) Check all functions were copied. 3) Check JSON parsing (ensure `ObjToJson()` added). |
| Campaign created but no emails | 1) Check scheduler running: look for "processing batch" in logs. 2) Check accounts: `SELECT COUNT(*) FROM accounts WHERE status='active'` should be > 0. 3) Check queue: `SELECT COUNT(*) FROM queue WHERE status='pending'` should match. |
| curl: command not found | Add curl to PATH: `choco install curl` or download from curl.se |
| "Authorization: Bearer" error | 1) This is expected if no JWT configured. 2) Update script to pass real token if available, or bypass auth in test. |

---

## Next: Performance Validation

Once integration works:

**Run Load Test:**
```powershell
# Create 1000 recipients and send
$recipients = @()
for ($i=1; $i -le 1000; $i++) {
    $recipients += @{ email = "user$i@test.com"; name = "User $i" }
}

# POST to backend (measure time)
$start = [DateTime]::Now
curl -X POST "http://localhost:3000/api/campaigns/create-from-csv" `
  -H "Authorization: Bearer token" `
  -H "Content-Type: application/json" `
  -d (ConvertTo-Json -Depth 10 @{
    name = "Load Test"
    subjects = @("Subject")
    recipients = $recipients
    html_template = "<h1>Test</h1>"
  })
$elapsed = ([DateTime]::Now - $start).TotalSeconds
Write-Host "Created 1000-recipient campaign in $elapsed seconds"

# Monitor scheduler throughput (open new terminal)
$env:LOG_LEVEL = 'debug'
node server.js | Select-String "Email sent"  # Count sends per 30s interval
```

---

## Performance Expectations

- **Campaign creation:** 1-2 seconds (1000 recipients)
- **Queuing:** Atomic in single DB transaction
- **Send rate:** 50+ emails/minute (3 workers × batch of 10+ per 30s cycle)
- **Total time for 1000 emails:** ~20 minutes (at 50/min with retries)

Compare to UI automation:
- Script-driven: ~30-60s per email = 1000+ minutes (unacceptable)
- Backend: ~20 minutes with automatic retries and tracking ✅

---

## Final Checklist

- [ ] Backend server running (`node server.js`)
- [ ] Test script passes (`.\test_backend_campaign_api.ps1`)
- [ ] AutoHotkey script updated (functions + settings)
- [ ] AutoHotkey script starts without errors
- [ ] Load CSV file in script
- [ ] Click "Start (F5)" → shows "Campaign #X created!"
- [ ] Queue table has pending items
- [ ] Scheduler logs show "Email sent" messages
- [ ] Emails arrive in test inbox

---

**🎉 Integration complete! Your backend is now handling sends asynchronously with automatic retries, tracking, and multi-account load balancing.**

Questions? Check:
- `INTEGRATION_SUMMARY.md` (architecture details)
- `AutoSend_Backend_Integration.ahk.md` (full guide)
- Backend logs: `$env:LOG_LEVEL = 'debug'; node server.js`
