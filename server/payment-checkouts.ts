import { createHash, timingSafeEqual } from 'node:crypto';
import type { Client } from '@libsql/client';
import type { PaymentExpectation } from './mercado-pago.js';

export type PaymentCheckout = PaymentExpectation & {
  requestHash: string; order: Record<string,any>; checkoutUrl?: string; preferenceId?: string;
};
export const paymentRequestHash = (key: string) => createHash('sha256').update(key).digest('hex');
export function hasPaymentCheckoutAccess(checkout: PaymentCheckout, key: unknown) {
  if (typeof key !== 'string' || !/^[a-zA-Z0-9-]{32,64}$/.test(key)) return false;
  const hash=Buffer.from(paymentRequestHash(key)); const expected=Buffer.from(checkout.requestHash);
  return hash.length===expected.length && timingSafeEqual(hash,expected);
}

// Separate private table: never exposed by the generic configuration/data API.
export class PaymentCheckoutStore {
  constructor(private readonly client: Client) {}
  async create(checkout: PaymentCheckout) {
    const result=await this.client.execute({sql:'INSERT INTO payment_checkouts(id,payload) VALUES (?,?) ON CONFLICT(id) DO NOTHING',args:[checkout.orderId,JSON.stringify(checkout)]});
    return result.rowsAffected===1;
  }
  async get(id: string): Promise<PaymentCheckout|null> {
    const result=await this.client.execute({sql:'SELECT payload FROM payment_checkouts WHERE id=?',args:[id]});
    return result.rows[0] ? JSON.parse(String(result.rows[0].payload)) : null;
  }
  async savePreference(id: string, preference: {checkoutUrl:string;preferenceId:string}) {
    await this.client.execute({sql:"UPDATE payment_checkouts SET payload=json_set(payload,'$.checkoutUrl',?,'$.preferenceId',?) WHERE id=?",args:[preference.checkoutUrl,preference.preferenceId,id]});
  }
  async finalize(checkout: PaymentCheckout, paymentId: string,paymentType='credit_card') {
    const paidOrder={...checkout.order,date:new Date().toISOString(),paymentMethod:`${paymentType==='account_money'?'Saldo':'Cartão'} Online Mercado Pago (Pago - ID: ${paymentId})`,
      payment:{method:'cartao_online',paid:true,verifiedAt:new Date().toISOString(),providerType:paymentType},paymentProvider:'mercado_pago',paymentId,
      status:'pendente',archived:false};
    const tx=await this.client.transaction('write');
    try {
      const result=await tx.execute({sql:'INSERT INTO orders(id,payload) VALUES (?,?) ON CONFLICT(id) DO NOTHING',args:[checkout.orderId,JSON.stringify(paidOrder)]});
      // The accepted order and checkout receipt commit together across instances.
      if(result.rowsAffected===1) await tx.execute({sql:"UPDATE payment_checkouts SET payload=json_set(payload,'$.paymentId',?) WHERE id=?",args:[paymentId,checkout.orderId]});
      await tx.commit();
      return {created:result.rowsAffected===1,order:paidOrder};
    } catch(error) {await tx.rollback();throw error;}
    finally {tx.close();}
  }
  async revokePayment(orderId:string,paymentId:string,state:string) {
    const result=await this.client.execute({sql:"UPDATE orders SET payload=json_set(payload,'$.payment.paid',json('false'),'$.payment.providerStatus',?,'$.paymentMethod',?) WHERE id=? AND json_extract(payload,'$.paymentId')=? AND COALESCE(json_extract(payload,'$.payment.providerStatus'),'')!=?",
      args:[state,'Cartão Online Mercado Pago (Pagamento devolvido ou contestado)',orderId,paymentId,state]});
    return result.rowsAffected===1;
  }
}
