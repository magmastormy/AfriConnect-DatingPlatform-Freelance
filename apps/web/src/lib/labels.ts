// Human-readable labels for enum values that reach the UI raw (API returns
// Prisma enums like `cape_town`). Kept in one place so every surface — cards,
// modals, filters — spells cities and education the same way.

export const CITY_LABELS: Record<string, string> = {
  johannesburg: 'Johannesburg',
  cape_town: 'Cape Town',
  durban: 'Durban',
  pretoria: 'Pretoria',
  pietermaritzburg: 'Pietermaritzburg',
};

export function labelCity(city: string | null | undefined): string {
  if (!city) return '';
  return CITY_LABELS[city] ?? city.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export const EDUCATION_LABELS: Record<string, string> = {
  diploma: 'Diploma',
  bachelors: "Bachelor's",
  honours: 'Honours',
  masters: "Master's",
  phd: 'PhD',
  professional: 'Professional',
};

export function labelEducation(level: string | null | undefined): string {
  if (!level) return '';
  return EDUCATION_LABELS[level] ?? level;
}
