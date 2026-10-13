import React, { useState, useRef, useEffect, useId } from 'react';
import { X, User, Mail, Lock, Phone, LogOut, Loader2, Heart, ShieldCheck,Eye,EyeOff,CheckCircle2 } from 'lucide-react';
import { useModalFocus } from '../src/hooks/use-modal-focus';
import { customerName, validCustomerName, localGuest } from '../src/utils/customer-name';
import { User as UserType } from '../types/index';
import {PhoneInput} from './PhoneInput';
import {formatWhatsApp} from '../src/utils/phone-input';
import {guestNotice} from '../src/utils/legal';
import {normalizeEmail,validEmail,normalizePhone,validPhone,registrationErrors,passwordIssue} from '../src/utils/customer-auth';

interface AuthProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  setUser: (u: UserType | null) => void;
  onGuestName?: (name: string, phone?: string) => void;
  showMsg: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AuthModal = ({ isOpen, onClose, user, setUser, showMsg, onGuestName }: AuthProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestError, setGuestError] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', password: '', passwordConfirmation:'',phone: '' });
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const [formError,setFormError]=useState('');
  const [visiblePassword,setVisiblePassword]=useState(false);
  const [capsLock,setCapsLock]=useState(false);
  const formId=useId();
  useEffect(()=>{if(!isOpen){setFormData(previous=>({...previous,password:'',passwordConfirmation:''}));setVisiblePassword(false);setCapsLock(false);setFieldErrors({});setFormError('');}},[isOpen]);
  const changeField=(key:keyof typeof formData,value:string)=>{setFormData(previous=>({...previous,[key]:value}));setFieldErrors(previous=>{const next={...previous};delete next[key];return next;});setFormError('');};
  const switchMode=(next:'login'|'register')=>{setMode(next);setFieldErrors({});setFormError('');setVisiblePassword(false);setFormData(previous=>({...previous,password:'',passwordConfirmation:''}));};
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', phone: '' });

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, isOpen, onClose);
  if (!isOpen) return null;

  const handleLogout = async () => {
    try { const response = await fetch('/api/auth/logout', { method: 'POST' }); if (!response.ok) throw new Error(); } catch { showMsg('Não foi possível sair. Tente novamente.', 'error'); return; }
    localStorage.removeItem('vovoh_user');
    setGuestMode(false); setGuestName(''); setIsEditing(false);
    setUser(null);
    showMsg("Você saiu da conta. Volte sempre, querido!", "info");
    onClose();
  };

  const handleStartEdit = () => {
    if (user) {
      setEditData({ name: customerName(user.name), phone: user.phone || '' });
      setIsEditing(true);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validCustomerName(editData.name)) {
      showMsg("O nome é obrigatório, meu anjo.", "error");
      return;
    }
    if(editData.phone&&!validPhone(normalizePhone(editData.phone))){showMsg('Confira o WhatsApp com DDD.','error');return;}

    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...editData, name:customerName(editData.name)})
      });

      const data = await res.json();
      if (data.success) {
        const updatedUser = { ...user, ...editData };
        localStorage.setItem('vovoh_user', JSON.stringify(updatedUser));
        setUser(updatedUser);if(localGuest(updatedUser))onGuestName?.(updatedUser.name,updatedUser.phone);
        showMsg("Perfil atualizado com sucesso!", "success");
        setIsEditing(false);
      } else {
        showMsg(data.error || "Erro ao atualizar perfil.", "error");
      }
    } catch (err) {
      showMsg("Erro ao conectar com o servidor.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validCustomerName(guestName)) { setGuestError('Informe seu nome com pelo menos 3 caracteres.'); return; }
    if (!/^(?:\d{10,11}|55\d{10,11})$/.test(guestPhone)) { setGuestError('Informe o WhatsApp com DDD.'); return; }
    setGuestError('');
    setGuestLoading(true);
    try {
      const response=await fetch('/api/auth/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:guestName,phone:guestPhone}),signal:AbortSignal.timeout(15000)});
      const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||'Não foi possível entrar como convidado.');
      const guestUser:UserType=result.user;const guestId=guestUser.id;

      try {localStorage.setItem('vovoh_user', JSON.stringify(guestUser));} catch {}
      setUser(guestUser);
      onGuestName?.(guestUser.name, guestUser.phone || undefined);
      showMsg("Pronto! Continue seu pedido sem criar uma conta.", "success");
      onClose();

      // Registra a visita no backend de forma silenciosa
      const sessionId = localStorage.getItem('vovoh_browser_session_id');
      if (sessionId) {
        fetch('/api/visits/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userId: guestId,
            authType: 'guest'
          })
        }).catch(console.error);
      }
    } catch (error: any) {
      console.error("Erro no login anônimo:", error);
      setGuestError(error instanceof Error ? error.message : 'Não foi possível entrar como convidado.');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(loading)return;
    const errors=mode==='register'?registrationErrors(formData):{...(!validEmail(normalizeEmail(formData.email))?{email:'Confira seu e-mail. Exemplo: nome@email.com'}:{}),...(!formData.password?{password:'Informe sua senha para entrar.'}:{})};
    setFieldErrors(errors);setFormError('');
    if(Object.keys(errors).length){(e.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>(`[name="${Object.keys(errors)[0]}"]`)?.focus();return;}

    setLoading(true);

    const email = normalizeEmail(formData.email);
    const password = formData.password;

    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customerName(formData.name),
            email,
            password,
            passwordConfirmation:formData.passwordConfirmation,
            phone: normalizePhone(formData.phone)
          }),signal:AbortSignal.timeout(15000)
        });

        const data = await res.json();
        if (res.ok && data.success) {
          try{localStorage.setItem('vovoh_user', JSON.stringify(data.user));}catch{}
          setUser(data.user);
          showMsg("Bem-vindo à família da Vovó! Que alegria ter você aqui.", "success");
          onClose();
        } else {
          if(data.fieldErrors)setFieldErrors(data.fieldErrors);
          setFormError(data.error || 'Não foi possível criar a conta. Confira os dados e tente novamente.');
        }
      } else {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password
          }),signal:AbortSignal.timeout(15000)
        });

        const data = await res.json();
        if (res.ok && data.success) {
          try{localStorage.setItem('vovoh_user', JSON.stringify(data.user));}catch{}
          setUser(data.user);
          showMsg(`Bem-vindo de volta, ${data.user.name.split(' ')[0]}!`, "success");
          onClose();
        } else {
          setFormError(data.error || 'Confira seu e-mail e senha.');
        }
      }
    } catch (err) {
      setFormError('Não foi possível conectar. Seus dados continuam aqui para tentar novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex flex-col justify-end md:items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={user ? "Seu perfil" : "Acesso à loja"} tabIndex={-1} className="relative w-full md:max-w-md lg:max-w-lg h-[92dvh] md:h-full bg-[#F9F9F9] shadow-3xl flex flex-col rounded-t-[2.5rem] md:rounded-none md:rounded-l-[2.5rem] animate-sheet md:animate-drawer overflow-hidden border-t md:border-t-0 md:border-l border-white/20 z-10">

        {/* Drag Handle Mobile */}
        <div className="w-full flex md:hidden justify-center items-center h-8 bg-white shrink-0 cursor-pointer rounded-t-[2.5rem]" onClick={user ? onClose : undefined}>
           <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
        </div>

        <header className="px-6 py-4 md:py-5 flex justify-between items-center bg-white border-b border-gray-100 shrink-0 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-vovoh-dark text-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/5"><User size={22} strokeWidth={2.5}/></div>
            <div>
              <h3 className="text-xl font-black text-vovoh-dark tracking-tight leading-none">{user ? 'Seu Perfil' : guestMode ? 'Pedir sem conta' : 'Acesso'}</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Área do Cliente</p>
            </div>
          </div>
          {(
            <button aria-label="Fechar perfil" onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-vovoh-dark hover:bg-gray-100 transition-all active:scale-90"><X size={20}/></button>
          )}
        </header>

        <div className="flex-grow min-h-0 overflow-y-auto overflow-x-hidden p-6 space-y-8 bg-[#F9F9F9] no-scrollbar relative">
          {/* Background Decor */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute top-0 right-0 w-64 h-64 bg-vovoh-red/5 rounded-full blur-3xl -z-0 translate-x-1/2 -translate-y-1/2" /></div>

          {user ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95">
               {isEditing ? (
                  <form onSubmit={handleUpdateProfile} className="space-y-4 animate-in slide-in-from-right-4">
                    <div className="text-center mb-6">
                      <h4 className="text-xl font-black text-vovoh-dark">Editar Seus Dados</h4>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Mantenha seu cadastro atualizado</p>
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-400"><User size={18} /></div>
                        <input
                          type="text"
                          placeholder="Como a vovó deve te chamar?"
                          className="w-full p-5 pl-12 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red text-sm transition-colors"
                          value={editData.name}
                          onChange={e => setEditData({...editData, name: e.target.value})}
                        />
                      </div>

                      <div className="relative">
                        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-400"><Phone size={18} /></div>
                        <PhoneInput
                          aria-label="WhatsApp do perfil"
                          placeholder="Seu WhatsApp"
                          className="w-full p-5 pl-12 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red text-sm transition-colors"
                          value={editData.phone}
                          onValueChange={phone=>setEditData({...editData,phone})}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="flex-1 py-4 bg-gray-100 text-gray-500 font-black rounded-2xl text-sm active:scale-95 transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-2 py-4 bg-vovoh-red text-white font-black rounded-2xl shadow-lg shadow-red-100 text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : 'Salvar Mudanças'}
                      </button>
                    </div>
                  </form>
               ) : (
                  <>
                    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-24 bg-vovoh-red/10"></div>
                      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-3xl font-black text-vovoh-red shadow-lg border-4 border-white relative z-10 mb-4 uppercase">
                        {user.name.charAt(0)}
                      </div>
                      <h3 className="text-2xl font-black text-vovoh-dark tracking-tight">{customerName(user.name) || "Escolha seu nome"}</h3>
                      {user.email && <p className="text-sm font-bold text-gray-400 mt-1">{user.email}</p>}

                      {user.phone && (
                        <div className="flex items-center gap-2 mt-4 px-4 py-2 bg-gray-50 rounded-full text-xs font-black text-gray-500">
                          <Phone size={14} /> {formatWhatsApp(user.phone)}
                        </div>
                      )}

                      <button
                        onClick={handleStartEdit}
                        className="mt-6 text-xs font-black text-vovoh-red uppercase tracking-widest hover:underline"
                      >
                        Editar Perfil
                      </button>
                    </div>

                    <div className="bg-vovoh-gold text-white p-6 rounded-[2rem] shadow-lg flex items-center gap-4">
                      <ShieldCheck size={32} className="opacity-80"/>
                      <div>
                        <h4 className="font-black text-sm">{localGuest(user)?'Acesso como convidado':'Cliente da Vovó'}</h4>
                        <p className="text-[10px] uppercase tracking-widest opacity-80 mt-1">{localGuest(user)?'Vinculado a este navegador, sem senha':'Proteja sua senha e seus dados'}</p>
                      </div>
                    </div>

                    <button onClick={handleLogout} className="w-full py-5 bg-white text-vovoh-red font-black rounded-2xl shadow-sm border border-red-100 flex items-center justify-center gap-2 active:scale-95 transition-all">
                      <LogOut size={18} /> Sair da Conta
                    </button>
                  </>
               )}
            </div>
          ) : guestMode ? (
            <form onSubmit={handleGuestLogin} className="relative space-y-5"><p role="note" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">{guestNotice}</p><p className="text-xs text-gray-600">Veja como usamos seus dados na <a href="/#privacidade" target="_blank" rel="noopener noreferrer" className="underline">Política de Privacidade (nova aba)</a>.</p>
              <div><h4 className="font-sans text-xl font-bold text-vovoh-dark">Como podemos te chamar?</h4><p className="text-sm text-gray-600 mt-2">Esse nome identifica você no pedido. Não precisa de e-mail ou senha.</p></div>
              <div><label htmlFor="guest-name" className="block text-sm font-semibold mb-2">Seu nome</label><input id="guest-name" autoFocus autoComplete="name" maxLength={100} value={guestName} onChange={event => {setGuestName(event.target.value);setGuestError('');}} aria-invalid={!!guestError} aria-describedby={guestError ? 'guest-name-error' : undefined} placeholder="Ex: Maria Silva" className="w-full min-h-12 p-3 rounded-xl bg-white border border-gray-300 outline-none focus:ring-2 focus:ring-vovoh-red/30" />{guestError && <p id="guest-name-error" role="alert" className="text-sm text-red-700 mt-2">{guestError}</p>}</div>
              <div><label htmlFor="guest-phone" className="block text-sm font-semibold mb-2">WhatsApp com DDD</label><PhoneInput id="guest-phone" autoComplete="tel" inputMode="tel" value={guestPhone} onValueChange={phone=>{setGuestPhone(phone);setGuestError('');}} placeholder="(41) 99999-9999" className="w-full min-h-12 p-3 rounded-xl bg-white border border-gray-300 outline-none focus:ring-2 focus:ring-vovoh-red/30"/><p className="text-xs text-gray-500 mt-2">Nome e WhatsApp identificam seu pedido. Não precisa de e-mail ou senha.</p></div>
              <button type="submit" disabled={guestLoading} className="w-full min-h-12 rounded-xl bg-vovoh-red text-white font-semibold">{guestLoading ? 'Continuando…' : 'Continuar pedido'}</button>
              <button type="button" onClick={() => setGuestMode(false)} className="w-full min-h-11 text-sm font-semibold text-gray-600">Voltar para entrar na conta</button>
            </form>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">

               <div className="flex p-1 bg-gray-200/50 rounded-2xl">
                 <button disabled={loading} onClick={() => switchMode('login')} className={`flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-all ${mode === 'login' ? 'bg-white text-vovoh-dark shadow-sm' : 'text-gray-400'}`}>Entrar</button>
                 <button disabled={loading} onClick={() => switchMode('register')} className={`flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-all ${mode === 'register' ? 'bg-white text-vovoh-dark shadow-sm' : 'text-gray-400'}`}>Criar Conta</button>
               </div>

               <div className="text-center py-4">
                 <h3 className="text-2xl font-black text-vovoh-dark tracking-tight mb-2">
                   {mode === 'login' ? 'Bem-vindo de volta!' : 'Entre para a Família'}
                 </h3>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                   {mode === 'login' ? 'A vovó já estava com saudades' : 'Crie sua conta com ajuda em cada etapa'}
                 </p>
               </div>

               <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  {mode==='register'&&<div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-paper)] p-4 text-sm text-[var(--app-muted)]">Uma conta permite acessar seus pedidos em outro aparelho. São só os dados abaixo; o endereço fica para o pedido. <a href="/#privacidade" target="_blank" rel="noopener noreferrer" className="underline text-[var(--app-brand)]">Ver Privacidade (nova aba)</a>.</div>}
                  {formError&&<p role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{formError}</p>}
                  {mode==='register'&&<div className="space-y-2"><label htmlFor={formId+'-name'} className="text-sm font-bold">Seu nome</label><input id={formId+'-name'} name="name" type="text" autoComplete="name" maxLength={100} required disabled={loading} placeholder="Como a vovó deve te chamar?" aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name?formId+'-name-error':undefined} className="w-full p-4 bg-white rounded-2xl border border-gray-200 outline-none focus:border-vovoh-red text-sm" value={formData.name} onChange={e=>changeField('name',e.target.value)}/>{fieldErrors.name&&<p role="alert" id={formId+'-name-error'} className="text-sm text-red-600">{fieldErrors.name}</p>}</div>}
                  <div className="space-y-2"><label htmlFor={formId+'-email'} className="text-sm font-bold">E-mail</label><div className="relative"><Mail aria-hidden="true" size={18} className="absolute left-4 top-4 text-gray-400"/><input id={formId+'-email'} name="email" type="email" inputMode="email" autoComplete={mode==='login'?'username':'email'} autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={254} disabled={loading} placeholder="nome@email.com" aria-invalid={!!fieldErrors.email} aria-describedby={formId+'-email-help'+(fieldErrors.email?' '+formId+'-email-error':'')} className="w-full p-4 pl-12 bg-white rounded-2xl border border-gray-200 outline-none focus:border-vovoh-red text-sm" value={formData.email} onChange={e=>changeField('email',e.target.value)} onBlur={()=>{const email=normalizeEmail(formData.email);changeField('email',email);if(email&&!validEmail(email))setFieldErrors(previous=>({...previous,email:'Confira o e-mail. Exemplo: nome@email.com'}));}}/></div><p id={formId+'-email-help'} className="text-xs text-gray-500">{mode==='register'?'Use um e-mail que você acessa. Ele será usado para entrar na conta.':'Use o mesmo e-mail informado no cadastro.'}</p>{fieldErrors.email&&<p role="alert" id={formId+'-email-error'} className="text-sm text-red-600">{fieldErrors.email}</p>}</div>
                  {mode==='register'&&<div className="space-y-2"><label htmlFor={formId+'-phone'} className="text-sm font-bold">WhatsApp (opcional)</label><PhoneInput id={formId+'-phone'} name="phone" value={formData.phone} onValueChange={value=>changeField('phone',value)} disabled={loading} placeholder="(41) 99999-9999" aria-invalid={!!fieldErrors.phone} aria-describedby={formId+'-phone-help'+(fieldErrors.phone?' '+formId+'-phone-error':'')} className="w-full p-4 bg-white rounded-2xl border border-gray-200 outline-none focus:border-vovoh-red text-sm"/><p id={formId+'-phone-help'} className="text-xs text-gray-500">Inclua o DDD. Podemos preencher este número no pedido; você poderá trocar depois.</p>{fieldErrors.phone&&<p role="alert" id={formId+'-phone-error'} className="text-sm text-red-600">{fieldErrors.phone}</p>}</div>}
                  <div className="space-y-2"><label htmlFor={formId+'-password'} className="text-sm font-bold">Senha</label><div className="relative"><Lock aria-hidden="true" size={18} className="absolute left-4 top-4 text-gray-400"/><input id={formId+'-password'} name="password" type={visiblePassword?'text':'password'} autoComplete={mode==='register'?'new-password':'current-password'} maxLength={128} required disabled={loading} placeholder={mode==='register'?'Crie uma frase só sua':'Sua senha'} aria-invalid={!!fieldErrors.password} aria-describedby={formId+'-password-help'+(fieldErrors.password?' '+formId+'-password-error':'')} className="w-full p-4 pl-12 pr-14 bg-white rounded-2xl border border-gray-200 outline-none focus:border-vovoh-red text-sm" value={formData.password} onChange={e=>changeField('password',e.target.value)} onKeyUp={e=>setCapsLock(e.getModifierState('CapsLock'))} onBlur={()=>setCapsLock(false)}/><button type="button" aria-label={visiblePassword?'Ocultar senhas':'Mostrar senhas'} aria-pressed={visiblePassword} className="absolute right-1 top-1 min-w-12 min-h-12 flex items-center justify-center text-gray-500" onClick={()=>setVisiblePassword(v=>!v)}>{visiblePassword?<EyeOff size={20}/>:<Eye size={20}/>}</button></div><p id={formId+'-password-help'} className="text-xs text-gray-500">{mode==='register'?'De 15 a 128 caracteres. Vale uma frase com espaços; não precisa de símbolos ou maiúsculas. Evite senhas usadas em outros sites.':'Você pode colar ou usar a senha salva pelo navegador.'}</p>{capsLock&&<p role="status" className="text-xs text-amber-700">Caps Lock está ativado.</p>}{mode==='register'&&formData.password&&<p className={'text-xs flex gap-2 items-center '+(!passwordIssue(formData.password)?'text-green-600':'text-gray-500')}>{!passwordIssue(formData.password)&&<CheckCircle2 size={14}/>}{passwordIssue(formData.password)||'Senha atende às regras.'}</p>}{fieldErrors.password&&<p role="alert" id={formId+'-password-error'} className="text-sm text-red-600">{fieldErrors.password}</p>}</div>
                  {mode==='register'&&<div className="space-y-2"><label htmlFor={formId+'-passwordConfirmation'} className="text-sm font-bold">Confirmar senha</label><input id={formId+'-passwordConfirmation'} name="passwordConfirmation" type={visiblePassword?'text':'password'} autoComplete="new-password" maxLength={128} required disabled={loading} placeholder="Digite a mesma senha novamente" aria-invalid={!!fieldErrors.passwordConfirmation} aria-describedby={formId+'-confirmation-help'+(fieldErrors.passwordConfirmation?' '+formId+'-passwordConfirmation-error':'')} className="w-full p-4 bg-white rounded-2xl border border-gray-200 outline-none focus:border-vovoh-red text-sm" value={formData.passwordConfirmation} onChange={e=>changeField('passwordConfirmation',e.target.value)}/><p id={formId+'-confirmation-help'} className={'text-xs '+(formData.passwordConfirmation&&formData.passwordConfirmation===formData.password?'text-green-600':'text-gray-500')}>{formData.passwordConfirmation&&formData.passwordConfirmation===formData.password?'As senhas coincidem.':'Repita a senha para evitar erro de digitação.'}</p>{fieldErrors.passwordConfirmation&&<p role="alert" id={formId+'-passwordConfirmation-error'} className="text-sm text-red-600">{fieldErrors.passwordConfirmation}</p>}</div>}
                  <button type="submit" disabled={loading} className="w-full py-5 mt-4 bg-vovoh-red text-white font-black rounded-2xl shadow-xl shadow-red-200 text-base flex items-center justify-center gap-3 active:scale-95 transition-all">
                    {loading ? <Loader2 className="animate-spin" /> : (mode === 'login' ? 'Entrar na Cozinha' : <><Heart size={18} className="fill-current"/> Cadastrar e Começar</>)}
                  </button>

                  <div className="relative py-4 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                    <span className="relative bg-[#F9F9F9] px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Ou</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {setGuestMode(true);setGuestError('');}}
                    disabled={guestLoading}
                    className="w-full py-4 bg-white border border-gray-200 text-gray-500 font-black rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-gray-100 active:scale-95 transition-all shadow-sm"
                  >
                    {guestLoading ? <Loader2 className="animate-spin" size={18} /> : 'Continuar como convidado'}
                  </button>
               </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
