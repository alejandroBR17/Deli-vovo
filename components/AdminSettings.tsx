import React, { useEffect, useRef, useState } from 'react';
import { MoneyInput } from './AdminDialog';
import { formatCep, lookupCep } from '../src/utils/cep';
import { parseMoneyInput } from '../src/utils/money-input';

const input = 'w-full min-w-0 p-3 mt-2 bg-white/5 border border-white/15 rounded-xl text-base outline-none focus:border-vovoh-red';
const button = 'w-full sm:w-auto px-5 py-3 rounded-xl bg-vovoh-red font-bold disabled:opacity-50';
const panel = 'min-w-0 bg-zinc-900/50 p-4 sm:p-6 rounded-2xl border border-white/10 space-y-5';
type Props = { configs: Record<string, any>; saved: Record<string, any> | null; onChange: (value: Record<string, any>) => void; onSave: (key: string, value: any) => Promise<boolean>; onSaveMany: (updates: Record<string, string>) => Promise<boolean>; saving: boolean };

export function DeliverySettings({configs,onChange,onSaveMany,saving}: Props) {
  const [error,setError] = useState('');
  return <section className={panel} aria-label="Configurações de frete">
    <h3 className="font-bold text-xl">Frete e área de entrega</h3>
    <p className="text-sm text-zinc-400">Até a distância gratuita, não há taxa. Depois dela, cobramos por km adicional. O cálculo usa distância em linha reta, não trânsito ou trajeto pelas ruas.</p>
    {configs.preview_mode === 'true' && <p className="text-sm p-3 rounded-xl bg-amber-500/10 text-amber-200">Prévia de testes: os valores iniciais são provisórios. Confirme os valores reais antes de publicar.</p>}
    <label className="block font-bold text-sm">Distância com frete grátis (km)<input type="number" inputMode="decimal" min="0" step="0.1" className={input} value={configs.free_delivery_radius ?? ''} onChange={event=>onChange({...configs,free_delivery_radius:event.target.value})} /></label>
    <MoneyInput id="delivery-km-price" label="Valor por km adicional" value={configs.fee_per_km} onChange={value=>onChange({...configs,fee_per_km:value})} />
    <label className="block font-bold text-sm">Distância máxima de entrega (km)<input type="number" inputMode="decimal" min="0" step="0.1" className={input} value={configs.max_delivery_radius ?? ''} onChange={event=>onChange({...configs,max_delivery_radius:event.target.value})} /></label>
    {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
    <button disabled={saving} className={button} onClick={async()=>{
      const free = parseMoneyInput(configs.free_delivery_radius), max = parseMoneyInput(configs.max_delivery_radius), fee = parseMoneyInput(configs.fee_per_km);
      if (free === null || max === null || fee === null || free > max) { setError('Preencha os três valores. A distância gratuita deve ser menor ou igual à distância máxima.'); return; }
      setError(''); await onSaveMany({free_delivery_radius:String(free),max_delivery_radius:String(max),fee_per_km:String(fee)});
    }}>{saving ? 'Salvando...' : 'Salvar frete'}</button>
    <p className="text-xs text-zinc-400">Alterações só entram em vigor ao salvar.</p>
  </section>;
}

export function HoursSettings({configs,onChange,onSave,onSaveMany,saving}: Props) {
  const days = Array.isArray(configs.working_days) ? configs.working_days : [];
  return <section className={panel} aria-label="Atendimento">
    <h3 className="font-bold text-xl">Dias e horários</h3>
    <p className="text-sm text-zinc-400">Horário de Brasília. Para atender depois da meia-noite, use um fechamento anterior à abertura.</p>
    {configs.preview_mode === 'true' && <p className="text-sm text-amber-200">Horários e dias iniciais são provisórios para teste; a prévia permite testar fora desse período.</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="block text-sm font-bold">Abre às<input type="time" className={input} value={configs.opening_start || ''} onChange={event=>onChange({...configs,opening_start:event.target.value})} /></label><label className="block text-sm font-bold">Fecha às<input type="time" className={input} value={configs.opening_end || ''} onChange={event=>onChange({...configs,opening_end:event.target.value})} /></label></div>
    <fieldset><legend className="font-bold text-sm mb-3">Dias de atendimento</legend><div className="grid grid-cols-4 sm:grid-cols-7 gap-2">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((day,index)=><button type="button" key={day} aria-pressed={days.includes(index)} className={`py-3 min-w-0 rounded-xl text-sm font-bold ${days.includes(index)?'bg-vovoh-red':'bg-white/5'}`} onClick={()=>onChange({...configs,working_days:days.includes(index)?days.filter((value:number)=>value!==index):[...days,index]})}>{day}</button>)}</div></fieldset>
    <button className={button} disabled={saving} onClick={()=>onSaveMany({opening_start:configs.opening_start || '',opening_end:configs.opening_end || '',working_days:JSON.stringify(days)})}>{saving ? 'Salvando...' : 'Salvar atendimento'}</button>
    <p className="text-xs text-zinc-400">Selecione os dias e salve para aplicar. Nenhum dia selecionado significa sem atendimento.</p>
    <div className="border-t border-white/10 pt-5 space-y-3"><h4 className="font-bold">Fechar a loja agora</h4><p className="text-sm text-zinc-400">Use em feriados ou imprevistos. Esta opção é salva imediatamente.</p><button role="switch" type="button" aria-label="Fechar loja agora" aria-checked={configs.force_closed==='true'} disabled={saving} className="px-5 py-3 bg-white/10 rounded-xl font-bold" onClick={()=>onSave('force_closed',configs.force_closed==='true'?'false':'true')}>{configs.force_closed==='true'?'Loja fechada — reabrir':'Loja aberta — fechar agora'}</button></div>
  </section>;
}

export function AddressSettings({configs,onChange,onSaveAddress,saving}: {configs:Record<string,any>;onChange:React.Dispatch<React.SetStateAction<Record<string,any>>>;onSaveAddress:()=>void;saving:boolean}) {
  const [searching,setSearching]=useState(false); const [error,setError]=useState('');
  const controller=useRef<AbortController|null>(null); const sequence=useRef(0);
  useEffect(()=>()=>{sequence.current++;controller.current?.abort();},[]);
  const edit=(key:string,value:string)=>{sequence.current++;controller.current?.abort();setSearching(false);onChange(previous=>({...previous,[key]:value}));};
  return <section className={panel} aria-label="Endereço da loja">
    <h3 className="font-bold text-xl">Endereço de saída das entregas</h3><p className="text-sm text-zinc-400">Preenchido com o endereço informado. É usado internamente para o frete; a apresentação pública continua em Curitiba. Ao mudar de local, confirme também o ponto no mapa.</p>
    <label className="block text-sm font-bold">CEP da loja<input className={input} inputMode="numeric" placeholder="Opcional" value={configs.store_cep || ''} onChange={event=>edit('store_cep',formatCep(event.target.value))} /></label>
    <button type="button" disabled={searching} className="px-4 py-3 rounded-xl bg-white/10 font-bold" onClick={async()=>{
      const current=++sequence.current;controller.current?.abort();const next=new AbortController();controller.current=next;setSearching(true);setError('');
      try{const result=await lookupCep(configs.store_cep || '',next.signal);if(current!==sequence.current)return;onChange(previous=>({...previous,store_street:result.street,store_neighborhood:result.neighborhood,store_city:result.city,store_state:result.state}));}
      catch(error){if(current===sequence.current)setError(error instanceof Error?error.message:'Preencha manualmente.');}
      finally{if(current===sequence.current)setSearching(false);}
    }}>{searching?'Buscando...':'Buscar CEP da loja'}</button>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {([['store_street','Rua / avenida'],['store_number','Número da loja'],['store_neighborhood','Bairro da loja'],['store_city','Cidade da loja'],['store_state','Estado (UF)']] as const).map(([key,label])=><label key={key} className="block font-bold text-sm">{label}<input className={input} value={configs[key] || ''} onChange={event=>edit(key,key==='store_state'?event.target.value.toUpperCase().slice(0,2):event.target.value)} /></label>)}
    <details className="min-w-0 border-t border-white/10 pt-4"><summary className="font-bold cursor-pointer py-2">Ponto no mapa</summary><div className="space-y-4 pt-3 min-w-0"><label className="block text-sm font-bold">Link completo do Google Maps<input type="url" className={input} placeholder="Cole o link do ponto da loja" onChange={event=>{const match=event.target.value.match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/);if(match)onChange(previous=>({...previous,store_lat:match[1],store_lng:match[2]}));}} /></label><p className="text-xs text-zinc-400">As coordenadas do endereço informado já estão preenchidas.</p>{[['store_lat','Latitude da loja'],['store_lng','Longitude da loja']].map(([key,label])=><label className="block text-sm" key={key}>{label}<input className={input} inputMode="decimal" value={configs[key] || ''} onChange={event=>edit(key,event.target.value)} /></label>)}</div></details>
    <button className={button} disabled={saving} onClick={onSaveAddress}>{saving?'Salvando...':'Salvar endereço'}</button>
  </section>;
}

export function PaymentSettings({configs,saved,onChange,onSave,saving}: Props) {
  return <section className={panel} aria-label="Pagamentos"><h3 className="text-xl font-bold">Formas de pagamento</h3><label className="block text-sm font-bold">Chave PIX<input className={input} value={configs.pix_key || ''} onChange={event=>onChange({...configs,pix_key:event.target.value})} /></label><p className="text-sm text-zinc-400">Informe a chave real para o cliente pagar. A loja precisa conferir o recebimento.</p><button className={button} disabled={saving} onClick={()=>onSave('pix_key',configs.pix_key || '')}>Salvar Pix</button><div className="border-t border-white/10 pt-5 space-y-3"><h4 className="font-bold">Dinheiro na entrega</h4><p className="text-sm text-zinc-400">Ao ativar, o cliente pode informar se precisa de troco.</p><button type="button" role="switch" aria-checked={saved?.cash_enabled==='true'} disabled={saving || !saved} className="px-5 py-3 rounded-xl bg-white/10 font-bold" onClick={()=>onSave('cash_enabled',saved?.cash_enabled==='true'?'false':'true')}>{saved?.cash_enabled==='true'?'Desativar dinheiro':'Ativar dinheiro'}</button></div><p className="text-sm text-zinc-400">Cartão online depende da configuração do processador de pagamentos.{configs.preview_mode === 'true' ? ' Na prévia, ainda não está habilitado.' : ''}</p></section>;
}

