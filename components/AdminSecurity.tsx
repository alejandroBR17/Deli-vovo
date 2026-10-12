import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { adminFetch } from '../src/utils/admin-api';

export function AdminSecurity() {
  const [currentPassword,setCurrent]=useState(''),[newPassword,setNew]=useState(''),[confirmation,setConfirmation]=useState('');
  const [visible,setVisible]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault();setMessage('');setError('');
    if (newPassword !== confirmation) { setError('As novas senhas precisam ser iguais.');return; }
    setSaving(true);
    try {
      await adminFetch('/admin/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword,confirmation})});
      setCurrent('');setNew('');setConfirmation('');setVisible(false);
      setMessage('Senha alterada. Os outros acessos ao painel precisarão entrar novamente.');
    } catch (failure) { setError(failure instanceof Error?failure.message:'Não foi possível alterar a senha.'); }
    finally {setSaving(false);}
  }
  return <section className="min-w-0 bg-zinc-900/50 p-4 sm:p-6 rounded-2xl border border-white/10 space-y-5" aria-label="Segurança do painel">
    <h3 className="text-xl font-bold flex items-center gap-2"><ShieldCheck size={23} aria-hidden="true" />Senha do painel</h3>
    <p className="text-sm text-zinc-400">Troque a senha por aqui quando precisar. A alteração vale para todos os aparelhos que acessam o painel.</p>
    <form onSubmit={save} className="space-y-4">
      {([{id:'admin-current-password',label:'Senha atual',value:currentPassword,onChange:setCurrent,autoComplete:'current-password'},{id:'admin-new-password',label:'Nova senha',value:newPassword,onChange:setNew,autoComplete:'new-password'},{id:'admin-confirm-password',label:'Confirmar nova senha',value:confirmation,onChange:setConfirmation,autoComplete:'new-password'}]).map(field=><label key={field.id} htmlFor={field.id} className="block text-sm font-bold">{field.label}<input id={field.id} autoComplete={field.autoComplete} type={visible?'text':'password'} required maxLength={128} minLength={field.id==='admin-current-password'?undefined:8} value={field.value} onChange={event=>field.onChange(event.target.value)} disabled={saving} className="w-full min-w-0 p-3 mt-2 bg-white/5 border border-white/15 rounded-xl text-base outline-none focus:border-vovoh-red" /></label>)}
      <p className="text-xs text-zinc-400">Use pelo menos 8 caracteres. Guarde a nova senha em um lugar seguro.</p>
      <button type="button" aria-pressed={visible} onClick={()=>setVisible(!visible)} className="min-h-11 flex items-center gap-2 text-sm font-bold">{visible?<EyeOff size={18} aria-hidden="true" />:<Eye size={18} aria-hidden="true" />}{visible?'Ocultar senhas':'Mostrar senhas'}</button>
      {error&&<p role="alert" className="text-sm text-red-400">{error}</p>}{message&&<p role="status" className="text-sm text-green-400">{message}</p>}
      <button type="submit" disabled={saving} className="w-full sm:w-auto min-h-12 px-5 py-3 rounded-xl bg-vovoh-red text-white font-bold disabled:opacity-50">{saving?'Alterando…':'Alterar senha'}</button>
    </form>
  </section>;
}
