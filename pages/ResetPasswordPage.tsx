import React,{useEffect,useState} from 'react';
import {PasswordTools} from '../components/PasswordTools';
export default function ResetPasswordPage(){
 const [token]=useState(()=>new URLSearchParams(window.location.hash.split('?')[1]||'').get('token')||'');
 useEffect(()=>{window.history.replaceState(null,'','/#recuperar-senha');document.title='Redefinir senha | Delícias da Vovó';},[]);
 return <main className="max-w-lg mx-auto px-5 py-10"><div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6">{token?<PasswordTools mode="reset" token={token} onCancel={()=>window.location.assign('/')} onDone={()=>{try{localStorage.removeItem('vovoh_user');}catch{}window.location.assign('/#entrar');}}/>:<><h1 className="text-2xl">Abra o link do seu e-mail</h1><p className="mt-4 text-[var(--app-muted)]">Para redefinir a senha, abra o link de recuperação recebido. Se expirou, solicite outro pela opção Esqueci minha senha.</p><a href="/" className="inline-flex min-h-12 items-center underline mt-4">Voltar à loja</a></>}</div></main>;
}
