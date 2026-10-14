import React, { useRef } from 'react';
import { Plus, Trash2, Upload, Loader2 } from 'lucide-react';
import { AdminDialog, MoneyInput } from './AdminDialog';
import { CATEGORIES, PLACEHOLDER_IMG } from '../constants/index';

const field = 'w-full min-w-0 p-3 bg-white/5 rounded-xl border border-white/15 outline-none focus:border-vovoh-red text-base';
const cancel = 'flex-1 py-3 rounded-xl bg-white/5 font-bold';
const save = 'flex-1 py-3 rounded-xl bg-vovoh-red font-bold disabled:opacity-50';

export function ProductEditor({ product, adding, onChange, onClose, onSave, saving, uploading, onUpload }: any) {
  const photoInput = useRef<HTMLInputElement>(null);
  const options = (key: 'variations' | 'additionals', title: string, description: string) => (
    <section className="space-y-3 border-t border-white/10 pt-4">
      <div><h3 className="text-lg font-bold">{title}</h3><p className="text-sm text-zinc-400 mt-1">{description}</p></div>
      {(product[key] || []).map((option: any, index: number) => <div key={index} className="space-y-3 p-3 bg-white/5 rounded-xl min-w-0">
        <label className="block text-sm font-bold">Nome da opção
          <input className={field + ' mt-2'} value={option.name} onChange={event => onChange({...product, [key]: product[key].map((item: any, i: number) => i === index ? {...item, name:event.target.value} : item)})} />
        </label>
        <MoneyInput id={`${key}-${index}-price`} label="Valor adicional ao preço base" value={option.price} onChange={value => onChange({...product, [key]: product[key].map((item: any, i: number) => i === index ? {...item, price:value} : item)})} />
        <button type="button" aria-label={`Remover ${title.toLowerCase()} ${index + 1}`} className="flex items-center gap-2 text-red-300 p-2 rounded-lg" onClick={() => onChange({...product, [key]: product[key].filter((_: any, i: number) => i !== index)})}><Trash2 size={16} />Remover opção</button>
      </div>)}
      <button type="button" className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-white/20 rounded-xl font-bold text-sm" onClick={() => onChange({...product, [key]: [...(product[key] || []), {name:'',price:0}]})}><Plus size={18} />Adicionar {key === 'variations' ? 'variação' : 'adicional'}</button>
    </section>
  );
  return <AdminDialog title={adding ? 'Novo produto' : 'Editar produto'} onClose={() => {if (!saving) onClose();}} footer={<><button type="button" className={cancel} disabled={saving} onClick={onClose}>Cancelar</button><button type="button" className={save} disabled={saving || uploading} onClick={() => onSave(product)}>{saving ? 'Salvando...' : 'Salvar produto'}</button></>}>
    <fieldset disabled={saving} className="min-w-0 space-y-5">
    <p className="text-sm text-zinc-400">Cadastre primeiro nome, preço e categoria. Foto, descrição e opções são complementares.</p>
    <div className="flex items-center gap-4 min-w-0">
      <img src={product.image || PLACEHOLDER_IMG} alt="Foto do produto" className="w-20 h-20 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-bold">Foto do produto</p>
        <input ref={photoInput} aria-label="Foto do produto" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || saving} className="hidden" onChange={onUpload} />
        <button type="button" disabled={uploading || saving} onClick={() => photoInput.current?.click()} className="flex items-center justify-center gap-2 w-full px-3 py-3 rounded-xl bg-vovoh-red font-bold text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          {uploading ? <Loader2 size={18} className="animate-spin shrink-0" aria-hidden="true" /> : <Upload size={18} className="shrink-0" aria-hidden="true" />}
          {uploading ? 'Preparando foto...' : product.image ? 'Trocar foto' : 'Escolher foto'}
        </button>
        <p className="text-xs text-zinc-400">JPG, PNG ou WebP</p>
      </div>
    </div>
    <label className="block text-sm font-bold">Nome do produto<input className={field + ' mt-2'} autoComplete="off" maxLength={120} value={product.name || ''} onChange={event => onChange({...product,name:event.target.value})} /></label>
    <MoneyInput id="product-base-price" label="Preço base" value={product.price} onChange={value => onChange({...product,price:value})} hint="Digite, por exemplo, 5,50. O valor será formatado ao sair do campo." />
    <label className="block text-sm font-bold">Categoria<select className={field + ' mt-2'} value={product.category || ''} onChange={event => onChange({...product,category:event.target.value})}><option value="" disabled>Selecione uma categoria</option>{CATEGORIES.filter(category => category.id !== 'todos').map(category => <option key={category.id} value={category.id} className="bg-zinc-900">{category.label}</option>)}</select></label>
    <label className="block text-sm font-bold">Descrição <span className="font-normal text-zinc-400">(opcional)</span><textarea className={field + ' mt-2 min-h-24 resize-y'} value={product.description || ''} onChange={event => onChange({...product,description:event.target.value})} /></label>
    {options('variations', 'Variações', 'O cliente escolhe uma opção, como tamanho ou sabor. O valor informado soma ao preço base; use zero se não houver acréscimo.')}
    {options('additionals', 'Adicionais', 'O cliente pode escolher vários complementos. Cada valor soma ao pedido.')}
    </fieldset>
  </AdminDialog>;
}

export function CouponEditor({ coupon, adding, onChange, onClose, onSave, saving }: any) {
  return <AdminDialog title={adding ? 'Novo cupom' : 'Editar cupom'} onClose={() => {if (!saving) onClose();}} footer={<><button type="button" className={cancel} disabled={saving} onClick={onClose}>Cancelar</button><button type="button" className={save} disabled={saving} onClick={() => onSave(coupon)}>{saving ? 'Salvando...' : 'Salvar cupom'}</button></>}>
    <fieldset disabled={saving} className="min-w-0 space-y-5">
    <p className="text-sm text-zinc-400">Escolha um código para divulgar e o desconto aplicado aos produtos. O frete não recebe desconto.</p>
    <label className="block text-sm font-bold">Código do cupom<input className={field + ' mt-2 uppercase'} placeholder="Ex.: VOVO10" maxLength={32} disabled={!adding} value={coupon.code} onChange={event => onChange({...coupon,code:event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,'')})} /></label>
    <fieldset className="space-y-2"><legend className="text-sm font-bold mb-2">Tipo de desconto</legend><div className="grid grid-cols-2 gap-2">{[['percent','Porcentagem (%)'],['fixed','Valor em reais']].map(([type,label]) => <button key={type} type="button" aria-pressed={coupon.type === type} onClick={() => onChange({...coupon,type,discount:''})} className={`p-3 rounded-xl text-sm font-bold border ${coupon.type === type ? 'border-vovoh-red bg-vovoh-red/20' : 'border-white/10'}`}>{label}</button>)}</div></fieldset>
    {coupon.type === 'fixed' ? <MoneyInput id="coupon-fixed-discount" label="Valor do desconto" value={coupon.discount} onChange={value => onChange({...coupon,discount:value})} hint="Ex.: R$ 5,00 de desconto nos produtos." /> : <div><label htmlFor="coupon-percent" className="block text-sm font-bold">Porcentagem do desconto</label><input id="coupon-percent" aria-describedby="coupon-percent-hint" className={field + ' mt-2'} inputMode="decimal" placeholder="Ex.: 10 para 10%" value={coupon.discount} onChange={event => onChange({...coupon,discount:event.target.value.replace(/[^\d.,]/g,'')})} /><p id="coupon-percent-hint" className="block text-xs text-zinc-400 mt-2">Informe um valor maior que zero e até 100. Digitar 1 corresponde a 1%.</p></div>}
    </fieldset>
  </AdminDialog>;
}
