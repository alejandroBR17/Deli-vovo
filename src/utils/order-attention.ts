export function needsOrderAttention(order: {status: string; acknowledgedAt?: string}) {
  return order.status === 'pendente' && !order.acknowledgedAt;
}
