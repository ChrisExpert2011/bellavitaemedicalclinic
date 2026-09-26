# Bella Vitae: auto emails, public code lookup, Bella Vitae AI, visual refresh

## 1. Appointment details sent automatically to the notification email
- Already wired: each booking emails full details to the address set in Admin → Settings (change it any time).
- Add a "Send test email" button in Admin → Settings and show whether email sending is active.
- Real delivery starts once the clinic's sending email domain is set up (one-time step, guided in chat). Until then bookings still save.

## 2. Check appointment status without signing in
- New "Check my appointment" box on the booking page and home page: enter code (BV-XXXXXX) and see status, doctor, date, time.
- Only safe details shown (no phone, email, or insurance card), so codes cannot leak private data.

## 3. Bella Vitae AI
- Floating chat button on every page, named "Bella Vitae AI", with a clinic-branded icon.
- Answers general health questions, guided to rely on Medscape-style clinical references and to name Medscape as its reference source, plus clinic info (hours, doctors, insurances, booking).
- Clear safety notice: not a diagnosis; urgent symptoms → call the clinic or emergency services; offers a "Book an appointment" link.
- Note: Medscape content is subscription-only, so the AI cannot read Medscape live; it uses a medical model instructed to follow Medscape-grade guidance and suggest the Medscape topic to look up.

## 4. Visual refresh and animations
- Smoother hero with fade/slide-in text, animated statistics, cards that rise on scroll, hover lift on team and gallery cards, gentle image zoom.
- A "Latest updates" strip on the home page showing recent news posts.
- Polished booking form layout and success screen with an animated code reveal.
- Respects reduced-motion settings; teal and gold theme kept.

## Technical details
- Public lookup: security-definer RPC `get_appointment_status(_code)` returning code, status, doctor, date, time only; granted to anon.
- AI: TanStack server route `/api/chat` with AI SDK `streamText` via Lovable AI Gateway, model `openai/gpt-6-astra` (Responses API), system prompt with clinic facts from the database; client uses `useChat` + AI Elements; one conversation, not stored.
- Test email: admin-only server function reusing `sendEmail`.
- Animations: `motion` library with whileInView, plus Tailwind keyframes in styles.css.
