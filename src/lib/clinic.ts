export const CLINIC_NAME = "Bella Vitae Medical Clinic";
export const CLINIC_ADDRESS = "KN 5 Rd, Kigali, Rwanda";
export const CLINIC_MAP_QUERY = "KN+5+Rd,+Kigali,+Rwanda";

export const INSURANCES = [
  "RSSB",
  "UAP",
  "MMI",
  "RADIANT",
  "BRITAM",
  "PRIME",
  "SANLAM",
  "None / Private",
] as const;

export const PAYMENTS = ["Cash", "Cards", "Cheques", "Mobile money"] as const;

export const LANGUAGES = ["Kinyarwanda", "English"] as const;

export const SCHEDULE = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
].map((day) => ({ day, hours: "07:00 - 23:00" }));

export const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => {
  const hour = 7 + i;
  return `${String(hour).padStart(2, "0")}:00`;
});