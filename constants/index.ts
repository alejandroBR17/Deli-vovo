import { Product } from '../types/index';

export const WHATSAPP_NUMBER = "554195796370";
export const STORE_NAME = "Delícias da Vovó Grazy";
export const STORE_ADDRESS = "Curitiba - PR";
export const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Curitiba+-+PR";
export const GAS_API_URL = "/api"; // Agora aponta para o backend local/Vercel 
export const PIX_KEY = "deliciasdavovosalgadinhos@gmail.com";

// Um placeholder super amigável em SVG puro para não precisar de imagem externa!
export const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23FFFBF2'/%3E%3Ccircle cx='200' cy='180' r='100' fill='%23fef3c7' stroke='%23D97706' stroke-width='4' stroke-dasharray='10 10'/%3E%3Cpath d='M200 140 C 200 140 170 110 140 140 C 110 170 200 240 200 240 C 200 240 290 170 260 140 C 230 110 200 140 200 140 Z' fill='%23D61F1F' opacity='0.8'/%3E%3Ctext x='50%25' y='80%25' font-family='sans-serif' font-weight='900' font-size='22' fill='%23D97706' text-anchor='middle'%3EMistério Gostoso%3C/text%3E%3Ctext x='50%25' y='88%25' font-family='sans-serif' font-weight='500' font-size='14' fill='%23999' text-anchor='middle'%3E(Logo a Vovó põe a foto)%3C/text%3E%3C/svg%3E";

export const PRODUCTS: Product[] = [];

export const CATEGORIES = [
  { id: 'todos', label: 'Todos' },
  { id: 'argentinos', label: '🇦🇷 Do Vovô' },
  { id: 'combos', label: 'Combos Festa' },
  { id: 'fritos', label: 'Fritos' },
  { id: 'assados', label: 'Assados' },
  { id: 'parrilla', label: 'Parrilla' },
  { id: 'lanches', label: 'Lanches' },
  { id: 'congelados', label: 'Congelados' },
  { id: 'bebidas', label: 'Bebidas' }
];

export const OPENING_HOURS = {
  start: 10, // 10:00
  end: 22,   // 22:00
};
