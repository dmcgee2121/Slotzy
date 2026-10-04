# Closed-pilot tester instructions

## Scope

This is a small, trusted **staging** test of Slotzy—not a public launch or production service. The round is limited to one or two trusted operators and three to five trusted customer testers. Do not use payments, make production claims, or enter more personal information than needed for a test. Use fake or minimum contact information where possible.

Use the private support channel provided separately. Its details, tester identities, and contact information are intentionally not stored in this repository.

## All testers

1. Treat the booking site and data as test-only.
2. Report confusion, visible errors, broken saves, missing appointments, or unexpected access through the private support channel.
3. Do not share a private manage link, its URL, its token, or screenshots that contain appointment/contact details.
4. Stop the affected flow and report it immediately if any stop condition below occurs.

## Owner/operator checklist

- Sign in and confirm the dashboard, Services, and Availability are usable.
- Create or verify normal hours, one-time time off, and a recurring lunch/break block.
- Confirm public booking removes times that overlap a recurring block while retaining available times before and after it.
- Add or update a service and confirm the public booking page reflects it after an authoritative save.
- Test public branding: logo and cover should save and render on the public booking experience.
- Understand that hosted owner profile editing is intentionally read-only for this beta; public business/shop settings remain the editable source for public information.
- Owner account recovery is operator-assisted through the private support channel, not self-service.
- Confirm a newly created synthetic customer booking appears in the owner appointment view.

## Customer tester checklist

- Find the assigned shop through the chooser or direct staging link.
- Choose a service, date, and available time, then make one synthetic/minimum-data booking.
- Confirm the receipt appears only after the booking succeeds.
- Save the private manage link privately; open it to view and cancel the booking if asked.
- Private manage links support viewing and cancellation only. Rescheduling is not available; cancel and rebook instead.
- Open the customer recovery form and confirm it provides generic help. It must not reveal a manage token or private appointment information.
- Report missing available times, an incorrect recurring-break result, confusing wording, or any unexpected appointment access.

## Known limitations

- This is staging only, with no payments and no production service.
- Hosted personal profile fields are read-only by design for this beta.
- Owner recovery is manual/operator-assisted.
- Private manage links cannot reschedule appointments.
- Physical iPhone installed-PWA cache rollover, a true expired-link fixture, and application smoke against an isolated restore target remain follow-up validation—not tester responsibilities.

## Stop conditions and escalation

Stop the affected flow, do not retry with personal data, and contact the pilot operator immediately if any of these occur:

- An authoritative save appears to succeed but does not persist after refresh.
- A person can access a private manage link or booking they should not be able to access.
- A cancellation reports success but does not persist.
- An owner cannot see a customer booking after it succeeds.
- Any possible data disclosure, including a visible token or someone else's appointment/contact details.
- A recurring lunch/break is ignored by public booking.
- A receipt appears after a failed booking.
- An owner save reports success locally despite a hosted save failure.

Do not put passwords, private links/tokens, contacts, screenshots containing customer data, or secrets in ordinary messages. Use a redacted description and follow the private support process.
