# Primeira etapa — pedidos, avisos e compra no celular

Revisão de 10/10/2026. Projeto em produção: `delivovo`, repositório `alejandroBR17/delivovo`. As mudanças desta branch precisam de configuração e validação em preview antes de publicar. Nenhuma regra do banco ou configuração da Vercel foi aplicada durante o desenvolvimento.

## Comportamento proposto

- O cliente abre o cardápio sem um login obrigatório aparecer automaticamente. Pode comprar como visitante.
- A sacola distingue o subtotal da taxa de entrega ainda não calculada. O pagamento mostra endereço, itens, desconto, entrega e total.
- O pedido só aparece como enviado depois de a API confirmar a gravação. Em caso de falha, a sacola continua disponível. Uma chave por tentativa permite repetir o envio sem criar outro pedido no fluxo normal.
- A confirmação do Pix passa a dizer que a loja vai conferir o pagamento. O painel chama o valor de “total do pedido”, em vez de “total pago”.
- O painel destaca quantos pedidos aguardam atendimento, oferece o filtro “Novos” e mostra quando atualizou. Uma falha de atualização permanece visível.
- Permissão de notificações e cadastro no servidor são estados diferentes. O botão continua disponível para tentar novamente. Um aparelho já inscrito é verificado ao entrar no painel.
- O teste de aviso é dirigido à inscrição deste aparelho. “Teste enviado” significa que o serviço aceitou o envio; a pessoa ainda precisa conferir o recebimento. O clique no aviso de pedido abre o painel e procura o pedido.
- O navegador Android usa o service worker para os avisos. O som depende das configurações do aparelho; o código não promete um alarme personalizado com a tela bloqueada.
- A localização pública permanece **Curitiba - PR**. Nenhum endereço físico fornecido na conversa foi inserido.

## Proteções incluídas

A senha fixa no JavaScript e a autorização por `localStorage` foram substituídas por uma sessão assinada, validada pela API, em cookie HttpOnly/SameSite/HTTPS em produção. A sessão administrativa dura sete dias e tem saída explícita. Dados administrativos, alterações de produtos/configurações e gerenciamento dos pedidos exigem a sessão; as escritas administrativas também exigem um cabeçalho que formulários externos não conseguem enviar.

Clientes autenticados recebem sua própria sessão. Alterar perfil ou buscar pedidos de outra conta exige autorização. Novos cadastros armazenam hash scrypt com sal aleatório, e as respostas não devolvem a senha. Senhas antigas são convertidas ao entrar novamente. Pedidos de visitantes recebem um comprovante de acesso para cancelar um pedido ainda pendente ou confirmar uma entrega que já saiu. Limpar o histórico no celular não arquiva o pedido para a cozinha.

O servidor agora usa Turso/libSQL com credenciais privadas. O Firebase Admin SDK foi removido da aplicação. A criação e a cópia do banco seguem o procedimento em [migracao-turso.md](migracao-turso.md).

Na Vercel, falhas de gravação não viram sucesso em um arquivo temporário. As chaves VAPID são fixas em variáveis privadas. Os envios após a resposta usam `waitUntil`, que não é uma fila com retentativa garantida.

Se a planilha for usada, o Apps Script passa a exigir uma chave compartilhada privada, preserva itens/agendamento e controla a repetição do pedido com um lock. O script e o backend precisam ser atualizados em conjunto.

## Configuração necessária antes de publicar

1. Configurar `ADMIN_PASSWORD` com uma senha exclusiva e `ADMIN_SESSION_SECRET` com pelo menos 32 caracteres aleatórios. Não usar a senha antiga. Não colocar esses valores no Git ou na conversa.
2. Criar o banco exclusivo Turso, configurar `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`, aplicar tabelas/índices e importar/conferir os dados conforme [migracao-turso.md](migracao-turso.md). Não publicar antes de validar o preview e a cópia final.
3. Configurar um par fixo `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`. Como a versão antiga podia expor a chave privada pela configuração pública, gerar um novo par para a publicação. Reinscrever os aparelhos depois da troca.
4. Se `GOOGLE_SHEETS_SCRIPT_URL` estiver em uso, definir `GOOGLE_SHEETS_API_SECRET` na Vercel e o mesmo valor como propriedade `API_SECRET` do Apps Script. Fazer cópia da planilha antes de atualizar `google-apps-script.js`, que acrescenta colunas ao final dos pedidos. Validar a integração atualizada em uma cópia primeiro.
5. Pedir nova entrada nas contas de clientes: o login antigo salvo no navegador não é uma sessão válida. Pedidos antigos de visitantes não têm o novo comprovante; alterações desses pedidos devem ser tratadas pela loja. As contas já existentes mantêm as senhas, que são convertidas ao entrar.
6. Usar somente chaves de teste Stripe no preview. O backend confere o status, a moeda e o valor do PaymentIntent antes de marcar cartão como pago. O fluxo de cartão não foi testado com um pagamento real nesta etapa.

## Evidências da primeira versão (antes da migração Turso)

- `npm test`: sete testes passaram. Cobrem sessão administrativa, proteção de perfis, hash de senha, configurações privadas, gravação/repetição de pedido, falha de configuração de push, bloqueio do fallback temporário na Vercel e integração do backend com uma simulação do Apps Script.
- `npm run build`: passou. O arquivo principal gerado tem 608,06 kB (185,05 kB com gzip) e o painel é carregado separadamente, com 448,10 kB (123,85 kB com gzip). Ainda há aviso de tamanho do arquivo principal.
- Navegador Edge/Chromium, viewport de 390 × 844: entrada no painel, fila de pedidos, mensagem de falha de push, saída e API recusando acesso após sair; nenhum erro JavaScript não tratado nesses cenários.
- Compra como visitante: taxa ainda não calculada, resumo antes do Pix, falha HTTP 503 preservando a sacola, repetição bem-sucedida, pedido salvo localmente e acompanhamento. Geocodificação simulada. Produto, endereço e pedido fictícios; nenhuma cobrança ou notificação externa foi enviada.
- A revisão também separa o carregamento do painel administrativo do cardápio e impede o Tailwind de examinar `node_modules` durante a compilação.

## Validação ainda necessária e limites

O banco Turso remoto, a cópia dos dados reais e o recebimento no Android ainda não foram testados. No preview configurado, fazer um pedido fictício com o aplicativo fechado e a tela bloqueada, conferir a chegada do aviso, tocar nele e aceitar o pedido. Repetir após reiniciar o Android e ao voltar de uma interrupção de internet. Sem essa evidência, não considerar o recebimento de pedidos pronto para a operação.

A limitação de tentativas de login usa memória por instância; proteção distribuída contra abuso deve ser configurada na plataforma. A validação integral de preços, variações, cupons e taxa de entrega ainda precisa ser feita no servidor; hoje a verificação do cartão confere o valor enviado no pedido, não reconstrói todo o orçamento pelo catálogo. O endpoint de criação do PaymentIntent também deve ser vinculado a um orçamento validado antes de ampliar o uso de cartão online. Essas pendências existentes impedem afirmar que o checkout está completamente protegido contra adulteração.

`npm audit fix` aplicou atualizações compatíveis e removeu os alertas críticos encontrados nesta instalação. Após remover dependências antigas, permanecem sete alertas (cinco altos, dois moderados). Atualizações incompatíveis não foram aplicadas automaticamente e devem ser tratadas separadamente com validação.

A aparência geral do cardápio, o modelo de frete baseado em geocodificação, o conteúdo comercial e a proposta de valor frente ao iFood ainda precisam de uma segunda etapa. Este pacote corrige o recebimento e as falhas observáveis do fluxo atual; não comprova que os clientes vão preferir este site ao iFood.
