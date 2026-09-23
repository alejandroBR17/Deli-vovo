# 🥟 Delícias da Vovó Grazy — Plataforma de Delivery Artesanal & KDS

> Uma plataforma completa de comércio eletrônico, delivery sob demanda e sistema de gestão operacional (KDS) desenvolvida com **React 19**, **TypeScript**, **Tailwind CSS**, **Node.js/Express**, **Framer Motion** e integrações inteligentes.

[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

---

## 🌟 Visão Geral do Projeto

O **Delícias da Vovó Grazy** foi concebido para resolver os gargalos reais de negócios gastronômicos artesanais, unindo **experiência do consumidor** (mobile-first, fluida e humanizada) a um **centro de controle operacional robusto** (KDS de cozinha, fluxo de caixa, gestão de catálogo e agendamento).

### 🚀 Diferenciais de Engenharia
- **Experiência Híbrida Adaptativa:** No mobile, interface inspirada em apps nativos de entrega (gestos, bottom-sheets, tabs e animações táteis). No desktop, centralização elegante para o cliente e painel executivo amplo para a cozinha/administração.
- **Transição Fluida de Estado:** Microinterações refinadas com Framer Motion (efeito de item voando para a sacola, modais com física de mola e transições de tela).
- **Checkout Multimeios:** Suporte a **PIX dinâmico com payload Copia e Cola & QR Code**, cartões via **Stripe Elements** e pagamento na entrega (dinheiro com troco / maquininha).
- **KDS (Kitchen Display System):** Modo de visualização de pedidos em tempo real para produção com alarme sonoro, alertas visuais de urgência e atualização otimista de status.
- **Painel Administrativo Completo:** Gestão de produtos, cupons de desconto, taxas e bairros atendidos, métricas de vendas com **Recharts**, controle de estoque e notificações Web Push.

---

## 📱 Funcionalidades

### 🛍️ Área do Cliente (App Mobile & Web)
- **Catálogo Inteligente:** Filtros por categoria (Fritos, Assados, Empanadas Argentinas, Doces e Bebidas), fotos com zoom e cálculo de porções.
- **Personalização de Pedidos:** Seleção de complementos, molhos e observações para a cozinha.
- **Cálculo Dinâmico de Entrega:** Integração com base de bairros e CEP para cálculo automático de taxa e tempo estimado.
- **Agendamento Inteligente:** Possibilidade de pedir para agora ou agendar entrega para datas e horários futuros.
- **Rastreamento em Tempo Real:** Linha do tempo visual de 4 etapas (Recebido ➔ Na Cozinha ➔ A Caminho ➔ Entregue).
- **Fidelidade & Cupons:** Aplicação instantânea de cupons promocionais (fixos ou percentuais).
- **IA Consultora da Vovó:** Assistente gastronômica para recomendações de porções por número de convidados.

### 👩‍🍳 Painel da Cozinha & Gestão (`#vovo-secreta`)
- **Quadro de Pedidos Operacional:** Separação de pedidos pendentes, em preparo e concluídos com ações de 1 clique.
- **Modo KDS (Kitchen Display):** Interface de alto contraste pensada para tablets e telas de cozinha com cronômetro de tempo de espera.
- **Gestão do Cardápio:** Criação, edição e exclusão de produtos com precificação, categorias e fotos.
- **Gestão de Cupons & Bairros:** Configuração de taxas de frete por bairro e regras de cupons promocionais.
- **Métricas & Caixa:** Gráficos interativos de faturamento e produtos mais vendidos via Recharts.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologias |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS, Framer Motion, Lucide React |
| **Gráficos & Dados** | Recharts, QRCode.react |
| **Build & Bundler** | Vite 6, PostCSS, Autoprefixer |
| **Backend / API** | Node.js, Express, TSX, Google Apps Script (Serverless DB API) |
| **Pagamentos** | Stripe SDK (@stripe/react-stripe-js, @stripe/stripe-js) |
| **Notificações** | Web Push API, Service Workers, VAPID |
| **Estilos & Tipografia** | Quicksand (Interface amigável) + Playfair Display (Títulos clássicos) |

---

## 📂 Estrutura de Pastas

```text
├── api/                  # Endpoints backend (pagamentos Stripe, push, etc.)
├── components/           # Componentes modulares reutilizáveis
│   ├── Auth.tsx          # Modal e lógica de login/perfil do cliente
│   ├── Checkout.tsx      # Sacola de compras, cálculo de frete e rastreio
│   ├── StoreFront.tsx    # Vitrine de produtos e detalhes do item
│   └── UI.tsx            # Toast, Modal de Confirmação, Stripe e Pix
├── constants/            # Constantes de configuração, temas e cardápio
├── data/                 # Schemas e mockups de fallback estruturados
├── docs/                 # Documentações de arquitetura e guias do projeto
├── pages/                # Telas principais da aplicação
│   ├── Home.tsx          # Aplicação do cliente (Cardápio & Pedidos)
│   └── AdminPage.tsx     # Painel de Controle, KDS e Relatórios Financeiros
├── public/               # Ativos estáticos, manifest PWA e ícones
├── services/             # Clientes de comunicação com APIs externas
├── styles/               # Folhas de estilo e extensões Tailwind
├── utils/                # Funções utilitárias (PIX, geolocalização, formatação)
├── App.tsx               # Roteador de estado e alternador de visão
├── server.ts             # Servidor Express com suporte a Vite Middleware
├── vite.config.ts        # Configuração do bundler Vite
└── package.json          # Dependências e scripts de automação
```

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- **Node.js** 18+ (ou LTS recente)
- Gerenciador de pacotes **npm** ou **bun**

### 1. Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/delicias-da-vovo.git
cd delicias-da-vovo
```

### 2. Instalar as Dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente
Copie o arquivo de exemplo e preencha as chaves desejadas:
```bash
cp .env.example .env
```

### 4. Iniciar o Ambiente de Desenvolvimento
```bash
npm run dev
```
O servidor será iniciado em: `http://localhost:3000`

### 5. Compilar para Produção
```bash
npm run build
```

Para validar a tipagem estática sem gerar arquivos:
```bash
npm run lint
```

---

## 🔑 Acesso aos Modos de Demonstração

Ao rodar a aplicação:
- **Visão do Cliente (Cardápio / Delivery):** Acesse a rota raiz (`/`). No desktop, há um botão de alternância no canto superior direito.
- **Painel Administrativo & KDS:** Acesse adicionando a hash `#vovo-secreta` na URL (`http://localhost:3000/#vovo-secreta`) ou clique no atalho flutuante do cabeçalho.

---

## 📄 Licença

Este projeto é disponibilizado sob a licença [MIT](LICENSE).

---

Feito com dedicação e carinho caseiro! 🥟✨
