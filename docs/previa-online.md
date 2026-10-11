# Prévia online do Delivovo

Prévia mais recente, consolidada às 04h15 de 11/10: https://delivovo-b7zh5wk1k-alesobralcortes-9387s-projects.vercel.app , commit `27fd7f8`, deployment `dpl_D9SD7J8Fbevkt33HsGc3HDAQTJUr`, READY. Inclui cardápio vazio, opções pelo botão +, remoção de marketing fictício, menos gravações/consultas, checklist com configurações salvas, erros administrativos, horários de São Paulo e ícones PWA locais. Última suíte: 21 testes passaram no commit b539bb7; build local/remoto e conferência online/PWA passaram na versão consolidada. Produção confirmada inalterada. Detalhes, limitações e prioridades em [relatorio-madrugada-2026-10-11.md](relatorio-madrugada-2026-10-11.md).

Histórico: prévia verificada em 10/10/2026, no projeto Vercel `delivovo`, com código do repositório `alejandroBR17/Deli-vovo` no commit `3a144ffc79412a79414ed6e00a28f101a84e5598`.

URL: https://delivovo-78v26lto3-alesobralcortes-9387s-projects.vercel.app

Implantação: `dpl_AeN9e8SXCpHsb3dXxsSLMieEmftV`, estado READY, ambiente Preview (`target: null` na API). O domínio de produção permanece no deployment `dpl_EKmgjo17mWAGL8CSvve9bRnCSoXn`, commit `b1e6861d1d0556d2ff6326cfc3e4c2e8cc8b8538`.

As variáveis ADMIN_PASSWORD, ADMIN_SESSION_SECRET e VAPID_* foram configuradas somente para Preview. STRIPE_SECRET_KEY e VITE_STRIPE_PUBLISHABLE_KEY estão vazias somente em Preview, mantendo as configurações de produção e desenvolvimento. A integração Turso já ligada ao projeto fornece STORAGE_TURSO_* e está configurada para executar a ação de criação de branch por implantação. O comando desta prévia foi `npm run db:migrate && npm run build`: a preparação idempotente de tabelas e índices passou, sem importar dados. A API não cria tabelas ao iniciar.

O primeiro teste remoto identificou ERR_MODULE_NOT_FOUND nos imports locais do servidor. O commit da prévia usa extensões `.js`, compatíveis com os módulos ESM emitidos pela Vercel e com o desenvolvimento via tsx. Build e os 14 testes passaram após a correção.

A verificação autenticada em navegador confirmou health, catálogo vazio, configurações públicas sem endereço interno, recusa de leitura administrativa sem sessão, login do painel, pedidos, histórico, financeiro, estatísticas e chave pública de push. O pagamento online retorna explicitamente que Stripe não está configurado. Painel em 390×844 e 1365×900 sem rolagem horizontal inesperada ou erros JavaScript. Nenhum produto ou pedido fictício foi criado no banco remoto. A visita do navegador pode registrar telemetria normal do site.

O arquivo local ignorado `data/acesso-previa.txt` contém somente o acesso da prévia; `data/online-preview-env.json` contém segredos e não deve ser compartilhado. A proteção de implantação da Vercel continua ativa. Links temporários de acesso não devem ser colocados no repositório.

Antes de disponibilizar para clientes: cadastrar o cardápio real, salvar o endereço interno já confirmado pelo responsável mantendo a apresentação pública Curitiba - PR, confirmar taxas/raio/horários e Pix, testar um pedido de ponta a ponta nesse ambiente, verificar avisos no Android bloqueado e validar pagamentos com credenciais Stripe de teste. A prévia não é uma liberação de produção.
