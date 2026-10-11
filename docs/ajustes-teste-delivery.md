# Ajustes após teste da prévia

- A IA foi removida do cardápio, navegação, API e dependências. A rota `/chat` não existe mais.
- A interceptação de console e seu controle no painel foram removidos.
- Ícones Lucide substituem os emojis da interface; títulos, mensagens e notificações usam texto.
- Campainha original de duas notas em `/sounds/order-chime.wav`, sem carregar áudio externo. Repete a cada 15 segundos para pedidos pendentes, para ao silenciar, sair do painel ou atender os pedidos. A indicação de reprodução acompanha eventos do áudio; não depende apenas de haver pedidos.
- Som com o painel aberto e cadastro de Web Push são apresentados separadamente. Cadastro confirmado ainda exige teste recebido no aparelho com tela bloqueada. O som de uma notificação em segundo plano é controlado pelo Android/navegador.
- Endereço e ponto no mapa editáveis em Configs → Entrega. A edição aceita um link completo do Google Maps ou latitude/longitude. Erros de salvamento são apresentados; a localização não é substituída silenciosamente por um ponto aproximado da rua.
- Campos internos do endereço e coordenadas são omitidos de `/configs` para visitantes. `/delivery/quote` usa a configuração privada da loja, valida coordenadas e raio e devolve somente distância e taxa. O texto público de localização permanece separado.
- `DELIVERY_PREVIEW_MODE=true` abre somente a prévia local a qualquer hora e apresenta um aviso de pedidos de teste. A Vercel ignora essa opção; horários de produção continuam configuráveis.

O endereço e o ponto fornecidos pelo proprietário foram gravados somente no SQLite da demonstração, sem publicar esses dados no Git. As chaves VAPID fixas da demonstração ficam em arquivo ignorado. A configuração do banco e de VAPID no projeto Vercel correto continua pendente antes de publicar. Os pedidos de teste são locais; não houve cobrança nem notificação enviada a clientes.

A validação usa testes da API para privacidade, cálculo de frete, raio e remoção do chat, além da suíte existente. A inspeção no navegador cobre loja/painel em celular e desktop, pedido completo, endereço editável e mensagens de som/avisos. O geocodificador do endereço fictício do cliente é simulado; a configuração da loja e o cálculo do frete usam a API e o banco locais reais.

Resultados: 11 testes passaram; TypeScript e build passaram. O pacote principal caiu de aproximadamente 612 kB para 485 kB com a remoção da IA. A compra foi concluída com relógio do navegador em 23h30. O teste da configuração salvou coordenadas com vírgula, confirmou a normalização e rejeitou uma localização vazia. A inspeção de áudio confirmou reprodução da campainha, bloqueio apresentado corretamente e silêncio após ação do usuário. A falha simulada no cadastro de Web Push manteve o botão de teste desabilitado.

Frete grátis e raio amplo existem apenas na configuração de demonstração. Taxas e área real de atendimento precisam ser definidas antes da publicação. Não foi enviado Web Push externo durante a validação.
