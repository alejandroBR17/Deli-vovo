const deliveryFields = ['free_delivery_radius', 'fee_per_km', 'max_delivery_radius'];
const numericValue = (value: unknown) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

export function deliverySettings(configs: Record<string, unknown>) {
  const values = deliveryFields.map(key => numericValue(configs[key]));
  if (values.some(value => value === null)) throw new Error('A loja precisa configurar as taxas e o limite de entrega.');
  const [freeRadius, perKm, maxRadius] = values as number[];
  if (freeRadius > maxRadius) throw new Error('A distância gratuita não pode ultrapassar o limite de entrega.');
  return { freeRadius, perKm, maxRadius };
}

export function validateStoreConfig(key: string, value: unknown, saved: Record<string, unknown>) {
  if (key === 'whatsapp_number' && typeof value === 'string') {
    if (!value.trim()) return '';
    let digits=value.replace(/\D/g,'');
    if (digits.length===10 || digits.length===11) digits='55'+digits;
    if (!/^55\d{10,11}$/.test(digits)) throw new Error('Informe um WhatsApp válido com DDD.');
    return digits;
  }
  if (deliveryFields.includes(key)) {
    const parsed = numericValue(value);
    if (parsed === null) throw new Error('Informe um valor válido, maior ou igual a zero, para o frete.');
    const free = numericValue(key === 'free_delivery_radius' ? parsed : saved.free_delivery_radius);
    const max = numericValue(key === 'max_delivery_radius' ? parsed : saved.max_delivery_radius);
    if (free !== null && max !== null && free > max) throw new Error('A distância gratuita não pode ultrapassar o limite de entrega.');
    return String(parsed);
  }
  if (key === 'opening_start' || key === 'opening_end') {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Informe um horário válido.');
    const other = saved[key === 'opening_start' ? 'opening_end' : 'opening_start'];
    if (value === other) throw new Error('Os horários de abertura e fechamento devem ser diferentes.');
  }
  if (key === 'working_days') {
    let days;
    try { days = typeof value === 'string' ? JSON.parse(value) : null; } catch { days = null; }
    if (!Array.isArray(days) || !days.every(day => Number.isInteger(day) && day >= 0 && day <= 6)) throw new Error('Escolha dias válidos para o atendimento.');
    return JSON.stringify([...new Set(days)].sort());
  }
  if ((key === 'cash_enabled' || key === 'force_closed') && value !== 'true' && value !== 'false') throw new Error('Escolha ativar ou desativar esta opção.');
  if (typeof value !== 'string') throw new Error('Configuração inválida.');
  return value;
}
