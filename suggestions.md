# 🚀 Sugestões de Melhoria - Delícias da Vovó

Este documento reúne sugestões práticas e realistas para elevar o nível do aplicativo, focando em experiência do usuário, eficiência operacional e tecnologia.

## 1. 📱 Experiência do Cliente (UX/UI)

*   **Busca Inteligente de Endereço (CEP/Autocomplete):**
    *   *Problema:* Digitar endereço completo é chato e propenso a erros.
    *   *Solução:* Integrar API do ViaCEP para preencher rua/bairro automaticamente ou usar Google Places Autocomplete para sugestão em tempo real.
*   **Bottom Sheet para Mobile:**
    *   *Melhoria:* Em vez de modais centralizados, usar "gavetas" que sobem do fundo da tela (Bottom Sheets) para seleção de adicionais e detalhes do produto em dispositivos móveis. É mais ergonômico.
*   **Favoritos & Re-pedido Rápido:** ✅ **OK**
    *   *Feature:* Permitir que o cliente "favorite" o combo de sempre ou tenha um botão "Pedir Novamente" no histórico, copiando o pedido anterior para o carrinho com um clique.
*   **Feedback Visual de "Adicionado":** (Em implementação...)
    *   *Micro-interação:* Quando adicionar um item, fazer uma animação do produto "voando" para o ícone do carrinho. Ajuda a confirmar a ação visualmente.

## 2. ⚙️ Funcionalidades Críticas (Core)

*   **Autenticação via WhatsApp/SMS:**
    *   *Segurança:* Atualmente o login é simplificado. Implementar um login via número de telefone (envio de código OTP) reduziria pedidos falsos (trotes) e criaria uma base de clientes validada.
*   **Pagamento Pix Automatizado (Copia e Cola):**
    *   *Conversão:* Gerar o código Pix Copia e Cola e o QR Code diretamente no checkout, com baixa automática do pedido assim que o pagamento for confirmado (via webhook da instituição financeira).
*   **WebSockets para Tempo Real:**
    *   *Performance:* Substituir o *polling* (ficar perguntando ao servidor a cada X segundos) por **WebSockets (Socket.io)**.
    *   *Benefício:* O cliente recebe a notificação "Saiu para entrega" instantaneamente, e a cozinha vê o pedido novo no segundo que ele é feito, sem delay.

## 3. 👨‍🍳 Operação & Cozinha (Admin)

*   **Impressão Térmica Automática:**
    *   *Agilidade:* Integrar com impressoras térmicas (via USB/Bluetooth ou rede) para imprimir a comanda automaticamente assim que o pedido cai na cozinha.
*   **Gestão de Estoque (Contagem Regressiva):**
    *   *Escassez:* Para itens limitados (ex: Empanadas do dia), mostrar "Apenas 5 restantes". Isso cria urgência e evita vender o que acabou.
*   **KDS (Kitchen Display System) Dedicado:** ✅ **OK**
    *   *Organização:* Uma tela específica para a cozinha (diferente do Admin geral) com letras grandes, cores por tempo de espera (Verde > Amarelo > Vermelho) e botão gigante de "Pronto".

## 4. 🎁 Marketing & Fidelização

*   **Cartão Fidelidade Digital:** ✅ **OK (Básico)**
    *   *Retenção:* "A cada 10 coxinhas, a 11ª é grátis". Um contador visual no perfil do usuário incentivaria o retorno recorrente.
*   **Recuperação de Carrinho:**
    *   *Vendas:* Se o cliente colocar itens no carrinho e sair, enviar um lembrete (se tivermos o contato/permissão) após 30 minutos: "Sua coxinha está esfriando...".
*   **Cupons de Primeira Compra:**
    *   *Aquisição:* Gerar automaticamente um cupom `BEMVINDO` para usuários novos que nunca fizeram pedido.

## 5. 🛠️ Tecnologia & Qualidade de Código

*   **Testes Automatizados (E2E):**
    *   *Estabilidade:* Implementar testes (Cypress ou Playwright) para garantir que o fluxo crítico (Escolher Produto -> Carrinho -> Checkout) nunca quebre após uma atualização.
*   **Otimização de Imagens (Next-Gen Formats):** ✅ **OK (Compressão no Upload)**
    *   *Velocidade:* Converter automaticamente uploads para WebP ou AVIF para carregar o cardápio instantaneamente, mesmo no 4G.
*   **TypeScript Strict Mode:**
    *   *Manutenibilidade:* Refinar a tipagem (remover `any`) para evitar bugs silenciosos e facilitar a manutenção futura por outros desenvolvedores.

---
*Gerado em: 01/03/2026*
