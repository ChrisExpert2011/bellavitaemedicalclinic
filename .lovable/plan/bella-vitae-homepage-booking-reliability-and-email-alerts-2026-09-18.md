# Bella Vitae homepage, booking reliability, and email alerts

## What will change
- Add the five uploaded clinic photos to the homepage as a polished clinic gallery, using the real exterior, reception, dental room, and service poster images.
- Create a distinctive Bella Vitae medical mark, use it in the site header, and derive the favicon Google can display beside search results.
- Replace the browser-only booking sequence with one reliable booking action that validates the request, creates the appointment, and returns the appointment code with clear error handling.
- Add an admin-editable appointment notification email setting.
- After a successful booking, send one detailed appointment email to that configured address and keep the doctor's existing alert behavior.
- Improve the booking form with the patient's email field, future-date protection, required selections, and a clear warning if the appointment saved but notification delivery was unavailable.
- Verify the homepage and booking flow on desktop and mobile, including the current build/runtime logs.

## Email prerequisite
App emails require a verified sender domain. The booking and admin controls can be completed now, but real delivery will begin only after the clinic's email domain is configured and verified.

## Technical details
- Store uploaded photos as managed site assets and load them through asset pointers.
- Store the notification recipient in a protected clinic settings record that only administrators can read or update.
- Perform booking and notification server-side; never expose email credentials in the browser.
- Use an idempotency key based on the appointment code to prevent duplicate notification emails.
- Keep notification failure separate from booking success so an email outage never loses a patient's appointment.
- Update page metadata and structured data to reference the clinic brand consistently; the favicon remains a real optimized file in `public/`.
