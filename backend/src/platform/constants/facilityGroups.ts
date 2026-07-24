export interface FacilityGroupConfig {
  id: string;
  label: string;
  subtitle?: string;
  chFrom: number;
  chTo: number;
  couloirNumbers: number[];
}

export const DEFAULT_FACILITY_GROUPS: FacilityGroupConfig[] = [
  {
    id: 'group1',
    label: 'Bloc 1',
    subtitle: 'Chambres 1-6',
    chFrom: 1,
    chTo: 6,
    couloirNumbers: [1],
  },
  {
    id: 'group2',
    label: 'Bloc 2',
    subtitle: 'Chambres 7+',
    chFrom: 7,
    chTo: 99,
    couloirNumbers: [2],
  },
];

export function resolveFacilityGroups(groups?: FacilityGroupConfig[] | null): FacilityGroupConfig[] {
  if (groups?.length) return groups;
  return DEFAULT_FACILITY_GROUPS;
}
