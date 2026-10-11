# Migração do delivery para Turso

## Situação

O código foi preparado para Turso/libSQL, com testes em SQLite local. O Firebase não é mais uma dependência da aplicação. O novo banco foi conectado ao Delivovo na Vercel, mas tabelas e dados remotos ainda precisam ser preparados e conferidos. A troca da produção não foi realizada. O Observatório do Voto não foi alterado. A API da Vercel confirmou as variáveis sensíveis da integração, mas não fornece seus valores; o acesso para a migração está pendente.

O print de uso fornecido em 10/10/2026 mostrava 30,94 mil leituras de 500 milhões, 10,13 mil escritas de 10 milhões, 2,22 MB de 5 GB e 48 bancos de 100. É uma referência daquele momento, não uma garantia de consumo futuro.

## Redução de consumo implementada

- A atualização de pedidos passa a acontecer a cada 60 segundos somente com a aba visível e internet disponível. Antes, o painel consultava a cada 30 segundos e o acompanhamento do cliente a cada 15 segundos. São reduções teóricas de 50% e 75% nas chamadas periódicas desses caminhos, respectivamente, sem contar a pausa das abas ocultas. Não são medições de economia em produção.
- As consultas automáticas não se sobrepõem e espaçam tentativas após falhas. Ao voltar à aba ou recuperar a internet, a tela consulta novamente. Os avisos com o site fechado continuam usando Web Push, com teste real no Android pendente.
- A previsão de preparo tem um único responsável na tela e consulta a cada dez minutos, com cache e compartilhamento de solicitações simultâneas no servidor.
- O status consulta apenas os IDs pedidos, pelo índice de chave primária, com até 50 IDs por requisição. Antes, a versão Firestore carregava todos os pedidos.
- A fila mantém os pedidos ativos e até 100 pedidos encerrados recentes. O botão Histórico busca páginas de 100 pedidos; “Carregar anteriores” busca a próxima página, por cursor.
- Estatísticas são consultadas ao abrir sua tela e calculadas por SQL. O resumo financeiro calcula o período inteiro no banco e retorna apenas 20 entradas recentes; não depende dos 100 registros da fila.
- A sincronização do carrinho espera dois segundos e evita gravar novamente um conteúdo já confirmado.
- A limpeza de presença a cada minuto no processo do servidor foi removida. Pessoas online são selecionadas por horário da última presença. Registros antigos ainda ocupam espaço: haverá necessidade de uma política de retenção quando o volume justificar.
- Imagens enviadas pelo painel passam para uma tabela separada, referenciada por URL com hash do conteúdo. A resposta do cardápio não transporta Base64. O endpoint de imagem permite cache público imutável. As imagens ainda ocupam espaço no Turso e uma requisição que não acerta o cache lê o conteúdo no banco; isso não substitui um serviço de arquivos. Limite de 2 MB por imagem raster.
- Tabelas e índices são preparados por comando explícito. O início de uma função não cria tabelas nem executa manutenção.

Caches em memória são por instância, não um cache compartilhado garantido. Os limites de requisição também são por instância; não representam um bloqueio global de orçamento. Nenhum plano gratuito é ilimitado.

## Criar e configurar

1. Na integração Turso da Vercel, criar um banco **exclusivo do delivery** chamado `delivovo`, sem reutilizar o banco do Observatório. Conectar ao projeto Vercel `delivovo`.
2. Conferir que `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` estejam presentes como variáveis privadas. A integração criada com prefixo STORAGE gerou `STORAGE_TURSO_DATABASE_URL` e `STORAGE_TURSO_AUTH_TOKEN`, que o código também aceita diretamente. Não usar prefixo `VITE_` para o token. Os valores não devem ser enviados pela conversa nem entrar no Git.
3. Configurar `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (pelo menos 32 caracteres aleatórios) e o novo par privado de chaves VAPID. Preservar as configurações Stripe, usando modo de teste no preview.
4. Usar um banco separado/local para o desenvolvimento. Por exemplo, `TURSO_DATABASE_URL=file:./data/delivery.db`, sem token, é aceito fora da Vercel. Na Vercel, URLs de arquivo são recusadas.
5. Com o ambiente privado configurado no processo, executar `npm run db:migrate`. O comando cria tabelas e índices sem apagar os registros existentes. Não roda automaticamente no deploy.

O servidor usa Turso quando configurado, mesmo que reste uma URL antiga de Sheets. A compatibilidade com Sheets/arquivos fica apenas como alternativa de desenvolvimento/transição. Na Vercel, falta de banco persistente nunca deve produzir confirmação de pedido em arquivo temporário.

## Copiar dados existentes

1. Guardar uma cópia privada do banco de origem. Para origem Firestore, o comando `npm run db:export-legacy` faz somente leitura via REST. Precisa do caminho de uma conta de serviço em `LEGACY_FIREBASE_SERVICE_ACCOUNT_FILE`; essa credencial é exclusiva do processo de exportação, não da aplicação nova.
2. A origem padrão preserva o projeto/banco nomeado em `firebase-applet-config.json`. É possível definir `LEGACY_FIREBASE_PROJECT_ID` e `LEGACY_FIREBASE_DATABASE_ID` explicitamente. Conferir ambos antes de exportar.
3. O exportador salva `data/migration/export.json` (ignorado pelo Git), com produtos, pedidos, usuários, configurações e visitas; nunca sobrescreve um arquivo existente. Configurações privadas antigas e presenças não são copiadas. Inscrições de push devem ser refeitas com as novas chaves.
4. Se pedidos/usuários estiverem na planilha, preparar um export JSON correspondente à origem real. Não presumir que Firestore contém todos os registros. Campos dos pedidos devem incluir `id`, `date`, `customer`, `items`, `total`, `status`, `paymentMethod`, `userId` e `archived`; configurações usam `id` ou `key` e `value`.
5. Executar `npm run db:import -- data/migration/export.json` para conferir formato, identidades e contagens **sem gravar**. Depois executar com `--apply` em um destino vazio. O comando recusa sobrescrever qualquer destino já preenchido e preserva a origem.
6. A importação confere contagens e transforma imagens Base64 raster em referências separadas. Se interromper, o destino pode ficar parcial; revisar esse destino separado antes de repetir. Não trocar a produção nessa condição.
7. Conferir pedidos recentes e ativos, totais financeiros, cardápio, configurações, senhas/login e imagens. Contagens sozinhas não comprovam equivalência dos dados.
8. Fazer a exportação final com entrada de novos pedidos pausada ou uma estratégia explícita de sincronização. Uma cópia enquanto a loja continua recebendo pedidos pode perder as alterações posteriores ao export.

Nunca remover o banco antigo antes da conferência e do período de recuperação. Remover a dependência do código não apaga o projeto Firebase.

## Antes de publicar

- Validar o preview contra o banco separado e conferir variáveis privadas e migração aplicada.
- Testar um pedido fictício e o aviso no Android com navegador fechado e tela bloqueada, inclusive ao tocar no aviso e abrir o pedido.
- Validar os pagamentos em modo de teste. A validação integral de catálogo, variações, cupons e frete no servidor continua pendente; não considerar a segurança de cobrança concluída por esta migração.
- Confirmar cópia final dos dados, possibilidade de retorno e ausência de export/credenciais no Git.
- Após a publicação, acompanhar leituras/escritas/armazenamento na organização Turso compartilhada e comparar o consumo do delivery com o Observatório.

## Validação local desta versão

- Dez testes automatizados passaram, incluindo banco SQLite real, consulta indexada de status, histórico paginado, totais além da primeira página, gravação/repetição de pedidos e isolamento de imagens.
- TypeScript e compilação passaram. Permanece um aviso de tamanho do pacote principal (aproximadamente 608 kB, 185 kB com gzip).
- Em navegador com tela de 390 × 844, a versão compilada abriu a fila, o histórico e o financeiro, bloqueou a API após sair e exibiu o cardápio, sem erro JavaScript não tratado. As estatísticas não foram consultadas ao entrar no painel.
- Migração e importação com um pedido fictício passaram em banco local separado. A prévia não grava e uma segunda importação foi recusada para impedir sobrescrita.

Essas evidências não cobrem o banco remoto, os dados reais, pagamentos externos nem o recebimento de push em aparelho Android.

## Fontes

- SDK suportado para libSQL e desenvolvimento local: https://docs.turso.tech/sdk/ts/reference
- Uso agregado da organização: https://docs.turso.tech/api-reference/organizations/usage
- Limites do plano: https://turso.tech/pricing
