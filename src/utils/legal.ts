export const LEGAL_VERSION='2026-10-13.1';
export const guestNotice='Como convidado, seu acesso fica vinculado a este navegador. Ao apagar os dados, encerrar a sessão ou trocar de aparelho, você pode perder o acesso ao perfil e ao histórico. Os pedidos enviados continuam registrados pela loja. Não há recuperação por senha para convidados.';
export function legalReceipt(value:unknown,userId:string) {
 const input=value as {accepted?:unknown;termsVersion?:unknown;privacyVersion?:unknown}|null;
 if(!input || input.accepted!==true || input.termsVersion!==LEGAL_VERSION || input.privacyVersion!==LEGAL_VERSION)throw new Error('Leia e aceite os Termos de Uso e confirme a ciência da Política de Privacidade antes de pedir.');
 return {termsVersion:LEGAL_VERSION,privacyVersion:LEGAL_VERSION,acceptedAt:new Date().toISOString(),userId};
}
