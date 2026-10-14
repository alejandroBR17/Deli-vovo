import { createHmac, timingSafeEqual } from 'node:crypto';

type Mode = 'test' | 'live';
export type MercadoPagoConfig = { accessToken: string; sellerId: string; mode: Mode };
export type PaymentExpectation = { orderId: string; fingerprint: string; total: number };
const idPattern = /^[0-9]{1,32}$/;
const cents = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000) throw new Error('Valor de pagamento inválido.');
  return Math.round(value * 100);
};

export class MercadoPago {
  private verifiedAccount: Promise<void>|null=null;
  constructor(private readonly config: MercadoPagoConfig, private readonly transport: typeof fetch = fetch) {
    if (!config.accessToken || !idPattern.test(config.sellerId) || !['test','live'].includes(config.mode)) throw new Error('Configuração do Mercado Pago incompleta.');
  }

  private async request(path: string, body?: unknown) {
    // Fixed provider host; never follow webhook URLs or send tokens to a redirect.
    const response = await this.transport(`https://api.mercadopago.com${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error('O Mercado Pago não respondeu. Tente novamente em instantes.');
    return response.json();
  }

  async verifyAccount() {
    if(!this.verifiedAccount) {
      this.verifiedAccount=this.request('/users/me').then(account=>{
        const testAccount=Array.isArray(account.tags)&&account.tags.includes('test_user');
        if(String(account.id)!==this.config.sellerId || testAccount!==(this.config.mode==='test')) throw new Error('A conta Mercado Pago não corresponde ao ambiente configurado.');
      }).catch(error=>{this.verifiedAccount=null;throw error;});
    }
    return this.verifiedAccount;
  }

  async createPreference(expected: PaymentExpectation, origin: string, webhookUrl: string) {
    const base = new URL(origin);
    const webhook = new URL(webhookUrl);
    if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash ||
        webhook.origin !== base.origin || webhook.pathname !== '/api/payments/mercado-pago/webhook' || webhook.search || webhook.hash) throw new Error('Endereço de pagamento inválido.');
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(expected.orderId) || !/^[a-f0-9]{64}$/.test(expected.fingerprint) || cents(expected.total) < 1) throw new Error('Pedido de pagamento inválido.');
    await this.verifyAccount();
    const back = `${base.origin}/?payment_return=${encodeURIComponent(expected.orderId)}`;
    const preference = await this.request('/checkout/preferences', {
      items: [{ id: expected.orderId, title: 'Pedido Delícias da Vovó', quantity: 1, currency_id: 'BRL', unit_price: cents(expected.total) / 100 }],
      external_reference: expected.orderId, metadata: { checkout: expected.fingerprint },
      back_urls: { success: back, pending: back, failure: back }, auto_return: 'approved',
      notification_url: webhook.href,
      // MP requires account balance to remain available. Manual Pix stays separate.
      payment_methods: { excluded_payment_types: ['ticket','bank_transfer','atm','digital_currency','prepaid_card'].map(id => ({id})) },
    });
    if (!preference || typeof preference.id !== 'string' || String(preference.collector_id) !== this.config.sellerId) throw new Error('Recebedor do pagamento não corresponde à loja.');
    const url = new URL(preference.init_point);
    if (url.protocol !== 'https:' || url.hostname !== 'www.mercadopago.com.br' || url.username || url.password) throw new Error('Endereço de checkout não reconhecido.');
    return { preferenceId: preference.id as string, checkoutUrl: url.href, mode: this.config.mode };
  }

  async getPayment(paymentId: string) {
    if (!idPattern.test(paymentId)) throw new Error('Identificador de pagamento inválido.');
    await this.verifyAccount();
    return this.request(`/v1/payments/${paymentId}`);
  }

  async verifyPayment(payment: any, expected: PaymentExpectation) {
    await this.verifyAccount();
    if (!payment || !idPattern.test(String(payment.id)) || String(payment.collector_id) !== this.config.sellerId ||
        typeof payment.live_mode!=='boolean' || (this.config.mode==='live' && payment.live_mode!==true) || payment.currency_id !== 'BRL' ||
        payment.external_reference !== expected.orderId || payment.metadata?.checkout !== expected.fingerprint ||
        cents(payment.transaction_amount) !== cents(expected.total) ||
        !['credit_card','debit_card','account_money'].includes(payment.payment_type_id)) throw new Error('Pagamento não corresponde ao pedido.');
    if (payment.status !== 'approved' || (payment.transaction_amount_refunded ?? 0) !== 0) return {approved:false};
    return {approved:true, paymentId:String(payment.id),paymentType:String(payment.payment_type_id)};
  }
}

export function validMercadoPagoSignature(secret: string, signature: unknown, requestId: unknown, dataId: unknown) {
  if (!secret || typeof signature !== 'string' || signature.length > 300 || typeof requestId !== 'string' ||
      !/^[a-zA-Z0-9-]{1,128}$/.test(requestId) || typeof dataId !== 'string' || !idPattern.test(dataId)) return false;
  const parts = signature.split(',').map(part => part.trim().split('='));
  if (parts.length !== 2 || parts.some(part => part.length !== 2)) return false;
  const values = Object.fromEntries(parts);
  if (!/^[0-9]{1,16}$/.test(values.ts || '') || !/^[a-f0-9]{64}$/.test(values.v1 || '')) return false;
  const expected = createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${values.ts};`).digest();
  const actual = Buffer.from(values.v1,'hex');
  return actual.length === expected.length && timingSafeEqual(actual,expected);
}
