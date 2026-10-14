# Delícias da Vovó Grazy

Delivery artesanal com cardápio, checkout, pedidos agendados e painel da cozinha. Projeto aplicado a um negócio da família, desenvolvido com assistência de IA e validação da experiência pelo responsável.

[Acessar o site](https://delivovo.vercel.app/) · [Segurança](SECURITY.md) · [Licença do código](LICENSE) · [Marca e imagens](LICENSE-ASSETS.md)

![Logo da loja](public/vovo-logo-2026.webp)

## Funcionalidades

- Sacola com opções, cupons, frete e agendamento validados no servidor.
- Conta ou acesso como convidado, dados salvos, confirmação de senha, troca e recuperação por e-mail.
- Mercado Pago Checkout Pro com conferência de aprovação, valor, moeda, recebedor, referência e assinatura de webhook. Pix e dinheiro dependem das configurações da loja.
- Painel de catálogo, cupons, configurações, pedidos, estatísticas e modo de cozinha (KDS).
- Pedidos agendados podem ser confirmados sem iniciar preparo. Web Push é exclusivo dos aparelhos administrativos.
- PWA para Android, iOS e computador; temas claro/escuro/dispositivo, termos e política de privacidade.

Previsões não acompanham trânsito em tempo real. Stripe e Google Planilhas permanecem apenas como caminhos legados, sem participação na operação atual.

## Arquitetura

| Camada | Implementação |
| --- | --- |
| Interface | React 19, TypeScript, Tailwind CSS 3, Framer Motion, Lucide |
| API | Express e Vercel Functions |
| Persistência | Turso/libSQL; SQLite nos testes locais |
| Pagamentos | Mercado Pago Checkout Pro e webhook assinado |
| E-mail | Nodemailer/SMTP, somente no servidor |
| Avisos | Service Worker, Web Push e VAPID |

O servidor verifica identidade, preço, frete e aceite dos documentos antes do pagamento. Retornos do provedor são conferidos antes de criar o pedido, sem duplicação. Número completo do cartão e CVV não passam pela API da loja.

`api/` reúne endpoints; `server/`, persistência e integrações; `components/` e `pages/`, interface; `src/utils/`, regras compartilhadas; `public/`, imagens/PWA/SEO; `scripts/`, migrações e verificações; `tests/`, testes isolados; `docs/`, registros e documentação. `data/` é privado e ignorado pelo Git.

## Executar localmente

Use Node.js 22 ou 24 e npm. Não reutilize banco ou credenciais de produção.

```sh
git clone https://github.com/alejandroBR17/Deli-vovo.git
cd Deli-vovo
npm ci
```

Copie `.env.example` para `.env` e crie `data/`. No PowerShell:

```powershell
Copy-Item .env.example .env
New-Item -ItemType Directory -Force data
```

Configure uma senha administrativa própria e um segredo de sessão aleatório de pelo menos 32 caracteres. O exemplo usa SQLite em `data/delivery.db`, sem cardápio fictício.

```sh
npm run db:migrate
npm run dev
```

Abra `http://localhost:3000`; painel em `/#vovo-secreta`, protegido por autenticação. O nome da rota não é proteção. Para servir a aplicação compilada, use `npm run build` e `npm start` com `NODE_ENV=production`. `npm run preview` serve somente a interface, não a API.

## Verificação

```sh
npm run check:secrets
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

A CI roda essas verificações sem credenciais ou dados reais. O detector de padrões de credenciais é uma proteção adicional, não uma auditoria completa do histórico. O audit completo mantém um alerta não corrigido de `braces` na cadeia de build, detalhado em [SECURITY.md](SECURITY.md). Não use `npm audit fix --force` para migrar os estilos sem revisar a interface.

## Implantação

Projeto Vercel ativo: **delivovo**. Repositório canônico: **alejandroBR17/Deli-vovo**. Build: `npm run db:migrate && npm run build`; saída: `dist`. Production e Preview exigem credenciais isoladas. Não recrie uma branch do banco Production a cada deployment: cadastros e configurações devem persistir. Backups e dados pessoais ficam fora do Git.

Configure somente no servidor as variáveis Turso, Mercado Pago, SMTP, VAPID e sessões descritas em `.env.example`. Não use prefixo `VITE_` em chaves privadas. Mercado Pago exige conferência da conta recebedora e do webhook antes de habilitar checkout. Gmail usa senha de aplicativo, nunca a senha normal. `node generate-vapid.js` gera um arquivo privado local sem imprimir a chave; não regenere as chaves de aparelhos já inscritos sem planejar a atualização.

## Estado e limites

A aplicação está publicada; a preparação comercial ainda depende de produtos/preços, Pix, contato e confirmação dos horários/taxas pela loja. Recebimento e redefinição por e-mail foram confirmados pelo responsável; Android com avisos em segundo plano foi testado na prévia. Pedido/pagamento real em produção, avisos no domínio definitivo e teste físico no iPhone ainda exigem validação.

O cadastro ainda não confirma posse do e-mail; nome e telefone são autodeclarados. Convidados podem perder acesso ao limpar dados ou trocar de navegador, sem apagar os pedidos da loja. Instalações contam navegadores identificados, não pessoas únicas/desinstalações. SEO tem metadados, canonical, sitemap e dados básicos da marca; a SPA não garante indexação ou posição no Google.

## Licença

O código está sob [MIT](LICENSE). Marca, logotipos e fotos da família têm [condições próprias](LICENSE-ASSETS.md); a licença do código não autoriza representar a loja. Dependências e ícones de terceiros mantêm suas licenças originais.
