# Sugestões e Histórico de Atualizações

## Atualizações Recentes (25/02/2026)
- **Remoção de Alertas Nativos:** Todos os `alert()` do sistema foram substituídos por mensagens de erro humanizadas na interface (ex: `addressError` no Checkout) e pelo sistema de `<Toast />`.
- **Correção de Cálculo de Frete:** O cálculo de distância no `Checkout.tsx` foi ajustado para buscar o endereço de forma mais precisa adicionando ", Brasil" à query.
- **Correção de Horário de Funcionamento:** A verificação de `force_closed` no `Home.tsx` agora lida corretamente com valores booleanos e strings.
- **Correção de Race Condition no Admin:** O salvamento de endereço e coordenadas GPS no Painel Admin agora aguarda a conclusão das requisições antes de atualizar o estado, exibindo mensagens de sucesso/erro via Toast.
- **Atualização do Google Apps Script:** O script foi atualizado para suportar as colunas `oldPrice` e `variations` na aba de Produtos, garantindo que as variações e preços promocionais sejam salvos e carregados corretamente. O script também ajusta automaticamente os cabeçalhos caso estejam incompletos.
