# Shopify Purchase Conversion Tracking — ChatGPT Ads Manager

| | |
|---|---|
| **Project** | Kuberan Workstream |
| **Store** | Ledsone.us |
| **Category** | Analytics & Tracking |
| **Task Type** | Conversion Tracking Implementation |
| **Status** | Completed |
| **Date** | 15/06/2026 |

---

## Objective
Configure accurate Shopify purchase conversion tracking for ChatGPT Ads Manager using the OpenAI Ads tracking framework.

## Background
The implementation required:

- Creating a Shopify Purchase conversion event
- Using the Shopify `order_created` event
- Connecting the event to the OpenAI data source / pixel
- Installing OpenAI tracking code through Shopify Customer Events
- Sending purchase value and currency data
- Validating event delivery
- Confirming successful receipt inside Ads Manager

---

## Work Completed

### Conversion Event Setup
Created a **Shopify Purchase Conversion Event**.

- Event Source: Shopify
- Trigger Event: `order_created`
- Conversion Type: Purchase

### OpenAI Data Source Connection
Connected the **OpenAI Ads Data Source** and **OpenAI Pixel**. Connection verified successful.

### Shopify Customer Events
Added a custom OpenAI tracking script, configured to fire:

- On completed checkout
- On successful order creation

### Purchase Data Mapping
Configured transmission of:

- Order Value
- Currency
- Purchase Event

Validated correct value population.

---

## Testing Performed

| Test | Verified | Result |
|---|---|---|
| **Event Testing** | Test purchase flow, event trigger validation, purchase event firing | **PASS** |
| **Event Stream Validation** | Event received inside ChatGPT Ads Manager; purchase event shown in Event Stream | **PASS** |
| **Data Validation** | Correct order value, correct currency, correct event type | **PASS** |

---

## Final Configuration

| Item | State |
|---|---|
| Tracking Status | Active |
| Purchase Event | Receiving Successfully |
| OpenAI Pixel | Connected |
| Customer Events | Configured |
| Debug Mode | Disabled after successful validation |

---

## Evidence (required)
- Shopify Customer Event configuration screenshot
- OpenAI Data Source connection screenshot
- Purchase event setup screenshot
- Event Stream received-event screenshot
- Test purchase confirmation screenshot

---

## Root Cause / Business Need
Prior to implementation, completed Shopify purchases were **not** being reported to ChatGPT Ads Manager. This prevented:

- Accurate conversion attribution
- Campaign optimization
- Revenue reporting
- ROAS measurement

The implemented tracking solution resolves these limitations.

---

## Outcome
Successfully implemented Shopify Purchase Conversion Tracking for ChatGPT Ads Manager. The system now:

- Tracks completed purchases
- Sends purchase values
- Sends currency information
- Reports conversions to OpenAI Ads Manager
- Supports conversion attribution and campaign optimization

---

## Validation Checklist
- [x] Conversion event created
- [x] `order_created` event configured
- [x] OpenAI data source connected
- [x] OpenAI pixel configured
- [x] Customer Event script installed
- [x] Purchase value passed
- [x] Currency passed
- [x] Test purchase completed
- [x] Event received in Event Stream
- [x] Debug mode disabled after testing

---

## Risks
**Current risks:** None identified.

**Monitoring recommended:**
- Verify ongoing event delivery weekly.
- Verify conversion counts against Shopify orders.
- Review Ads Manager event diagnostics periodically.

---

## Next Recommended Action
Monitor conversion tracking for **7 days**, validating:

- Conversion volume
- Revenue values
- Attribution reporting

Then proceed with campaign optimization, ROAS analysis, and conversion performance reporting.

---

## Completion Status
- **Status:** COMPLETED
- **Implementation:** Successful
- **Validation:** Passed
- **Documentation:** Complete
