export interface RegionBudget {
  name: string;
  island?: string;
  amount: number;
  sharePercent: number;
  count: number;
}

export function regionMatchesSelection(name: string, selection: string, island?: string): boolean {
  const group = regionGroup(name);
  if (selection === 'Luzon') return island ? island === 'Luzon' : group === 'NCR' || group === 'Northern Luzon' || group === 'Southern Luzon';
  if (selection === 'Visayas' || selection === 'Mindanao') return island ? island === selection : group === selection;
  if (selection === 'Northern Luzon' || selection === 'Southern Luzon') return group === selection;
  return regionKey(name) === regionKey(selection);
}

export function regionKey(name: string): string {
  const value = name.toUpperCase();
  if (/\bNCR\b|NATIONAL CAPITAL|METRO(?:POLITAN)? MANILA/.test(value)) return 'NCR';
  if (/\bCAR\b|CORDILLERA/.test(value)) return 'CAR';
  if (/MIMAROPA|IV-B|IVB/.test(value)) return 'MIMAROPA';
  if (/\bNIR\b|NEGROS ISLAND/.test(value)) return 'NIR';
  if (/BARMM|ARMM|BANGSAMORO/.test(value)) return 'BARMM';
  const roman = value.match(/\bREGION\s+([IVX]+(?:-A)?)\b/);
  if (roman) return `Region ${roman[1]}`;
  const names: Record<string, string> = {
    ILOCOS: 'I', CAGAYAN: 'II', 'CENTRAL LUZON': 'III', CALABARZON: 'IV-A', BICOL: 'V',
    'WESTERN VISAYAS': 'VI', 'CENTRAL VISAYAS': 'VII', 'EASTERN VISAYAS': 'VIII',
    ZAMBOANGA: 'IX', 'NORTHERN MINDANAO': 'X', DAVAO: 'XI', SOCCSKSARGEN: 'XII', CARAGA: 'XIII',
  };
  for (const [label, code] of Object.entries(names)) if (value.includes(label)) return `Region ${code}`;
  return name;
}

export function regionGroup(name: string): 'NCR' | 'Northern Luzon' | 'Southern Luzon' | 'Visayas' | 'Mindanao' | null {
  const key = regionKey(name);
  if (key === 'NCR') return 'NCR';
  if (['Region I', 'Region II', 'Region III', 'CAR'].includes(key)) return 'Northern Luzon';
  if (['Region IV-A', 'MIMAROPA', 'Region V'].includes(key)) return 'Southern Luzon';
  if (['Region VI', 'Region VII', 'Region VIII', 'NIR'].includes(key)) return 'Visayas';
  if (['Region IX', 'Region X', 'Region XI', 'Region XII', 'Region XIII', 'BARMM'].includes(key)) return 'Mindanao';
  return null;
}
