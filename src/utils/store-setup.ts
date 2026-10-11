export type SetupTarget = 'menu' | 'geral' | 'entrega';
export function storeSetup(configs: Record<string, unknown>, productCount: number) {
  const text = (key: string) => typeof configs[key] === 'string' && String(configs[key]).trim().length > 0;
  const number = (key: string, min: number, max = Infinity) => {
    const raw = configs[key];
    if (raw == null || !['string', 'number'].includes(typeof raw) || String(raw).trim() === '') return false;
    const value = Number(String(raw).replace(',', '.'));
    return Number.isFinite(value) && value >= min && value <= max;
  };
  let days: unknown = configs.working_days;
  if (typeof days === 'string') { try { days = JSON.parse(days); } catch { days = null; } }
  const hours = ['opening_start', 'opening_end'].every(key => typeof configs[key] === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(configs[key])));
  return [
    { id: 'catalog', label: 'Cardápio', detail: 'Cadastre os produtos com preços e opções.', ready: productCount > 0, target: 'menu' as SetupTarget },
    { id: 'location', label: 'Localização da loja', detail: 'Confirme endereço e ponto no mapa para calcular entregas.', ready: ['store_street', 'store_number', 'store_city'].every(text) && number('store_lat', -90, 90) && number('store_lng', -180, 180), target: 'entrega' as SetupTarget },
    { id: 'delivery', label: 'Taxas e raio de entrega', detail: 'Defina taxa por km, distância gratuita e limite de atendimento.', ready: number('fee_per_km', 0) && number('free_delivery_radius', 0) && number('max_delivery_radius', 0) && Number(String(configs.free_delivery_radius).replace(',', '.')) <= Number(String(configs.max_delivery_radius).replace(',', '.')), target: 'entrega' as SetupTarget },
    { id: 'hours', label: 'Horários e dias', detail: 'Confirme quando a loja recebe pedidos.', ready: hours && Array.isArray(days) && days.length > 0 && days.every(day => Number.isInteger(day) && day >= 0 && day <= 6), target: 'entrega' as SetupTarget },
    { id: 'pix', label: 'Chave Pix', detail: 'Informe a chave que o cliente usará para pagar.', ready: text('pix_key'), target: 'geral' as SetupTarget },
  ];
}
