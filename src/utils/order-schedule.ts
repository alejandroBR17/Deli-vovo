import {storeAvailability} from './store-hours';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});
export function shopDate(now = new Date()) {
  const parts = Object.fromEntries(dateFormatter.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Interpret the selected wall-clock time in the shop's timezone, never the
// browser/server timezone. Existing local timestamps remain accepted.
export function validateSchedule(value: unknown, configs: Record<string, unknown>, now = new Date()): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('Confira a data e o horário do agendamento.');
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::00)?(?:-03:00)?$/.exec(value);
  if (!match) throw new Error('Confira a data e o horário do agendamento.');
  const [,year,month,day,hour,minute] = match;
  const calendar = new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth()+1 !== Number(month) || calendar.getUTCDate() !== Number(day)) throw new Error('Escolha uma data válida para o agendamento.');
  const canonical = `${year}-${month}-${day}T${hour}:${minute}:00-03:00`;
  const date = new Date(canonical);
  if (date.getTime() <= now.getTime()) throw new Error('Esse horário já passou. Escolha uma data e um horário futuros.');
  // A temporary closure applies to orders now; future slots follow the saved
  // weekly timetable. Preview mode must not bypass timetable validation.
  if (!storeAvailability({...configs,preview_mode:'false',force_closed:'false'},date).open) throw new Error('A loja não atende nesse dia ou horário. Escolha um horário dentro do expediente.');
  return canonical;
}
