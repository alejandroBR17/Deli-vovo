export function customerName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const name = value.trim();
  return name.toLocaleLowerCase('pt-BR') === 'visitante' ? '' : name;
}
export function validCustomerName(value: unknown): boolean { return customerName(value).length >= 3; }
export function localGuest(user: {id: string} | null | undefined): boolean { return !!user?.id.startsWith('CONV-'); }
