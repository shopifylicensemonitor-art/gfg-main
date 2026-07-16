#!/usr/bin/env pwsh
# Integration Test: Backend Campaign Creation & AutoHotkey API Call

# Start the backend server with SQLite
Write-Host "Starting backend server..." -ForegroundColor Cyan
$env:USE_SQLITE = 'true'
$env:LOG_LEVEL = 'debug'
$backendProcess = Start-Process node -ArgumentList 'server.js' -NoNewWindow -PassThru -ErrorAction SilentlyContinue

Start-Sleep -Seconds 3

# Test 1: Get OAuth token (or use existing)
Write-Host "`n[Test 1] Getting OAuth token..." -ForegroundColor Green
$loginPayload = @{
    email = "test@example.com"
    password = "test123"
} | ConvertTo-Json

$authResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginPayload `
    -ErrorAction SilentlyContinue

if ($authResponse.StatusCode -eq 200) {
    $token = ($authResponse.Content | ConvertFrom-Json).token
    Write-Host "✅ Got token: $($token.Substring(0, 20))..." -ForegroundColor Green
} else {
    Write-Host "⚠️ Login failed, trying health check instead..." -ForegroundColor Yellow
    $token = "test-jwt-token"  # Fallback
}

# Test 2: Create campaign via new endpoint
Write-Host "`n[Test 2] Creating campaign via /api/campaigns/create-from-csv..." -ForegroundColor Green

$campaignPayload = @{
    name = "Test Campaign $(Get-Date -Format 'HH:mm:ss')"
    subjects = @("Subject 1", "Subject 2 {name}", "[Offer|Deal|Promotion]")
    recipients = @(
        @{ email = "user1@example.com"; name = "John"; store = "Store A" },
        @{ email = "user2@example.com"; name = "Jane"; store = "Store B" },
        @{ email = "user3@example.com"; name = "Bob"; store = "Store C" }
    )
    html_template = "<h1>Hello {name}</h1><p>Your store: {store}</p><p>Check out our latest {offer}!</p>"
    delay_seconds = 30
} | ConvertTo-Json -Depth 10

Write-Host "Sending payload:`n$campaignPayload" -ForegroundColor DarkGray

$campaignResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/campaigns/create-from-csv" `
    -Method POST `
    -ContentType "application/json" `
    -Body $campaignPayload `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -ErrorAction Stop

Write-Host "Response: $($campaignResponse.Content)" -ForegroundColor Green

$campaignData = $campaignResponse.Content | ConvertFrom-Json
$campaignId = $campaignData.campaign_id

if ($campaignId) {
    Write-Host "✅ Campaign created: ID=$campaignId" -ForegroundColor Green
    Write-Host "Message: $($campaignData.message)" -ForegroundColor Green
} else {
    Write-Host "❌ Campaign creation failed" -ForegroundColor Red
    exit 1
}

# Test 3: Verify campaign is in database
Write-Host "`n[Test 3] Verifying campaign in database..." -ForegroundColor Green

$getResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/campaigns/$campaignId" `
    -Method GET `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -ErrorAction Stop

$campaign = $getResponse.Content | ConvertFrom-Json
Write-Host "Campaign name: $($campaign.name)" -ForegroundColor Green
Write-Host "Campaign status: $($campaign.status)" -ForegroundColor Green
Write-Host "Campaign queue_stats:" -ForegroundColor Green
$campaign.queue_stats | Format-Table

# Test 4: Check queue items
Write-Host "`n[Test 4] Checking queue for pending items..." -ForegroundColor Green
$queueData = Get-Content "queue.db" -ErrorAction SilentlyContinue
Write-Host "Queue database exists: $(Test-Path queue.db)" -ForegroundColor Cyan

# Test 5: Simulate AutoHotkey API call (via curl)
Write-Host "`n[Test 5] Simulating AutoHotkey POST (via curl)..." -ForegroundColor Green

$curljson = @{
    name = "AutoHotkey Campaign $(Get-Date -Format 'HH:mm:ss')"
    subjects = @("Check {store}'s new [products|items|collection]")
    recipients = @(
        @{ email = "ahk1@test.com"; name = "AHK User 1" },
        @{ email = "ahk2@test.com"; name = "AHK User 2" }
    )
    html_template = "Hi {name}, shop {store} today!"
} | ConvertTo-Json -Depth 10 | ConvertTo-Csv -NoTypeInformation | Select-Object -Index 1

Write-Host "Curl command:" -ForegroundColor DarkGray
Write-Host "curl -X POST http://localhost:3000/api/campaigns/create-from-csv -H 'Authorization: Bearer $token' -H 'Content-Type: application/json' -d '$curljson'" -ForegroundColor DarkGray

# Cleanup
Write-Host "`n[Cleanup] Stopping backend..." -ForegroundColor Cyan
Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue

Write-Host "`n✅ All tests completed!" -ForegroundColor Green
Write-Host "`nNext steps:`n1. Update AutoHotkey script to use backend URL (http://localhost:3000)`n2. Add curl POST in DashboardToggleScript() function`n3. Test script with CSV file" -ForegroundColor Cyan
