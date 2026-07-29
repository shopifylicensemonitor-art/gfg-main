# Implementation Plan: Auto-Send & Leads Upload Enhancements

## Gap 1: "Send via Backend" Button on FastMailSend
- [x] Step 1.1: Add `createCampaignFromCsv()` method to `api.ts`
- [x] Step 1.2: Add `onSendViaBackend` prop to `FastMailSend.tsx` + button
- [x] Step 1.3: Wire up handler in `Index.tsx` to collect emails+subject+body and call API
- [x] Step 1.4: Add success/error toast feedback

## Gap 2: Scheduler Status Indicators Across UI
- [x] Step 2.1: Add persistent scheduler status banner in `Dashboard.tsx`
- [x] Step 2.2: Add scheduler status indicator in `Index.tsx` header
- [x] Step 2.3: Fetch and display scheduler status on page load

## Gap 3: Unified "Upload & Launch" One-Click Flow
- [x] Step 3.1: Create "Quick Campaign" modal component
- [x] Step 3.2: Integrate into FastMailSend panel as a "Quick Launch Campaign" button
- [x] Step 3.3: Backend endpoint already exists (`create-from-csv`)

