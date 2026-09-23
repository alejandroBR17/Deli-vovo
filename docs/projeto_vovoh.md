# 👵 Projeto: Delícias da Vovó Grazy - Guia Mestre e Memória

Este documento é a **BÍBLIA DO PROJETO**. Qualquer Inteligência Artificial que for dar manutenção ou adicionar novas funcionalidades neste sistema **DEVE** ler este arquivo primeiro. 

## 🚨 REGRAS ESTRITAS PARA IAs (LEIA COM ATENÇÃO)
1. **Zero Alertas Nativos:** NUNCA utilize `alert()`, `confirm()` ou `prompt()`. Todos os feedbacks devem ser feitos usando o componente `<Toast />` ou modais customizados do próprio site.
2. **Design Adaptativo (Mobile vs PC):** A experiência no Celular e no Computador devem ser **distintas**. 
   - No Celular: O site deve parecer um App Nativo (estilo iFood). Use barras de navegação fixas em baixo, elementos roláveis horizontais e modais estilo "Bottom Sheet" (subindo de baixo para cima).
   - No Desktop: O site deve parecer um Programa/Software moderno. Use visualização em Grid, Carrinho estilo "Gaveta Lateral" (Drawer) e menus superiores claros.
3. **Comunicação Humanizada:** TUDO no sistema (textos, modais, status, placeholders) deve parecer humano, acolhedor e caseiro. Sempre se pergunte: *"Isso parece muito robótico? Um humano gostaria de interagir com isso?"*.
4. **Palavra-Chave:** O diferencial da Vovó não é "massa de batata", é **"Massa com tempero de Mãe"**. Use isso nas comunicações e no prompt da Inteligência Artificial.

---

## 🎨 Identidade e Experiência (UX/UI)
- **A Persona (Vovó Grazy):** A alma do negócio. É atenciosa, cozinha com a filha e o marido argentino faz as empanadas. Ela chama os clientes de "Querida", "Meu anjo", "Meu filho".
- **Cores Oficiais:** 
  - Vermelho Vovó (`vovoh-red`: `#D61F1F`)
  - Dourado Artesanal (`vovoh-gold`: `#D97706`)
  - Creme Fundo (`vovoh-cream`: `#FFFBF2`)
  - Escuro Sóbrio (`vovoh-dark`: `#1A1A1A`)
- **Tipografia:** `Playfair Display` para títulos elegantes e `Quicksand` para textos arredondados e amigáveis.
- **Animações:** Interfaces que abrem ou fecham não podem simplesmente "aparecer". Elas devem deslizar (`animate-in slide-in-from...`), fazer fade ou ter um efeito de zoom-in para simular a fluidez de um App de verdade.

---

## ⚙️ Arquitetura do Sistema
O projeto é um **Web App Serverless** focado em conversão e engajamento.

1. **Frontend (React + Vite + Tailwind):** Componentes modernos, uso intenso de lucide-react para ícones. Toda a estilização foge do padrão "quadrado" usando bastante `border-radius: 2.5rem` (40px) para botões e cards.
2. **Backend (Google Apps Script - GAS):** Não temos um banco de dados tradicional. Usamos uma planilha do Google associada a um Script que atua como API (GET/POST) retornando e salvando JSON. É ali que ficam os Produtos e os Pedidos.
3. **Persistência Local (`localStorage`):** Usado para manter:
   - `vovoh_active_order`: O pedido atual do cliente.
   - `vovoh_fidelidade`: Contagem de compras.
   - `vovoh_user`: Guarda os dados do cliente (ID, Nome, Email, Celular) após o login.
4. **Sistema de Usuários e Login Grátis:** Usamos a aba `Usuarios` na mesma Planilha do Google, com colunas: `ID | Nome | Email | Senha | Telefone | Endereco`. O GAS verifica senhas e retorna o acesso. O usuário que faz login também envia o `userId` para a aba `Pedidos`, permitindo que ele veja seus pedidos ativos mesmo acessando de outro navegador/celular (`getUserOrders`).
5. **Inteligência Artificial (Google Gemini):** A funcionalidade "Falar com a Vovó" usa a API do Gemini. Ela recebe a lista de produtos atual e responde com dicas de festas, parecendo a verdadeira Vovó Grazy.

---

## 📦 Funcionalidades Principais
- **StoreFront:** Lista horizontal (Mobile) e Grid (PC) de produtos com categorias fixas.
- **Conta do Cliente (`AuthModal`):** Sistema nativo de login/cadastro salvando na planilha do Google. Autopreencha os dados de checkout e permite sync de pedidos ativos.
- **Carrinho vs Rastreio:** São modais separados. O cliente pede (Carrinho) e após gerar o pedido a tela troca para o Rastreio Animado (Polling a cada 5s).
- **Painel Admin (`/#vovo-secreta`):** Tela preta (estilo terminal hacker moderno) onde a Vovó gerencia pedidos ativos e cardápio.
- **Checkout Pix Simulado:** O cliente vê uma simulação bacana de "Conectando ao banco da Vovó" e pega a chave "Copia e Cola" sem precisar sair da página.

*Nota para IAs: Ao modificar o sistema, atualize também o arquivo `docs/suggestions.md` com o que foi feito.*