export const FAVORITES_KEY = 'vovoh_favorite_product_ids_v1';
export function normalizeFavorites(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0 && id.length <= 128))].slice(0, 200);
}
export function readFavorites(): string[] {
  try {return normalizeFavorites(JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]'));}
  catch {return [];}
}
export function saveFavorites(ids: string[]): boolean {
  try {window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(normalizeFavorites(ids))); return true;}
  catch {return false;}
}
