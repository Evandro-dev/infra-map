# Revisão da base — 25/10/2026

## Diagnóstico

O log fornecido já apresentava TypeScript, 18 testes, lint e build aprovados. Os problemas reproduzidos eram formatação sem configuração compartilhada, dependências e exports sem uso e configuração Prisma com nome fora do padrão. A inspeção encontrou ainda falhas de fluxo e preservação de dados.

## Correções

- Prisma agora usa `packages/database/prisma.config.ts`, descoberto pela CLI sem argumentos adicionais. API, CLI e scripts usam o mesmo carregador de ambiente.
- `verify` inclui geração do cliente, tipos dos scripts, lint de backend/pacotes/scripts, Prettier e Knip. Código gerado e backups não são formatados.
- Dependências sem uso foram removidas. `@prisma/client` continua declarado porque o cliente gerado importa seu runtime; essa dependência tem uma exceção específica no Knip. O scanner não interpreta os arquivos gerados como código mantido manualmente.
- Suporte separado em contratos, rotas, serviço, repositório, cliente WebAPI2 e launcher. O frontend tem cliente de suporte, tipos, comparação, presença e histórico separados.
- POST sem corpo não declara JSON vazio; isso corrige o acionamento do ISL Light. Respostas 204 não exigem parse de JSON.
- O launcher aguarda o evento real de criação do processo para confirmar a abertura.
- O cliente ISL compartilha login concorrente, mantém sessão rotacionada, usa POST, limita respostas e não retorna descrições do provedor que possam conter segredos. A busca utiliza o método `/computer/search/1` documentado no exemplo oficial de Execute.
- A inspeção das respostas percorre arrays de computadores/eventos. O ID da operação é persistido antes da autenticação. Falhas inconclusivas exigem conferência, e consultar status não transforma falha histórica em operação enviada.
- A limpeza do Spooler requer confirmação adicional, limita remoção a arquivos `.SPL`/`.SHD` do diretório padrão e tenta religar o serviço em `finally`. Não foi executada em computador real durante a revisão.
- Consultas e comandos mantêm o estado manual do inventário separado da presença ISL. A comparação de impressoras considera servidor e fila e explica a limitação do contexto SYSTEM.
- Exclusão de mapas/posições preserva inventário, associações e histórico. Conexões invertidas simultâneas são serializadas e não duplicadas.
- Rascunho do nome volta ao valor correto ao descartar o formulário. Duplicação de dispositivo preserva a identidade e o nome do equipamento; cópia de setor continua independente.
- Importação das impressoras valida rede, mantém pendências, não inventa estado atual, oferece prévia e preserva registros já existentes.

As migrations antigas foram preservadas. Esta revisão não redefine banco, não habilita Execute e não muda credenciais existentes. O backup do código anterior está em `.backups/revisao-20261025-204820`.

## Validação

Resultado no Windows do projeto em 25/10/2026:

| Verificação                             | Resultado                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run verify`                        | Aprovado: geração Prisma, tipos, 46 testes em 13 arquivos, lint, formatação, Knip e build                   |
| `npm run test:integration`              | Aprovado com PostgreSQL real; registros temporários removidos                                               |
| `npm run test:e2e`                      | 2 testes aprovados no Chromium, incluindo sincronização entre suporte e inventário sem perder rascunhos     |
| `npm audit`                             | Zero vulnerabilidades conhecidas reportadas                                                                 |
| `npm run dev`                           | PostgreSQL saudável, 4 migrations aplicadas anteriormente e nenhuma pendente, API/banco e frontend HTTP 200 |
| Importação fornecida                    | 2 impressoras cadastradas; nova prévia identificou ambas como existentes e preservadas                      |
| `npm run setup` em instalação existente | Arquivos de ambiente preservados                                                                            |

O script de preparação também passou sem o aviso Node `DEP0190`, após substituir a execução do npm via shell por chamada direta à CLI. Os servidores iniciados para verificação foram encerrados. Os testes não habilitam o ISL nem realizam manutenção em equipamentos reais.

As verificações automatizadas abrangem contrato de comandos, respostas ISL simuladas, autenticação HTTP, limites de download, comparação de filas, importação e lógica espacial. Há uma verificação com PostgreSQL real para atomicidade, concorrência e preservação de dados, além de teste do fluxo de inventário e suporte no Chromium.

O teste com ISL real, a execução de PowerShell no AlwaysOn e a impressão física dependem do ambiente corporativo. Nenhum relatório disponível é tratado como comprovação automática de reparo.

O documento `REVISAO_EDITOR_20261025.md` registra a revisão anterior. As referências antigas à remoção de inventário órfão e à validação sem Docker foram substituídas pelo comportamento descrito aqui e no README.
