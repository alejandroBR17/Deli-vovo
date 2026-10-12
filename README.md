# Delícias da Vovó Grazy

Aplicação de delivery artesanal com catálogo, sacola, pedidos e telas de operação da cozinha. Desenvolvida com React, TypeScript, Vite e um servidor Express.

[Versão publicada](https://deli-vovo.vercel.app/)

## Recursos

O código reúne a experiência do cliente e a gestão de pedidos, com componentes de checkout, acompanhamento, catálogo e administração. Há integrações e dependências para pagamentos e notificações; sua disponibilidade depende das credenciais, serviços e configuração do ambiente.

Uma integração presente no código não comprova que pagamentos reais ou notificações estejam configurados na hospedagem. Não há garantia de conclusão comercial, disponibilidade contínua ou validação de todos os fluxos. Rotas e atalhos de administração não substituem autenticação e autorização.

## Execução local

Use uma versão atual do Node.js compatível com as dependências, como Node.js 24.

```sh
git clone https://github.com/alejandroBR17/Deli-vovo.git
cd Deli-vovo
npm install
npm run dev
```

Copie `.env.example` para um arquivo de ambiente local quando precisar das integrações e configure somente suas próprias credenciais. Não envie chaves nem dados pessoais para o repositório. Consulte a configuração do servidor para o endereço e a porta usados no ambiente.

```sh
npm run lint
npm run build
```

`lint` verifica tipos com TypeScript; `build` executa TypeScript e Vite. O repositório não possui atualmente um script `npm test`. A checagem de tipos não substitui testes de checkout, pagamentos e gestão de pedidos.

## Decisões e participação

Projeto pessoal de Alejandro Cortes, desenvolvido com assistência de IA. A proposta é apresentar a operação de um delivery artesanal em uma aplicação web: catálogo para o cliente e acompanhamento para a cozinha. Componentes, páginas, serviços e utilitários separam os principais assuntos do código.

A evolução precisa distinguir telas de demonstração e integrações configuradas de fluxos comerciais efetivamente validados. Este README descreve a proposta e a estrutura disponível, sem atribuir métricas de desempenho ou resultados de negócio não medidos.

## Licença

O código segue a [licença MIT](LICENSE); dependências, imagens e demais conteúdos de terceiros mantêm seus direitos.
