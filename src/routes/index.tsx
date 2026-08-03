import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Clock, CreditCard, Languages, MapPin, ShieldCheck } from "lucide-react";
import heroImage from "@/assets/hero.jpg";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  CLINIC_ADDRESS,
  CLINIC_MAP_QUERY,
  CLINIC_NAME,
  INSURANCES,
  LANGUAGES,
  PAYMENTS,
  SCHEDULE,
} from "@/lib/clinic";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bella Vitae Medical Clinic | Kigali, open 07:00–23:00" },
      {
        name: "description",
        content:
          "Bella Vitae Medical Clinic on KN 5 Rd, Kigali. General medicine, dentistry, gynecology, internal medicine. Open daily 07:00–23:00. Book online.",
      },
      { property: "og:title", content: "Bella Vitae Medical Clinic | Kigali" },
      {
        property: "og:description",
        content: "Caring medical services in Kigali, open every day from 07:00 to 23:00.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: team } = useQuery({
    queryKey: ["staff_members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["clinic_contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_contacts")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <SiteLayout>
      <section className="relative overflow-hidden">
        <img
          src={heroImage}
          alt="Nurse welcoming a patient at Bella Vitae Medical Clinic in Kigali"
          width={1600}
          height={1000}
          className="h-[420px] w-full object-cover sm:h-[520px]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-primary/20" />
        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-6xl flex-col justify-center px-4 text-primary-foreground">
            <p className="text-sm uppercase tracking-[0.2em] opacity-90">Kigali · KN 5 Rd</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
              {CLINIC_NAME}
            </h1>
            <p className="mt-4 max-w-xl text-base opacity-90 sm:text-lg">
              Compassionate, everyday healthcare for you and your family — general medicine,
              dentistry, gynecology and internal medicine, open from 07:00 to 23:00, seven days a
              week.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/appointments"
                className="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Book an appointment
              </Link>
              <a
                href="tel:+250788275617"
                className="rounded-md border border-primary-foreground/40 px-6 py-3 text-sm font-semibold hover:bg-primary-foreground/10"
              >
                Call +250 788 275 617
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Clock, title: "Open every day", text: "07:00 – 23:00, weekends included" },
          { icon: ShieldCheck, title: "7 insurances", text: "RSSB, MMI, UAP, RADIANT & more" },
          { icon: Languages, title: "Kinyarwanda & English", text: "Care in your language" },
          { icon: CalendarCheck, title: "Online booking", text: "Get an appointment code instantly" },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="bg-secondary/50 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold text-primary">Presentation of the clinic</h2>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            {CLINIC_NAME} is a modern medical facility in the heart of Kigali. Our team of general
            practitioners, dental therapists, gynecologists and internal medicine specialists
            provides consultations, follow-up care and preventive medicine in a calm, welcoming
            environment. We serve patients in Kinyarwanda and English, accept all major insurance
            schemes, and keep our doors open sixteen hours a day, every day of the week.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-3xl font-bold text-primary">Our team</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(team ?? []).map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground/80">
                {m.specialty}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{m.full_name}</h3>
              {m.phones ? (
                <p className="mt-1 text-sm text-muted-foreground">{m.phones}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-secondary/50 py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-3">
          <div>
            <h2 className="text-2xl font-bold text-primary">Prices & insurances</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {INSURANCES.filter((i) => i !== "None / Private").map((i) => (
                <li
                  key={i}
                  className="rounded-full border border-border bg-card px-3 py-1 text-sm font-medium"
                >
                  {i}
                </li>
              ))}
            </ul>
            <h3 className="mt-6 flex items-center gap-2 font-semibold">
              <CreditCard className="h-4 w-4 text-primary" /> Payment methods
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{PAYMENTS.join(" · ")}</p>
            <h3 className="mt-4 font-semibold">Languages spoken</h3>
            <p className="mt-1 text-sm text-muted-foreground">{LANGUAGES.join(" & ")}</p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-primary">Schedule</h2>
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
              {SCHEDULE.map((s) => (
                <li key={s.day} className="flex justify-between px-4 py-2.5 text-sm">
                  <span>{s.day}</span>
                  <span className="font-medium">{s.hours}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-primary">
              <MapPin className="h-5 w-5" /> Map & access
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">{CLINIC_ADDRESS}</p>
            <iframe
              title="Map to Bella Vitae Medical Clinic"
              src={`https://www.google.com/maps?q=${CLINIC_MAP_QUERY}&output=embed`}
              className="mt-3 h-64 w-full rounded-xl border border-border"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-3xl font-bold text-primary">Contact us</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(contacts ?? []).map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-semibold">{c.label}</h3>
              <a href={`tel:${c.phone}`} className="mt-2 block text-sm text-primary hover:underline">
                {c.phone}
              </a>
              <a href={`mailto:${c.email}`} className="block text-sm text-primary hover:underline">
                {c.email}
              </a>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
