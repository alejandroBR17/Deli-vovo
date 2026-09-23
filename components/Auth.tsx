import React, { useState } from 'react';
import { X, User, Mail, Lock, Phone, LogOut, Loader2, Heart, ShieldCheck } from 'lucide-react';
import { User as UserType } from '../types/index';

interface AuthProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  setUser: (u: UserType | null) => void;
  showMsg: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AuthModal = ({ isOpen, onClose, user, setUser, showMsg }: AuthProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', phone: '' });

  if (!isOpen) return null;

  const handleLogout = () => {
    localStorage.removeItem('vovoh_user');
    setUser(null);
    showMsg("Você saiu da conta. Volte sempre, querido!", "info");
    onClose();
  };

  const handleStartEdit = () => {
    if (user) {
      setEditData({ name: user.name, phone: user.phone || '' });
      setIsEditing(true);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!editData.name) {
      showMsg("O nome é obrigatório, meu anjo.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });

      const data = await res.json();
      if (data.success) {
        const updatedUser = { ...user, ...editData };
        localStorage.setItem('vovoh_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
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

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    try {
      // Cria um usuário visitante local
      const guestId = "CONV-" + Math.random().toString(36).substr(2, 9).toUpperCase();
      const guestUser: UserType = {
        id: guestId,
        name: "Visitante",
        email: "",
        phone: "",
        address: "",
        cart: '[]'
      };

      localStorage.setItem('vovoh_user', JSON.stringify(guestUser));
      setUser(guestUser);
      showMsg("Bem-vindo! Você está navegando como convidado.", "success");
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
      showMsg("Erro ao entrar como convidado.", "error");
    } finally {
      setGuestLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || (mode === 'register' && !formData.name)) {
      showMsg("Preencha todos os campos obrigatórios, meu anjo.", "error");
      return;
    }

    setLoading(true);
    
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;

    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email,
            password,
            phone: formData.phone
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          localStorage.setItem('vovoh_user', JSON.stringify(data.user));
          setUser(data.user);
          showMsg("Bem-vindo à família da Vovó! Que alegria ter você aqui.", "success");
          onClose();
        } else {
          console.error("Erro no cadastro:", data.error || "Desconhecido", data);
          showMsg(data.error || "Erro ao criar conta. Tente de novo, querido.", "error");
        }
      } else {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          localStorage.setItem('vovoh_user', JSON.stringify(data.user));
          setUser(data.user);
          showMsg(`Bem-vindo de volta, ${data.user.name.split(' ')[0]}!`, "success");
          onClose();
        } else {
          console.error("Erro no login:", data.error || "Desconhecido", data);
          showMsg(data.error || "E-mail ou senha incorretos, meu anjo.", "error");
        }
      }
    } catch (err) {
      console.error("Erro na Auth:", err);
      showMsg("Oops! O sinal da cozinha caiu. Tente novamente.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex flex-col justify-end items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={user ? onClose : undefined} />
      
      <div className="relative w-full desktop:max-w-[480px] h-[90vh] bg-[#F9F9F9] shadow-3xl flex flex-col rounded-t-[2.5rem] animate-sheet overflow-hidden border-t border-white/20">
        
        {/* Drag Handle Mobile */}
        <div className="w-full flex justify-center items-center h-8 bg-white shrink-0 cursor-pointer rounded-t-[2.5rem]" onClick={user ? onClose : undefined}>
           <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
        </div>

        <header className="px-6 py-4  flex justify-between items-center bg-white border-b border-gray-100 shrink-0 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-vovoh-dark text-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/5"><User size={22} strokeWidth={2.5}/></div>
            <div>
              <h3 className="text-xl font-black text-vovoh-dark tracking-tight leading-none">{user ? 'Seu Perfil' : 'Acesso'}</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Área do Cliente</p>
            </div>
          </div>
          {user && (
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-vovoh-dark hover:bg-gray-100 transition-all active:scale-90"><X size={20}/></button>
          )}
        </header>

        <div className="flex-grow overflow-y-auto p-6  space-y-8 bg-[#F9F9F9] no-scrollbar relative">
          {/* Background Decor */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-vovoh-red/5 rounded-full blur-3xl -z-0 pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
          
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
                        <input 
                          type="tel" 
                          placeholder="Seu WhatsApp" 
                          className="w-full p-5 pl-12 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red text-sm transition-colors" 
                          value={editData.phone} 
                          onChange={e => setEditData({...editData, phone: e.target.value})} 
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
                      <h3 className="text-2xl font-black text-vovoh-dark tracking-tight">{user.name}</h3>
                      {user.email && <p className="text-sm font-bold text-gray-400 mt-1">{user.email}</p>}
                      
                      {user.phone && (
                        <div className="flex items-center gap-2 mt-4 px-4 py-2 bg-gray-50 rounded-full text-xs font-black text-gray-500">
                          <Phone size={14} /> {user.phone}
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
                        <h4 className="font-black text-sm">Cliente da Vovó</h4>
                        <p className="text-[10px] uppercase tracking-widest opacity-80 mt-1">Sua conta está segura</p>
                      </div>
                    </div>

                    <button onClick={handleLogout} className="w-full py-5 bg-white text-vovoh-red font-black rounded-2xl shadow-sm border border-red-100 flex items-center justify-center gap-2 active:scale-95 transition-all">
                      <LogOut size={18} /> Sair da Conta
                    </button>
                  </>
               )}
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
               
               <div className="flex p-1 bg-gray-200/50 rounded-2xl">
                 <button onClick={() => setMode('login')} className={`flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-all ${mode === 'login' ? 'bg-white text-vovoh-dark shadow-sm' : 'text-gray-400'}`}>Entrar</button>
                 <button onClick={() => setMode('register')} className={`flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-all ${mode === 'register' ? 'bg-white text-vovoh-dark shadow-sm' : 'text-gray-400'}`}>Criar Conta</button>
               </div>

               <div className="text-center py-4">
                 <h3 className="text-2xl font-black text-vovoh-dark tracking-tight mb-2">
                   {mode === 'login' ? 'Bem-vindo de volta!' : 'Entre para a Família'}
                 </h3>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                   {mode === 'login' ? 'A vovó já estava com saudades' : 'Faça seu cadastro rapidinho'}
                 </p>
               </div>

               <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'register' && (
                    <div className="relative">
                      <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-400"><User size={18} /></div>
                      <input type="text" placeholder="Como a vovó deve te chamar?" className="w-full p-5 pl-12 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red text-sm transition-colors" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                  )}

                  <div className="relative">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-400"><Mail size={18} /></div>
                    <input type="email" placeholder="Seu melhor e-mail" className="w-full p-5 pl-12 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red text-sm transition-colors" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>

                  {mode === 'register' && (
                    <div className="relative">
                      <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-400"><Phone size={18} /></div>
                      <input type="tel" placeholder="Seu WhatsApp (Opcional)" className="w-full p-5 pl-12 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red text-sm transition-colors" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                  )}

                  <div className="relative">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-400"><Lock size={18} /></div>
                    <input type="password" placeholder="Sua senha secreta" className="w-full p-5 pl-12 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red text-sm transition-colors" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                  </div>

                  <button type="submit" disabled={loading} className="w-full py-5 mt-4 bg-vovoh-red text-white font-black rounded-2xl shadow-xl shadow-red-200 text-base flex items-center justify-center gap-3 active:scale-95 transition-all">
                    {loading ? <Loader2 className="animate-spin" /> : (mode === 'login' ? 'Entrar na Cozinha' : <><Heart size={18} className="fill-current"/> Cadastrar e Começar</>)}
                  </button>

                  <div className="relative py-4 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                    <span className="relative bg-[#F9F9F9] px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Ou</span>
                  </div>

                  <button 
                    type="button" 
                    onClick={handleGuestLogin} 
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
