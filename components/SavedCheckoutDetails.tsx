import React, {useId, useState} from 'react';
import {Check, ChevronDown, MapPin, Phone, User, UserRoundPlus} from 'lucide-react';
import {customerName} from '../src/utils/customer-name';
import {formatWhatsApp} from '../src/utils/phone-input';
import {emptyCustomer, type CustomerDetails, type SavedCustomer} from '../src/utils/saved-checkout';

export function SavedCheckoutDetails({saved,customer,onApply}:{saved:SavedCustomer[];customer:CustomerDetails;onApply:(value:CustomerDetails)=>void}) {
  const [open,setOpen]=useState(false);
  const [partial,setPartial]=useState<string|null>(null);
  const [notice,setNotice]=useState('');
  const listId=useId();
  function apply(value:CustomerDetails,message:string) {
    onApply(value);setNotice(message);setOpen(false);setPartial(null);
  }
  if(!saved.length)return null;
  return <section className="saved-details" aria-label="Dados salvos para o pedido">
    <button type="button" className="saved-details-heading" aria-expanded={open} aria-controls={listId} onClick={()=>setOpen(!open)}>
      <span className="saved-details-icon"><User size={20}/></span>
      <span className="saved-details-title"><strong>Seus dados, sem digitar de novo</strong><small>Escolha quem recebe este pedido</small></span>
      <ChevronDown size={20} className={open?'rotate-180':''}/>
    </button>
    <p role="status" className="saved-details-notice">{notice}</p>
    <div id={listId} hidden={!open}>
      <p className="saved-details-hint">Toque em usar para preencher nome, WhatsApp e endereço. Você pode editar os campos depois.</p>
      <div className="saved-details-list">{saved.map((item,index)=>{
        const current=customerName(item.name)===customer.name && item.phone.replace(/\D/g,'')===customer.phone.replace(/\D/g,'') && item.address===customer.address;
        const optionsId=`${listId}-${index}`;
        return <article key={item.id} className="saved-details-card">
          <div className="saved-details-person"><strong>{customerName(item.name)||'Cadastro salvo'}</strong>{current && <span><Check size={13}/>Em uso</span>}</div>
          <p><Phone size={15}/><span>{formatWhatsApp(item.phone)}</span></p>
          <p><MapPin size={15}/><span>{item.address}</span></p>
          <div className="saved-details-actions">
            <button type="button" className="saved-details-use" aria-label={`Usar dados de ${customerName(item.name)}`} onClick={()=>apply(item,'Nome, WhatsApp e endereço preenchidos.')}><Check size={16}/>Usar estes dados</button>
            <button type="button" aria-expanded={partial===item.id} aria-controls={optionsId} onClick={()=>setPartial(partial===item.id?null:item.id)}>Usar só um dado</button>
          </div>
          <div id={optionsId} hidden={partial!==item.id} className="saved-details-options">
            <button type="button" onClick={()=>apply({...customer,name:customerName(item.name)},'Nome atualizado. WhatsApp e endereço mantidos.')}><User size={15}/>Só o nome</button>
            <button type="button" onClick={()=>apply({...customer,phone:item.phone},'WhatsApp atualizado. Nome e endereço mantidos.')}><Phone size={15}/>Só o WhatsApp</button>
            <button type="button" onClick={()=>apply({...customer,address:item.address,deliveryAddress:item.deliveryAddress},'Endereço atualizado. Nome e WhatsApp mantidos.')}><MapPin size={15}/>Só o endereço</button>
          </div>
        </article>;
      })}</div>
      <button type="button" className="saved-details-new" onClick={()=>apply({...emptyCustomer},'Campos limpos para outra pessoa. Os cadastros salvos foram mantidos.')}><UserRoundPlus size={18}/>Preencher para outra pessoa</button>
      <p className="saved-details-hint">Disponíveis somente neste navegador. Os dados são salvos após enviar o pedido.</p>
    </div>
  </section>;
}
