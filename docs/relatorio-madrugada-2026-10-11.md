# Trabalho da noite e madrugada — 11/10/2026

O responsável autorizou trabalho independente durante esta noite, pede um resumo ao acordar e só consegue responder a partir das 07h. Toda publicação continua restrita a Preview no projeto Vercel `delivovo`, sem promover produção. Repositório ativo: `alejandroBR17/Deli-vovo`, branch `fix/unifica-delivery-turso`, pasta local `C:/Users/LGOLMES/Downloads/Github ou Vercel/audit-deli-vovo`. Outros projetos e o banco do Observatório não fazem parte do trabalho.

## Rodada antes da retomada agendada

- O cardápio vazio agora explica que está sendo preparado.
- O botão + de produtos com variações/adicionais abre a seleção antes de adicionar à sacola.
- Foram removidos depoimentos fictícios de fallback da loja, API e painel, a alegação de 500+ famílias por semana e os avatares externos usados como clientes.
- Abrir a loja não pede automaticamente permissão de notificações nem mostra uma faixa vermelha pressionando o cliente a ativá-las. A ação continua disponível no botão. A mensagem distingue avisos com o site aberto do cadastro para avisos após o pedido.
- O registro de visita só é marcado como concluído no navegador se a API responder com sucesso.
- A atualização de autenticação da visita usa uma única consulta com índice, limitada ao dia atual, e não grava quando os campos já estão corretos. Isso evita reescrever o histórico do navegador em cada login.

Validação: 15 testes passaram, incluindo o novo teste de histórico de visitas (dias anteriores, outro navegador e dia seguinte permanecem intactos; repetição grava zero linhas). Build final passou. Em navegador, 320, 390 e 1365 px passaram: mensagem do cardápio vazio, ausência de avaliações/contagem inventadas, zero pedido automático de permissão e seleção de opção pelo botão + chegando corretamente à sacola. O teste usa respostas simuladas somente no navegador, sem inserir produtos/pedidos no banco remoto.

Commit funcional desta rodada: `0268b7ed23dec7fbad6db430db347ae305c04213`. Nova prévia READY: https://delivovo-qmia43d59-alesobralcortes-9387s-projects.vercel.app , deployment `dpl_95j5y9rEW28rNZY3Txv1tu2uwzxY`, no projeto delivovo. Verificação online passou: mensagem de cardápio vazio, ausência de depoimentos fictícios, leitura Turso, proteção administrativa/login, pedidos/histórico, financeiro, estatísticas, chave pública de push, Stripe desativado e painel em celular/desktop sem erros JavaScript ou rolagem horizontal inesperada. Nenhum produto ou pedido fictício foi inserido remotamente. `data/acesso-previa.txt` e `data/online-preview-access.json` foram atualizados localmente para esta prévia. Produção permanece preservada.

## Retomadas e relatório

Automação no mesmo chat `del-cias-da-vov-retomada-da-madrugada`: 02h15, 03h15, 04h15 e 05h15 de São Paulo, limitada a quatro execuções. Automação `del-cias-da-vov-relat-rio-da-manh`: relatório às 06h locais, uma execução. O primeiro disparo ocorreu antecipadamente às 23h16 de 10/10 (02h16 UTC): o agendador interpretou o horário da regra em UTC. Nesta rodada, as regras foram corrigidas para 05h15–08h15 UTC e relatório às 09h UTC, preservando os horários locais pedidos. Devem ser desativadas ao concluir. Requerem computador ligado, aplicativo aberto e recursos de uso disponíveis. Não afirmar que houve trabalho nas rodadas que não executarem.

## Rodada antecipada — configuração inicial do painel

O painel passa a oferecer uma lista recolhível de pendências para cardápio, endereço/localização, taxas/raio, dias/horários e Pix. Os botões levam à seção correspondente. A lista usa somente configurações recebidas do servidor e gravações confirmadas, sem considerar o texto que ainda está sendo editado como salvo. Taxa zero explicitamente salva é aceita; dados ausentes, negativos ou inválidos continuam pendentes. A lista não afirma que a loja está pronta para produção, nem substitui um pedido de teste.

Também foi corrigido `adminFetch`: falhas HTTP em operações de escrita agora geram erro em vez de permitir que chamadas que não conferiam `response.ok` mostrassem sucesso. Isso cobre, entre outras, criação/edição/exclusão de produtos. O campo Pix ganhou rótulo associado ao input para acessibilidade.

Validação: 17 testes passaram; novos testes cobrem configurações ausentes/inválidas, taxa zero, configuração de turno noturno e gravações administrativas recusadas. Build final passou. Em navegador, 320, 390 e 1365 px passaram: atalhos para cardápio/frete/Pix, edição sem salvar mantendo a pendência, falha 503 de gravação mantendo a pendência e sucesso confirmado diminuindo o contador de cinco para quatro. Sem erros JavaScript ou rolagem horizontal inesperada. Os dados de Pix neste teste são fictícios, somente em respostas simuladas de navegador; nenhum dado remoto foi alterado.

Esta rodada foi validada localmente e ainda não implantada. A próxima rodada pode consolidar estes ajustes com novas correções antes de criar uma prévia, evitando bancos/implantações redundantes. A prévia online mais recente continua sendo a do commit 0268b7e acima. As credenciais e a produção continuam preservadas. O helper `verify-store-setup.cjs` está na pasta pai do repositório.

## Rodadas 02h15 e 03h15 — horários e consumo de consultas

A rodada das 02h15 iniciou a correção de horários, mas a validação foi interrompida por falta de memória no computador: os processos de testes falharam com heap esgotado enquanto o build também estava em execução. Essas tentativas não são contabilizadas como sucesso. Às 03h15, o trabalho pendente foi retomado e validado executando testes e build em sequência. O comando npm test também passa a executar os arquivos sequencialmente, para evitar vários processos concorrentes nessa máquina.

- A disponibilidade exibida na loja agora usa America/Sao_Paulo, independentemente do fuso do aparelho do cliente. Meia-noite é um horário válido. Turnos que passam da meia-noite usam o dia em que abriram, inclusive na passagem de domingo para segunda. O fechamento é exclusivo: às 22h exatas, o turno que acaba às 22h já está fechado. Configurações inválidas ou nenhum dia de funcionamento deixam a loja fechada. Os valores padrão existentes de 10h–22h foram preservados; não representam confirmação de horários reais.
- O relógio da loja é recalculado localmente a cada minuto, pausando com aba oculta/offline e retomando ao voltar. Essa atualização não consulta o banco. Alterações de configuração continuam chegando pelo intervalo de dez minutos existente.
- Foi corrigido o limite do backoff: ele encurtava polls configurados para dez minutos para cinco minutos após a primeira execução. Agora o intervalo nunca é encurtado pelo teto. Isso reduz pela metade as repetições estáveis desses polls em abas que permanecem visíveis, sem prometer uma cota global.

Validação concluída na retomada: **21 testes passaram**, com arquivos executados sequencialmente, e **build passou**. Os quatro testes acrescentados cobrem fusos diferentes, limites exatos do turno, madrugada/dias da semana, configurações inválidas e o intervalo de dez minutos. No navegador Edge, simulando os fusos de Tóquio e Los Angeles em tela de 390 px, a loja estava aberta às 21h59 de São Paulo e fechou às 22h após avançar o relógio; nenhum novo GET de configurações foi feito nessa passagem, sem erro JavaScript ou rolagem horizontal. O helper `verify-store-hours.cjs` está fora do repositório e usa respostas simuladas, sem gravações remotas.

**Limitação explícita:** esta correção é da disponibilidade exibida no navegador. A API ainda não bloqueia pedidos por horário; isso exige tratar o agendamento e pagamentos iniciados antes do fechamento, para não rejeitar um pedido já pago inadvertidamente. Não anunciar essa validação como concluída. O teste Android bloqueado continua pendente.

Commit funcional desta retomada: `b539bb74bf814092ac30b0f50a22175417d0b385`, enviado para `fix/unifica-delivery-turso`. A descrição da draft PR #1 foi atualizada com os 21 testes e as limitações. Os ajustes do painel (`0c85456`) e desta rodada ainda estão apenas na branch da PR; a prévia verificada continua `0268b7e`. Foi adiada uma nova implantação para consolidar as próximas correções, pois a integração Turso cria branches por deployment. Produção permanece preservada. Para a próxima retomada, revisar os ícones/metadados PWA ou outra falha demonstrável e concluir uma única prévia consolidada antes do relatório final.

## Prioridades independentes para as próximas rodadas

1. Revisar fluxo de configuração inicial do painel: facilitar identificar cardápio/localização/frete/horários/Pix pendentes, sem criar valores de negócio inventados. O endereço foi confirmado na conversa, mas não deve ser colocado em arquivos Git ou HTML público. A apresentação pública continua Curitiba - PR.
2. Revisar cotação/checkout, disponibilidade por horário e tratamento de falhas de rede. A loja atualmente calcula abertura usando horário local do navegador; conferir fuso America/Sao_Paulo, turnos atravessando meia-noite e validação do lado servidor. Checar se validações essenciais existem no servidor, sem cobrar pagamentos reais. Priorizar bugs demonstráveis e testes de borda, sem reescrever tudo sem necessidade.
3. Revisar consumo e entradas de telemetria, cache e polling. Evitar consultas sem limites e gravações desnecessárias. Rate limits em memória são por instância; não afirmar proteção global de cota.
4. Melhorar acessibilidade e operação pelo teclado nos produtos/modais e clareza dos avisos. Conferir PWA: manifest usa ícones externos e index.html tem URLs de compartilhamento de outro domínio (delicias-da-vovo.vercel.app); usar o destino confirmado quando pertinente e verificar imagens/instalabilidade. Android bloqueado depende do aparelho do responsável e não pode ser anunciado como validado.
5. Completar somente mudanças que passem nos testes adequados, atualizar draft PR #1 e preparar uma prévia no único projeto delivovo. Evitar múltiplas implantações sem mudança funcional.

## Contexto de execução

A prévia anterior verificada está em https://delivovo-78v26lto3-alesobralcortes-9387s-projects.vercel.app, commit 3a144ff, deployment dpl_AeN9e8SXCpHsb3dXxsSLMieEmftV. Projeto prj_xA4Od337bOI5NIpJsC7Gqg5CeoHR, equipe team_Ml0gRSvgy3o8VQUj3VlqAlXw. Produção permanece no deployment dpl_EKmgjo17mWAGL8CSvve9bRnCSoXn, commit b1e6861. Configuração Turso integrada injeta STORAGE_TURSO_* e cria branches por implantação; o comando de build da prévia deve executar a migração explícita idempotente antes de npm run build. Credenciais de Preview estão em arquivos locais ignorados em data/, nunca imprimir ou commitar. Stripe está desativado só em Preview.

Os scripts auxiliares verify-online-preview.cjs e verify-overnight-store.cjs estão fora do repositório, na pasta pai. Usam Playwright com Edge headless. A automação de navegador CUA estava indisponível nesta sessão; não acessar perfis/cookies do usuário por meios alternativos. O teste local http://localhost:3004 usa SQLite com dados fictícios. Finalizar o build antes de testes de navegador evita artefatos inconsistentes. O helper online lê data/online-preview-access.json e data/online-preview-env.json; o acesso temporário deve ser renovado se expirar. Testes com dados fictícios não devem contaminar o banco remoto.

## Pendências que exigem o responsável

Cardápio real com preços/fotos/opções; taxas e raio de entrega; horários finais; dados de Pix; teste de notificações no Android com tela bloqueada; credenciais Stripe de teste e validação de pagamento/retorno. Nenhuma dessas informações será inventada durante a madrugada.
