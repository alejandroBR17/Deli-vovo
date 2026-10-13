const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!));

/** Multipart email: no remote images, tracking pixels or external font dependencies. */
export function recoveryEmailContent(publicUrl: string, token: string, theme: 'light' | 'dark' = 'light') {
 const dark = theme === 'dark';
 const palette: Record<string,string> = dark ? {'#fff7ed':'#191b20','#ffffff':'#252830','#292524':'#f7ecdf','#57534e':'#c0b7b0','#f1d7c0':'#514947','#a63b20':'#ff9d8a'} : {};
 const origin = new URL(publicUrl);
 if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid recovery origin');
 const link = new URL('/#recuperar-senha?token=' + encodeURIComponent(token), origin).href;
 const safeLink = escapeHtml(link), site = escapeHtml(origin.origin), domain = escapeHtml(origin.hostname);
 return {
  text: `Delícias da Vovó Grazy\nRecuperação de senha\n\nRecebemos uma solicitação para redefinir a senha da sua conta.\n\nEscolha uma nova senha pelo link:\n${link}\n\nO link vale por 30 minutos e pode ser usado uma vez. Depois da troca, entre novamente no site.\n\nNão foi você? Ignore este e-mail. Solicitar um link não altera sua senha. Não compartilhe este link: ele dá acesso à redefinição da sua conta.\n\nAntes de continuar, confira que o endereço é ${origin.hostname}. Nunca pedimos sua senha, dados de cartão ou pagamento para recuperar sua conta.`,
  html: `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="${dark?'dark':'light'}"><meta name="supported-color-schemes" content="${dark?'dark':'light'}"><title>Recuperação de senha | Delícias da Vovó</title></head>
<body style="margin:0;padding:0;background-color:#fff7ed;color:#292524;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">Seu link para escolher uma nova senha. Válido por 30 minutos.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fff7ed"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px">
<tr><td style="padding:0 8px 22px"><p style="margin:0 0 6px;color:#a63b20;font-size:12px;font-weight:bold;letter-spacing:2px">DA COZINHA DA VOVÓ PARA VOCÊ</p><p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:1.2;font-weight:bold;color:#292524">Delícias da Vovó Grazy</p></td></tr>
<tr><td style="background-color:#ffffff;border:1px solid #f1d7c0;border-top:5px solid #dc171c;border-radius:20px;padding:28px">
<p style="margin:0 0 12px;color:#a63b20;font-size:12px;font-weight:bold;letter-spacing:1px">ACESSO À SUA CONTA</p>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;color:#292524">Vamos recuperar sua senha?</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#57534e">Recebemos uma solicitação para redefinir a senha da sua conta. Se foi você, use o botão abaixo para escolher uma nova.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#dc171c" style="border-radius:12px"><a href="${safeLink}" style="display:inline-block;padding:17px 24px;border:1px solid #dc171c;border-radius:12px;background-color:#dc171c;color:#fff;font-size:16px;font-weight:bold;line-height:1.3;text-align:center;text-decoration:none">Escolher nova senha</a></td></tr></table>
<p style="margin:16px 0 24px;font-size:13px;line-height:1.6;color:#57534e"><strong>Válido por 30 minutos · Uso único</strong><br>Depois da troca, entre novamente no site.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="background-color:#fff7ed;border:1px solid #f1d7c0;border-radius:12px;padding:16px"><p style="margin:0 0 7px;font-size:15px;font-weight:bold;color:#292524">Não foi você?</p><p style="margin:0;font-size:14px;line-height:1.6;color:#57534e">Pode ignorar esta mensagem. Solicitar um link não altera sua senha. Não compartilhe este link: ele permite redefinir a senha da sua conta.</p></td></tr></table>
<p style="margin:24px 0 8px;font-size:13px;line-height:1.6;color:#57534e">Se o botão não abrir, copie o endereço abaixo e cole no navegador:</p>
<p style="margin:0;font-size:12px;line-height:1.7;word-break:break-all;overflow-wrap:anywhere"><a href="${safeLink}" style="color:#a63b20;text-decoration:underline;word-break:break-all">${safeLink}</a></p>
</td></tr>
<tr><td style="padding:20px 8px 0;text-align:center"><p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#57534e">Confira o endereço antes de continuar:<br><a href="${site}" style="color:#a63b20;font-weight:bold;text-decoration:underline">${domain}</a></p><p style="margin:0;font-size:12px;line-height:1.6;color:#57534e">Nunca pedimos sua senha, dados de cartão ou pagamento para recuperar sua conta.</p></td></tr>
</table></td></tr></table></body></html>`.replace(/#(?:fff7ed|ffffff|292524|57534e|f1d7c0|a63b20)\b/g, color => palette[color] || color)
 };
}
