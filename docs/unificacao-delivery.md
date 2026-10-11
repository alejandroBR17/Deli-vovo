# Versão unificada do delivery

Em 10/10/2026, o responsável escolheu combinar o layout de `alejandroBR17/Deli-vovo` com as correções desenvolvidas em `alejandroBR17/delivovo`.

## Base e mudanças

A base é `Deli-vovo`, commit `b9e064e`, de 07/10/2026. Foram transferidos os três commits da branch anterior, resolvendo conflitos para preservar a largura do site em telas grandes, navegação desktop, grade do cardápio e painéis laterais de login/sacola. O painel continua carregado separadamente da loja.

As correções incluem sessões verificadas pela API, pedidos confirmados após gravação, repetição sem duplicação no fluxo normal, sacola preservada após falha, Web Push preparado com chaves privadas, Turso/libSQL, consultas indexadas/paginadas, financeiro do período completo, imagens fora do JSON do cardápio e polling que pausa com aba oculta ou offline.

## Validação desta base

- `npm ci --ignore-scripts`, TypeScript e build concluídos. O build mantém aviso de pacote principal acima de 500 kB: aproximadamente 612 kB, 186 kB com gzip.
- Dez testes passaram na execução final. A primeira execução encontrou um bloqueio de arquivo temporário do SQLite pelo Windows durante a limpeza; a repetição específica e depois a suíte completa passaram.
- Navegador Edge/Chromium com a versão compilada, telas de 390 × 844 e 1365 × 900: loja, login de clientes, fila, histórico, financeiro e API bloqueada após logout administrativo, sem erros JavaScript não tratados. A largura desktop e o login lateral foram conferidos; o login de clientes não abre automaticamente.
- Compra como visitante no celular: frete informado, resumo de pagamento, falha HTTP 503 simulada preservando a sacola, nova tentativa gravando o pedido no SQLite local e acompanhamento com comprovante de acesso. Geocodificação simulada; nenhum pagamento ou aviso externo foi enviado.
- Dados da demonstração são fictícios e ficam no banco local ignorado pelo Git. O banco Turso remoto não recebeu esses pedidos.

## Publicação ainda pendente

As duas versões em produção permanecem preservadas. O banco Turso exclusivo foi preparado no projeto antigo `delivovo`; conectar/configurar o projeto Vercel `deli-vovo` antes de publicar esta branch. O responsável escolheu começar vazio, sem importar dados antigos.

Ainda são necessários o cardápio real, configurações operacionais, senha/segredo administrativo, chaves VAPID e teste no Android com navegador fechado e tela bloqueada. Pagamentos e validação integral de preços, variações, cupons e frete no servidor permanecem pendentes. Ver [migracao-turso.md](migracao-turso.md).
