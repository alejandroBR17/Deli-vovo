import type { Client } from '@libsql/client';
export const confirmedStoreAddress = {
  store_street:'Avenida São Gabriel', store_number:'2429', store_neighborhood:'São Gabriel',
  store_city:'Colombo', store_state:'PR', store_lat:'-25.3498099', store_lng:'-49.2022804',
};
export const previewStoreDefaults = {
  free_delivery_radius:'2', fee_per_km:'2', max_delivery_radius:'20',
  working_days:'[1,2,3,4,5]', opening_start:'10:00', opening_end:'22:00',
};
export async function seedStoreDefaults(client: Client, preview: boolean) {
  const defaults = {...confirmedStoreAddress,...(preview ? previewStoreDefaults : {})};
  await client.batch(Object.entries(defaults).map(([key,value])=>({
    sql: "INSERT INTO configs(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE json_extract(configs.payload,'$.value') IS NULL OR trim(json_extract(configs.payload,'$.value'))=''",
    args:[key,JSON.stringify({value})],
  })),'write');
}
