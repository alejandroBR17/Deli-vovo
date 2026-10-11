// Older catalogs store variations and extras together as JSON text.
export function productOptions(product: { variations?: unknown; additionals?: unknown }) {
  const list = (value: unknown): any[] => {
    if (value == null || value === '') return [];
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.some(option => !option || typeof option !== 'object' || typeof option.name !== 'string')) {
      throw new Error('As opções do produto estão inválidas. Contate a loja.');
    }
    return parsed;
  };
  const combined = list(product.variations);
  const extras = [...combined.filter(option => option.isAdditional), ...list(product.additionals)];
  return {
    variations: combined.filter(option => !option.isAdditional),
    additionals: [...new Map(extras.map(option => [option.name, option])).values()],
  };
}
