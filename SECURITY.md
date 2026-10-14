# Segurança

## Relatar uma vulnerabilidade

Não publique chaves, dados pessoais, pedidos, cookies, tokens de recuperação ou provas de exploração em uma issue pública. Use a opção de relato privado na aba Security do GitHub, quando disponível; caso contrário, contate o mantenedor pelo endereço público do perfil ou `ale.sobral.cortes@gmail.com`. Não teste ataques contra a loja em produção: reproduza em um banco local isolado.

São mantidas as versões atuais da branch `main`. Melhorias de segurança são publicadas após validação; não há SLA definido.

## Proteções atuais

- Sessões assinadas, cookies HTTP-only, hash de senha e revogação de outras sessões após troca/redefinição.
- Ações administrativas autenticadas, verificações de origem nos acessos e validação dos pedidos no servidor.
- Webhooks Mercado Pago assinados, com conferência da transação e criação idempotente do pedido.
- Recuperação com tokens aleatórios armazenados como hash, expiração e uso único atômico.
- Variáveis privadas somente no servidor; dados, ambientes, backups e credenciais fora do Git.
- Web Push da cozinha restrito aos dispositivos administrativos. `noindex`/`robots.txt` não substituem autenticação.
- CI verifica padrões de credenciais, TypeScript, testes, build e avisos altos nas dependências de execução.

## Dependências e limitações

Em 14/10/2026, `npm audit --omit=dev` não apontou avisos conhecidos nas dependências de execução. Isso não garante ausência de falhas.

O parser CSS foi atualizado por override para 7.1.6, corrigindo [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf); a compatibilidade é verificada no build e na interface.

O alerta [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) de `braces` ainda não tem versão corrigida no registro consultado. O audit completo também sinaliza pacotes de build que dependem dele via Tailwind 3. Esses caminhos processam fontes/padrões de desenvolvimento, não entradas públicas do checkout; não compilar projetos ou padrões de origem não confiável. Não foi feita migração ampla de Tailwind apenas para ocultar esse aviso. Reavaliar quando houver correção ou migração validada.

O cadastro ainda não confirma posse do e-mail, nome/telefone são autodeclarados e limites por IP têm as limitações do armazenamento em memória nas funções distribuídas. A recuperação depende da segurança da caixa postal. Esta revisão não é auditoria independente ou certificação. Pagamento real em produção, dispositivos iOS e configurações comerciais exigem validações próprias.

## Histórico legado

O GitHub sinalizou duas ocorrências de chaves Google nos arquivos antigos de Firebase. A versão atual não utiliza essas configurações, e as credenciais privadas atuais não foram encontradas na revisão local de 502 blobs históricos de texto. Os alertas Google estão com validade desconhecida; não foram marcados como revogados ou como falso positivo.

Chaves de cliente Firebase não são senhas de usuário, mas seu escopo e suas restrições precisam ser conferidos no Google Cloud, especialmente se também autorizavam outras APIs. A exclusão de arquivos não revoga uma chave nem apaga cópias do histórico. O responsável deve verificar a utilização, restringir ou revogar as chaves antigas sem afetar outros projetos, conforme a [orientação Firebase](https://firebase.google.com/docs/projects/api-keys).
