# Prévia online do Delivovo

Prévia atual com dinheiro opcional e configurações editáveis: https://delivovo-3533m7b0e-alesobralcortes-9387s-projects.vercel.app , commit `be74a37`, deployment `dpl_EHC61PBDZ8rTjn9CXfXUzUQgFgyV`, READY, somente Preview no projeto delivovo. Dinheiro desativado por padrão, opção no painel e troco no checkout quando ativado. Dias, horários e frete editáveis, com labels e explicações. Mesma senha simplificada exclusiva de Preview, fora do Git. 22 testes, build e navegador local passaram; API/painel online foram verificados sem gravar configurações nem dados fictícios. Produção confirmada inalterada.

Acesso atual após simplificar a senha do painel a pedido do responsável: https://delivovo-d7y9fn9yl-alesobralcortes-9387s-projects.vercel.app , deployment `dpl_JQJyrHMZyjUfMQMpsr4sjvkExoND`, READY, mesmo código `ec7f4d8`. Variável ADMIN_PASSWORD alterada exclusivamente para Preview e login com a nova senha verificado. A senha fica no arquivo local privado `data/acesso-previa.txt`, sem ser colocada no Git. O link anterior mantém suas variáveis antigas. Produção preservada.

Prévia atual após correções da manhã: https://delivovo-2schayp5n-alesobralcortes-9387s-projects.vercel.app , commit `ec7f4d8`, deployment `dpl_2LHZbnKjwAeEjTbf7kgceWzzgB3j`, READY. Consolida os ajustes abaixo com cancelamento de frete/CEP/GPS obsoletos e recuperação após buscas demoradas. Build local/remoto, API/painel real online e fluxo de cotação simulado no código remoto em 390/1365 passaram. Produção confirmada inalterada. Detalhes e limites no relatório; não houve pedido/pagamento fictício remoto.

## Histórico das prévias anteriores

Prévia mais recente, concluída na rodada das 05h15 de 11/10: https://delivovo-9bu0cnwzr-alesobralcortes-9387s-projects.vercel.app , commit `10b9ed0`, deployment `dpl_7avrD3Tcb5YrFSzL6iGGTBpKczjt`, READY. Inclui cardápio vazio, opções pelo botão +, remoção de marketing fictício, menos gravações/consultas, checklist com configurações salvas, erros administrativos, horários de São Paulo, ícones PWA locais e teclado nos modais de opções/foto. Última suíte: 21 testes passaram no commit b539bb7; build local/remoto, conferência real de API/painel online e fluxo de teclado com respostas simuladas passaram. PWA verificado na prévia anterior 27fd7f8, cujos arquivos PWA não mudaram nesta rodada. Produção confirmada inalterada. Detalhes, limitações e prioridades em [relatorio-madrugada-2026-10-11.md](relatorio-madrugada-2026-10-11.md).

Histórico: prévia verificada em 10/10/2026, no projeto Vercel `delivovo`, com código do repositório `alejandroBR17/Deli-vovo` no commit `3a144ffc79412a79414ed6e00a28f101a84e5598`.

URL: https://delivovo-78v26lto3-alesobralcortes-9387s-projects.vercel.app

Implantação: `dpl_AeN9e8SXCpHsb3dXxsSLMieEmftV`, estado READY, ambiente Preview (`target: null` na API). O domínio de produção permanece no deployment `dpl_EKmgjo17mWAGL8CSvve9bRnCSoXn`, commit `b1e6861d1d0556d2ff6326cfc3e4c2e8cc8b8538`.

As variáveis ADMIN_PASSWORD, ADMIN_SESSION_SECRET e VAPID_* foram configuradas somente para Preview. STRIPE_SECRET_KEY e VITE_STRIPE_PUBLISHABLE_KEY estão vazias somente em Preview, mantendo as configurações de produção e desenvolvimento. A integração Turso já ligada ao projeto fornece STORAGE_TURSO_* e está configurada para executar a ação de criação de branch por implantação. O comando desta prévia foi `npm run db:migrate && npm run build`: a preparação idempotente de tabelas e índices passou, sem importar dados. A API não cria tabelas ao iniciar.

O primeiro teste remoto identificou ERR_MODULE_NOT_FOUND nos imports locais do servidor. O commit da prévia usa extensões `.js`, compatíveis com os módulos ESM emitidos pela Vercel e com o desenvolvimento via tsx. Build e os 14 testes passaram após a correção.

A verificação autenticada em navegador confirmou health, catálogo vazio, configurações públicas sem endereço interno, recusa de leitura administrativa sem sessão, login do painel, pedidos, histórico, financeiro, estatísticas e chave pública de push. O pagamento online retorna explicitamente que Stripe não está configurado. Painel em 390×844 e 1365×900 sem rolagem horizontal inesperada ou erros JavaScript. Nenhum produto ou pedido fictício foi criado no banco remoto. A visita do navegador pode registrar telemetria normal do site.

O arquivo local ignorado `data/acesso-previa.txt` contém somente o acesso da prévia; `data/online-preview-env.json` contém segredos e não deve ser compartilhado. A proteção de implantação da Vercel continua ativa. Links temporários de acesso não devem ser colocados no repositório.

Antes de disponibilizar para clientes: cadastrar o cardápio real, salvar o endereço interno já confirmado pelo responsável mantendo a apresentação pública Curitiba - PR, confirmar taxas/raio/horários e Pix, testar um pedido de ponta a ponta nesse ambiente, verificar avisos no Android bloqueado e validar pagamentos com credenciais Stripe de teste. A prévia não é uma liberação de produção.
