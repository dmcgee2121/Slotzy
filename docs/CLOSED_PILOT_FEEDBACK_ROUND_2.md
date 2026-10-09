# Closed-pilot trusted tester feedback — Round 2

Date: 2026-10-08  
Environment: staging only  
Release baseline: `f3d79ee`

## Scope and outcome

Three trusted testers completed the closed-pilot owner and customer journeys. Feedback was positive. No beta blocker, data-safety concern, private-link access issue, failed persisted cancellation, missing owner appointment, freeze, or functional failure was reported.

The exercised journeys were:

- Owner account creation and schedule setup.
- Recurring break/lunch setup, including public unavailability during the blocked time.
- Shop cover/photo upload.
- Appointment confirmation and cancellation, with the Appointment Manager reflecting changes.
- Customer booking, private manage-link opening in a separate browser, and customer cancellation.

## Feedback and disposition

| Observation | Disposition |
| --- | --- |
| Owner and customer workflows completed as expected. | Accepted as positive closed-pilot evidence. |
| A slight delay was noticed after some button presses and during the booking flow. | Non-blocking observation; monitor in the next trusted round with only redacted timing/visible-state evidence. |
| The mobile Services-step Add Service control was too close to the Time needed input. | Fixed in C1a (`f3d79ee`) with a mobile-only CSS spacing adjustment. |

## Beta blocker status

**None currently known for the tiny trusted staging cohort.** Existing immediate-stop conditions remain unchanged: authoritative-save discrepancy, unauthorized private-link access, failed persisted cancellation, missing owner appointment after booking, or possible data disclosure.

## Follow-up

- Monitor the observed slight button/booking delay without treating it as a persistence success signal.
- Monitor mobile installed-PWA cache behavior during the next round.
- Continue with two to three additional trusted staging testers within the existing pilot limits.

Do not add tester identities, contact details, screenshots containing customer data, private manage links/tokens, or completed feedback records to Git.
