# Infra Map — Economart Pouso Alegre

Mapa físico e inventário técnico com uma central de suporte para computadores vinculados ao ISL AlwaysOn. A API e o frontend escutam apenas em `127.0.0.1`. O editor é local e não tem login; o suporte exige uma chave de operador.

## Executar no Windows

Pré-requisitos: Node compatível com `package.json`, npm 11+, Docker Desktop em execução e PowerShell.

```powershell
npm install
npm run setup
npm run dev
```

Na tela `/credentials`, use `SUPPORT_OPERATOR_TOKEN` de `apps/backend/.env`. `CREDENTIALS_ENCRYPTION_KEY` serve apenas para cifrar os dados. O setup preserva valores já preenchidos e completa tokens ausentes ou vazios; reinicie o backend após editar o `.env`.

`setup` cria arquivos de ambiente ausentes e gera segredos locais; valores existentes são preservados e a chave do cofre só é gerada quando está ausente ou vazia. `dev` inicia PostgreSQL, aplica as migrations pendentes, gera o Prisma Client e inicia API, frontend e worker. O worker consulta somente equipamentos com monitoramento habilitado. Não recria mapas de exemplo.

- Interface: http://127.0.0.1:3000
- API: http://127.0.0.1:4000
- Processo ativo: http://127.0.0.1:4000/health
- Banco disponível: http://127.0.0.1:4000/health/ready

As configurações são carregadas por `packages/config`, na ordem: ambiente do processo, `apps/backend/.env`, `.env` da raiz. O `.env` da raiz contém as variáveis `DB_USER`, `DB_PASSWORD` e `DB_NAME` utilizadas pelo Docker. O backend contém `DATABASE_URL` e as opções do ISL. Não publique esses arquivos.

`npm run setup` também gera `CREDENTIALS_ENCRYPTION_KEY` para o cofre local. As credenciais cadastradas pela interface exigem a chave de suporte e têm usuário/senha cifrados com AES-256-GCM antes de chegar ao PostgreSQL. Faça cópia segura do `apps/backend/.env`: sem a chave original, credenciais salvas não poderão ser abertas. O cofre começa com os tipos de credencial que já têm uso implementado; senhas temporárias continuam disponíveis na consulta Windows.

Se mudar a porta da API, configure também `API_INTERNAL_URL` no ambiente do frontend e reinicie o Next. Exemplo: `http://127.0.0.1:4001`. Esse endereço é usado pelo proxy no servidor e não contém credenciais.

## Organização

| Pasta                                    | Responsabilidade                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/frontend/src/components`           | Editor visual, canvas, navegação e inspetor                                         |
| `apps/frontend/src/features/inventory`   | Seleção e posicionamento do inventário existente                                    |
| `apps/frontend/src/features/support`     | Interface de suporte, cliente autorizado, presença, histórico e comparação de filas |
| `apps/backend/src/modules/devices`       | Cadastro técnico: rotas, serviço e repositório                                      |
| `apps/backend/src/modules/maps`          | Mapas, persistência transacional do layout e conexões                               |
| `apps/backend/src/modules/support`       | Regras de suporte e auditoria; adaptadores separados de WebAPI2 e ISL Light         |
| `apps/backend/src/modules/inventory`     | Validação, preparação e importação transacional do cadastro de impressoras          |
| `apps/backend/src/domain`                | Regras espaciais sem acesso a banco ou HTTP                                         |
| `apps/backend/src/shared`                | Erros HTTP e leitura limitada de respostas                                          |
| `packages/contracts`                     | Contratos de validação e tipos compartilhados                                       |
| `packages/database`                      | Prisma, migrations, cliente e conexão PostgreSQL                                    |
| `packages/config`                        | Carregamento consistente dos arquivos de ambiente                                   |
| `apps/worker`                            | Agendamento das leituras habilitadas, por meio da API local                         |
| `apps/backend/src/modules/monitoring`    | Configuração, leituras, regras de saúde, comparação de filas e histórico            |
| `apps/frontend/src/features/monitoring`  | Painel de monitoramento e atualização paginada dos estados no mapa                  |
| `apps/frontend/src/features/workflows`   | Lista de workflows (mapas) e abertura do editor existente                           |
| `apps/frontend/src/features/credentials` | Formulários específicos e gerenciamento do cofre local de credenciais               |
| `apps/backend/src/modules/credentials`   | Cofre criptografado, rotas protegidas e resolução de credenciais de impressão       |
| `scripts`                                | Preparação local, importação e verificação de integração                            |
| `docs/references`                        | Documentação técnica fornecida, com histórico e pendências                          |

Rotas validam parâmetros e traduzem HTTP. Serviços aplicam regras. Repositórios persistem. O frontend não recebe credenciais da conta ISL. Comandos de manutenção são fixos e gerados exclusivamente no backend.

Excluir um território ou remover uma posição **preserva equipamentos, associações e histórico de suporte**. A exclusão do desenho não é exclusão do inventário. Renomear um cadastro atualiza suas posições persistidas. Duplicar uma posição não cria outro equipamento físico.

## Cadastro das impressoras fornecidas

Os arquivos originais de referência estão em `docs/references`. Os dados WSD, LPR e de acessórios permanecem documentados como observações; não substituem a fila corporativa. Número de série, patrimônio e MAC pendentes não são inventados. Testes antigos não definem o estado atual.

```powershell
# Prévia: valida o arquivo e consulta conflitos, sem gravar
npm run inventory:import

# Aplicar: cria somente filas ainda não cadastradas
npm run inventory:import -- --apply

# Usar outro arquivo no mesmo formato
npm run inventory:import -- "C:\caminho\cadastro.json"
```

A aplicação ocorre em uma transação. Repetir a importação preserva cadastros existentes. Conflitos de nome ou IP exigem revisão e não provocam sobrescrita. Na interface, use **Consultar inventário cadastrado → Equipamento existente → Posicionar no mapa**, depois **Salvar mapa**. O cadastro técnico é salvo separadamente em **Inventário → Salvar cadastro**.

## Suporte e estados

O cadastro agora oferece **campos pesquisáveis com entrada manual**, incluindo servidor, fila, driver e portas. A aba Suporte permite coletar o catálogo do servidor Windows escolhido. Consulte [catálogos e descoberta de impressão](docs/catalogos-impressao.md) para o fluxo, as origens e os pré-requisitos. O cadastro documental das duas Epson já alimenta as sugestões; a consulta real depende de acesso ao servidor.

Veja [configuração e homologação do ISL](docs/isl-integracao.md).

As rotas `/workflows` e `/credentials` ficam na navegação do editor. Workflows listam os mapas existentes e abrem o editor preservado em `/workflow/:id`. O tipo de credencial persistente atual é **Windows Print Server**, reutilizado na descoberta de filas. Credenciais Epson não aparecem como formulário ativo porque o material técnico fornecido não especifica um método de autenticação para as duas WF documentadas; os dados de rede e fila continuam no cadastro de inventário.

Veja também [Workflows e Credentials](docs/workflows-credentials.md) para o contrato do cofre e como acrescentar novos provedores.

Conexões **computador ↔ impressora** agora definem a impressora esperada e alimentam a comparação das leituras Windows. A aba **Monitorar** configura presença ISL, saúde Windows, fila do servidor e porta TCP conhecida. Consulte [monitoramento e integração](docs/monitoramento.md). O agendamento começa desligado e preserva o estado manual do inventário.

- **Estado informado manualmente:** classificação do cadastro. Não muda ao consultar o ISL.
- **Presença ISL:** resposta do provedor com horário de consulta. Ausência na lista autorizada não significa offline.
- **Diagnóstico do Windows:** consulta de Spooler, filas e trabalhos mediante Execute homologado. Executa como SYSTEM e pode não enxergar filas do perfil do funcionário.
- **Estado físico da impressora:** requer coleta específica ou conferência; presença no ISL e driver correspondente não provam impressão física.

Reinício e limpeza do Spooler são ações distintas. Limpeza apaga os trabalhos pendentes do diretório padrão e exige confirmação explícita. Diretórios personalizados exigem procedimento assistido. Nenhum desses comandos é executado pelo instalador ou pelos testes.

Operações pendentes bloqueiam novas execuções no mesmo computador. Timeout ou falha após envio geram `REVIEW_REQUIRED`, preservando o ID remoto quando disponível. Confira o portal ISL e registre a conferência manual para liberar novas solicitações. Esse registro não cancela ações remotas nem comprova sucesso. `RESULT_AVAILABLE` indica somente que existe relatório.

## Verificar alterações

```powershell
npm run verify
npm run test:integration
npm exec playwright install chromium
npm run test:e2e
npm audit
```

`verify` gera o cliente Prisma e verifica tipos (inclusive scripts), testes, lint de todos os módulos, formatação, código/dependências sem uso e build do frontend. `format` aplica a formatação; `format:check` apenas verifica. Dependências de uma versão major diferente não são atualizadas automaticamente.

Os testes de integração precisam do PostgreSQL e criam registros temporários identificados por IDs novos, removidos ao terminar. Os testes de navegador usam portas 3001/4001, saída `.next-e2e` separada, ISL desabilitado e chave exclusiva de teste; não alteram a configuração do operador nem executam manutenção remota. O teste TCP consulta somente a API local. `build` e `dev` compartilham a saída padrão do Next e devem ser executados separadamente.

## Próximas etapas

O sistema fornece inventário, mapa, vínculo ISL, monitoramento agendado, comparação de filas esperadas, diagnósticos/reparos e histórico. Permanecem etapas de implantação: homologar as fontes e Execute na empresa; definir repositório de drivers e instalação no perfil correto; acrescentar métricas físicas de impressoras e autenticação por operador antes de uso compartilhado em rede.

O monitoramento faz leituras e registra alertas. Consulta automática de tinta/papel e reinstalação automática de drivers ainda não foram implementadas.
