# Closed-pilot feedback and escalation template

Use this template only in the private pilot support channel or restricted operator record. Keep it redacted: do not include names, phone numbers, emails, passwords, raw manage links/tokens, authorization headers, screenshots with customer data, or secrets.

## Feedback record

```text
Date/time (local):
Reporter role: operator | customer tester
Environment: staging only
Device/browser/app mode:
Area: owner setup | services | availability | recurring block | time off |
      public booking | branding | receipt/manage/cancel | recovery | other
What I tried:
What happened (safe visible wording only):
What I expected:
Can it be reproduced with synthetic/minimum data? yes | no | unknown
Did refresh confirm the result? yes | no | not applicable
Impact/severity: S0 stop | S1 urgent | S2 normal | S3 feedback
Redacted affected reference, if needed:
Follow-up owner and next update:
Resolution/outcome:
```

## Severity and action

| Severity | Meaning | Required action |
| --- | --- | --- |
| S0 — stop | Possible data disclosure, unauthorized private-link access, failed persisted cancellation, missing owner appointment after a successful booking, or an authoritative-save discrepancy. | Stop the affected workflow and new invitations immediately; notify the founder/product owner through the private channel. |
| S1 — urgent | Recurring block ignored, fake receipt after failed booking, local-only hosted-save success, or a core booking/manage flow unavailable to a tester. | Pause the affected workflow, preserve only redacted evidence, and have the pilot operator assess before continuing. |
| S2 — normal | Reproducible confusion, incorrect copy, layout defect, or non-critical flow problem with a safe workaround. | Record it and triage with the pilot operator; do not claim a fix or workaround is production-ready. |
| S3 — feedback | Preference, polish idea, or non-blocking usability observation. | Record for beta/post-beta prioritization. |

## Operator closeout checklist

- [ ] Confirm whether the issue meets an S0 immediate-stop condition.
- [ ] Keep the environment staging-only; do not change production, deploy, reset data, or use payments.
- [ ] Reproduce with synthetic data where possible.
- [ ] Keep all evidence redacted and outside Git.
- [ ] Record the decision and tester-safe response through the private channel.
- [ ] Resume an affected workflow or invitations only after the pilot operator accepts the resolution.
