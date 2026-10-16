export const SECTIONS_MAPPING = {
  PRINCIPAL: 'PRINCIPAL',
  EPARGNE: 'PRINCIPAL',
  COURANT: 'BIASHARA',
  KELASI: 'KELASI',
  NYUMBA: 'NYUMBA',
  HOPITAL: 'HOPITAL',
  BIASHARA: 'BIASHARA',
  MUTOTO: 'MUTOTO',
} as const;

export const SECTION_LETTERS = {
  PRINCIPAL: 'P',
  KELASI: 'K',
  NYUMBA: 'N',
  HOPITAL: 'H',
  BIASHARA: 'B',
  MUTOTO: 'M',
} as const;

export const SECTION_TRIGRAMS = {
  PRINCIPAL: 'PRI',
  KELASI: 'KEL',
  NYUMBA: 'NYU',
  HOPITAL: 'HOP',
  BIASHARA: 'BIA',
  MUTOTO: 'MUT',
} as const;

export function normalizeSectionName(name: string): string {
  if (!name) return '';
  const n = name.trim().toUpperCase();
  // Handling accents for HOPITAL
  if (n === 'HÔPITAL' || n === 'HOPITAL') return 'HOPITAL';
  return SECTIONS_MAPPING[n as keyof typeof SECTIONS_MAPPING] || n;
}

export function getSectionLetter(sectionName: string): string {
  const normalized = normalizeSectionName(sectionName);
  return (
    SECTION_LETTERS[normalized as keyof typeof SECTION_LETTERS] ||
    (normalized ? normalized.charAt(0) : 'X')
  );
}

export function getSectionTrigram(sectionName: string): string {
  const normalized = normalizeSectionName(sectionName);
  return (
    SECTION_TRIGRAMS[normalized as keyof typeof SECTION_TRIGRAMS] ||
    (normalized ? normalized.substring(0, 3).toUpperCase() : 'XXX')
  );
}
