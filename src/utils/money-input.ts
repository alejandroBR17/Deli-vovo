export function parseMoneyInput(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 && value <= 100000 ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  let text = value.trim().replace(/^R\$\s*/, '').replace(/\s/g, '');
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 && number <= 100000 ? number : null;
}
export const formatMoneyInput = (value: unknown) => {
  const number = parseMoneyInput(value);
  return number === null ? '' : number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
