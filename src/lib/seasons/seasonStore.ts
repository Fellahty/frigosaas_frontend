const STORAGE_KEY = 'frigosmart.selectedSeasonId';

export function getStoredSelectedSeasonId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredSelectedSeasonId(seasonId: string | null) {
  try {
    if (!seasonId) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, seasonId);
  } catch {
    // ignore
  }
}
