const shopClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function openingTime(value: unknown, fallback: number): string | null {
  if (value == null || value === '') return `${String(fallback).padStart(2, '0')}:00`;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23) return `${String(value).padStart(2, '0')}:00`;
  if (typeof value !== 'string') return null;
  if (/^\d{1,2}$/.test(value)) return openingTime(Number(value), fallback);
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  if (value.includes('T')) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = Object.fromEntries(shopClock.formatToParts(new Date(date.getTime() + 30000)).map(part => [part.type, part.value]));
    return `${parts.hour}:${parts.minute}`;
  }
  return null;
}

export function storeAvailability(configs: Record<string, unknown>, now = new Date()) {
  if (configs.preview_mode === 'true') return { open: true, forceClosed: false };
  const forceClosed = configs.force_closed === true || configs.force_closed === 'true';
  if (forceClosed) return { open: false, forceClosed: true };
  const start = openingTime(configs.opening_start, 10);
  const end = openingTime(configs.opening_end, 22);
  let days: unknown = configs.working_days ?? [0, 1, 2, 3, 4, 5, 6];
  if (typeof days === 'string') { try { days = JSON.parse(days); } catch { days = null; } }
  if (!start || !end || start === end || !Array.isArray(days) || !days.every(day => Number.isInteger(day) && day >= 0 && day <= 6) || !Number.isFinite(now.getTime())) return { open: false, forceClosed: false };
  const parts = Object.fromEntries(shopClock.formatToParts(now).map(part => [part.type, part.value]));
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))).getUTCDay();
  const time = `${parts.hour}:${parts.minute}`;
  if (start < end) return { open: days.includes(day) && time >= start && time < end, forceClosed: false };
  const shiftDay = time < end ? (day + 6) % 7 : day;
  return { open: (time >= start || time < end) && days.includes(shiftDay), forceClosed: false };
}
