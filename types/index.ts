export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  category: 'fritos' | 'assados' | 'congelados' | 'doces' | 'bebidas' | 'combos' | 'argentinos';
  image: string;
  variations?: { name: string, price: number }[];
  additionals?: { name: string, price: number }[];
}

export interface CartItem extends Product {
  quantity: number;
  variation?: { name: string, price: number };
  additionals?: { name: string, price: number }[];
  observation?: string;
}

export type OrderStatus = 'pendente' | 'preparando' | 'forno' | 'entrega' | 'concluido' | 'cancelado' | 'pix_recusado';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  cart?: string | any[];
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  scheduledTo?: string;
  refusalReason?: string;
  customer: {
    name: string;
    phone: string;
    address: string;
  };
  payment: {
    method: 'pix' | 'cartao_online';
    changeFor?: number;
    paid: boolean;
  };
  timing: {
    createdAt: string;
    estimatedTime?: string;
  };
  type: 'entrega' | 'retirada';
}

export interface RecommendationResponse {
  message: string;
  suggestedItems: string[];
}

export interface ScheduleData {
  date: string;
  time: string;
  isDelivery: boolean;
}