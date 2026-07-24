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

export function getCHNumber(name: string): number | null {
  const m = name.trim().match(/^(CH|chambre)\s*(\d+)/i);
  return m ? parseInt(m[2], 10) : null;
}

export function getCouloirNumber(name: string): number | null {
  const m = name.trim().match(/^Couloir\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Prefer "Chambre N" over legacy "CHN" when both exist for the same number. */
function getRoomNamePriority(name: string): number {
  const trimmed = name.trim();
  if (/^Chambre\s+\d+/i.test(trimmed)) return 3;
  if (/^Couloir\s+\d+/i.test(trimmed)) return 2;
  if (/^CH\s*\d+/i.test(trimmed)) return 1;
  return 0;
}

export function compareRoomNames(a: string, b: string): number {
  const aCh = getCHNumber(a);
  const bCh = getCHNumber(b);
  if (aCh !== null && bCh !== null) return aCh - bCh;

  const aCou = getCouloirNumber(a);
  const bCou = getCouloirNumber(b);
  if (aCou !== null && bCou !== null) return aCou - bCou;

  if (aCh !== null) return -1;
  if (bCh !== null) return 1;
  if (aCou !== null) return 1;
  if (bCou !== null) return -1;

  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

/** Drop legacy CHN entries when a Chambre N with the same number exists. */
export function deduplicateFacilityRooms<T extends { name: string }>(rooms: T[]): T[] {
  const byChNumber = new Map<number, T[]>();
  const couloirs: T[] = [];
  const unnumbered: T[] = [];

  for (const room of rooms) {
    const chNum = getCHNumber(room.name);
    const couNum = getCouloirNumber(room.name);

    if (couNum !== null) {
      couloirs.push(room);
      continue;
    }

    if (chNum !== null) {
      const group = byChNumber.get(chNum) ?? [];
      group.push(room);
      byChNumber.set(chNum, group);
      continue;
    }

    unnumbered.push(room);
  }

  const dedupedCh = Array.from(byChNumber.values()).map((group) => {
    if (group.length === 1) return group[0];
    return [...group].sort((a, b) => getRoomNamePriority(b.name) - getRoomNamePriority(a.name))[0];
  });

  return [...dedupedCh, ...couloirs, ...unnumbered];
}

export function roomMatchesFacilityGroup(
  roomName: string,
  group: FacilityGroupConfig,
  allGroups: FacilityGroupConfig[]
): boolean {
  const chNum = getCHNumber(roomName);
  const couNum = getCouloirNumber(roomName);

  if (couNum !== null) {
    if (group.couloirNumbers.includes(couNum)) return true;
    const claimedElsewhere = allGroups.some(
      (g) => g.id !== group.id && g.couloirNumbers.includes(couNum)
    );
    if (claimedElsewhere) return false;
  }

  if (chNum !== null && chNum >= group.chFrom && chNum <= group.chTo) {
    return true;
  }

  return false;
}

export function assignRoomsToFacilityGroups<T extends { name: string }>(
  rooms: T[],
  groups?: FacilityGroupConfig[] | null
): Record<string, T[]> {
  const config = resolveFacilityGroups(groups);
  const result: Record<string, T[]> = Object.fromEntries(config.map((g) => [g.id, []]));

  const sorted = deduplicateFacilityRooms(rooms).sort((a, b) =>
    compareRoomNames(a.name, b.name)
  );

  for (const room of sorted) {
    const match = config.find((g) => roomMatchesFacilityGroup(room.name, g, config));
    if (match) {
      result[match.id].push(room);
    } else if (config[0]) {
      result[config[0].id].push(room);
    }
  }

  return result;
}
