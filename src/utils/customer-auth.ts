import {customerName,validCustomerName} from './customer-name.js';
export const normalizeEmail=(value:string)=>value.trim().toLowerCase();
export const validEmail=(value:string)=>value.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const normalizePhone=(value:string)=>value.replace(/\D/g,'');
export const validPhone=(value:string)=>/^(?:[1-9]\d\d{8,9}|55[1-9]\d\d{8,9})$/.test(value);
export function passwordIssue(password:string) {
 if(password.length<15)return 'Use pelo menos 15 caracteres. Uma frase é mais fácil de lembrar.';
 if(password.length>128)return 'Use no máximo 128 caracteres.';
 if(!password.trim())return 'A senha não pode conter apenas espaços.';
 if(/^(.)\1+$/u.test(password)||['123456789012345','1234567890123456','passwordpassword','qwertyuiopasdfgh'].includes(password.toLowerCase()))return 'Evite repetições ou sequências comuns. Prefira uma frase só sua.';
 return '';
}
export function registrationErrors(data:{name:string;email:string;phone:string;password:string;passwordConfirmation:string}) {
 const errors:Record<string,string>={};
 if(!validCustomerName(customerName(data.name))||customerName(data.name).length>100)errors.name='Informe seu nome com 3 a 100 caracteres.';
 if(!validEmail(normalizeEmail(data.email)))errors.email='Confira o e-mail. Exemplo: nome@email.com';
 if(data.phone && !validPhone(normalizePhone(data.phone)))errors.phone='Informe um WhatsApp válido com DDD, ou deixe vazio por enquanto.';
 const issue=passwordIssue(data.password);if(issue)errors.password=issue;
 if(!data.passwordConfirmation)errors.passwordConfirmation='Digite a senha novamente para confirmar.';
 else if(data.passwordConfirmation!==data.password)errors.passwordConfirmation='As senhas não coincidem. Confira as duas.';
 return errors;
}
