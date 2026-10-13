import nodemailer from 'nodemailer';
import {validEmail} from '../src/utils/customer-auth.js';
export function passwordEmailReady(){
 try {const url=new URL(process.env.AUTH_PUBLIC_URL||'');const port=Number(process.env.AUTH_SMTP_PORT||465);const gmail=process.env.AUTH_SMTP_HOST==='smtp.gmail.com';return !!(process.env.AUTH_SMTP_USER&&process.env.AUTH_SMTP_PASSWORD&&process.env.AUTH_SMTP_HOST&&[465,587].includes(port)&&validEmail(process.env.AUTH_EMAIL_FROM||'')&&(!gmail||(process.env.AUTH_SMTP_PASSWORD.replace(/\s/g,'').length===16&&process.env.AUTH_EMAIL_FROM?.toLowerCase()===process.env.AUTH_SMTP_USER.toLowerCase()))&&url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash);}catch{return false;}
}
export async function sendPasswordRecovery(email:string,token:string){
 if(!passwordEmailReady())throw new Error('Email unavailable');
 const port=Number(process.env.AUTH_SMTP_PORT||465);if(![465,587].includes(port))throw new Error('Invalid SMTP port');
 const transport=nodemailer.createTransport({host:process.env.AUTH_SMTP_HOST,port,secure:port===465,requireTLS:true,auth:{user:process.env.AUTH_SMTP_USER,pass:process.env.AUTH_SMTP_HOST==='smtp.gmail.com'?process.env.AUTH_SMTP_PASSWORD!.replace(/\s/g,''):process.env.AUTH_SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
 const link=new URL('/#recuperar-senha?token='+encodeURIComponent(token),process.env.AUTH_PUBLIC_URL!).href;
 try {const result=await transport.sendMail({from:{name:'Delícias da Vovó',address:process.env.AUTH_EMAIL_FROM!},to:email,subject:'Redefina sua senha — Delícias da Vovó',text:`Recebemos uma solicitação para redefinir a senha da sua conta.\n\nAbra este link para escolher uma nova senha:\n${link}\n\nO link vale por 30 minutos e pode ser usado uma vez. Se você não pediu, ignore esta mensagem. Sua senha não foi alterada.`});if(!result.accepted?.includes(email))throw new Error('Email not accepted');}finally{transport.close();}
}
