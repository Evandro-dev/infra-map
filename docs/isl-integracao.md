# Integração opcional com ISL Light / ISL AlwaysOn

A interface **continua sem login para editar mapas**, mas o módulo administrativo
"Central de suporte" exige uma chave de operador separada, mantida apenas em
`apps/backend/.env`. A chave é introduzida na interface somente na memória da
aba, não é salva em `localStorage`, cookies ou banco de dados.

**Primeiro uso / preparação local**:

```powershell
cd "C:\Users\Evandro\Documents\Projetos\Developer\infra-map"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\configurar-isl.ps1
```

Depois, ajuste `apps/backend/.env` (não substitua todo o arquivo):

```dotenv
# ISL hospedado pela ISL Online:
ISL_MODE=hosted
ISL_SERVER_URL=

# OU ISL Conference Proxy da empresa:
# ISL_MODE=self-hosted
# ISL_SERVER_URL=https://servidor-isl-da-empresa

ISL_API_USERNAME=
ISL_API_PASSWORD=
ISL_LIGHT_EXE=
ISL_REMOTE_EXEC_ENABLED=false
# SUPPORT_OPERATOR_TOKEN é gerado pelo script acima
```

Com `ISL_MODE=hosted`, o backend utiliza `https://islonline.net/webapi2`.
Com `ISL_MODE=self-hosted`, utiliza `ISL_SERVER_URL/webapi2` e requer certificado TLS confiável.
Não é necessário alterar código, migrar dados ou mudar o frontend ao trocar o modo.
As credenciais e a chave ficam somente no backend. Prefira uma conta de integração
corporativa autorizada, com privilégios mínimos; nunca compartilhe senhas com terceiros.

### Fluxo de uso

1. Abra o Infra Map com `npm run dev` (Docker Desktop deve estar em execução).
2. Clique em um ícone **Computador** no mapa; a **Central de suporte** aparece no painel direito.
3. Copie o valor de `SUPPORT_OPERATOR_TOKEN` de `apps/backend/.env` para o campo de chave. Não o divulgue.
4. Busque o computador na lista ISL, confira nome/status e clique em **Vincular**.
5. Clique em **Abrir ISL Light** se o aplicativo e `ISL_LIGHT_EXE` estiverem configurados **no mesmo Windows que executa a API**. A senha de acesso continuará sendo solicitada pelo ISL Light.
6. Clique em um ícone **Impressora** para cadastrar servidor de impressão, nome da fila e driver aprovado.
7. Volte ao computador, associe impressoras do inventário e consulte as ações disponíveis.

### Diagnóstico / execução remota

#### Senha Windows, UAC e senha ISL

A conta administrativa Windows usada nos prompts de elevação não é a senha de acesso do ISL AlwaysOn. Se um PowerShell interativo pedir elevação no computador atendido, use o prompt nativo do Windows dentro do ISL Light e o Modo Administrativo quando necessário. O Infra Map não preenche nem armazena essa senha.

Para **consulta ao servidor de impressão**, existe uma opção separada de conta Windows temporária, enviada apenas ao coletor local por stdin e descartada após a tentativa. Ela não altera a identidade de uma sessão ISL nem habilita Execute. Não coloque essa senha nos campos `ISL_API_PASSWORD`, `SUPPORT_OPERATOR_TOKEN` ou no campo de senha de acesso ISL do PC. Consulte [o modo administrativo oficial](https://help.islonline.com/109823/3727558) e [o roteiro de testes de 26/10](teste-empresa-20261026.md).

O catálogo contém consultas do serviço Spooler, filas, drivers e trabalhos pendentes,
além de reinício e limpeza do Spooler. A limpeza exige confirmação adicional de exclusão de todos
os trabalhos pendentes e recusa diretórios de spool personalizados. Só utiliza ações previamente definidas no
backend; não oferece shell arbitrário pelo navegador. Histórico de solicitações
é registrado no PostgreSQL, com ID do computador e da ação, nunca com senhas.

**Por segurança, `ISL_REMOTE_EXEC_ENABLED=false` é o valor padrão.** A permissão
`Execute` do ISL AlwaysOn depende da licença, configurações e políticas da empresa.
As chamadas usam `islalwayson/actions/start/1`, `actions/info/1` e `actions/authenticate/1`.
A implementação de Execute deve ser **homologada em um computador de teste** porque
pode exigir autorização específica de `powershell.exe` no ISL e o formato/fluxo
pode variar conforme a versão do servidor. O cadastro e vínculo de computadores
não dependem da habilitação de Execute.

A busca usa `islalwayson/computer/search/1`, documentado no exemplo oficial de Execute.
O cliente aceita listas diretas ou em `computers`, `items`, `list` e `results`; formatos desconhecidos
falham explicitamente. A consulta **Consultar presença no ISL** informa a resposta e o horário, sem
sobrescrever o estado manual do inventário e sem interpretar ausência como offline.

As operações pendentes bloqueiam novas ações no mesmo computador. Falhas de transporte ou autenticação
após o início ficam como `REVIEW_REQUIRED`. Confira no portal ISL antes de usar **Registrar conferência
manual**. Esse botão libera novas solicitações, mas não cancela uma ação remota em andamento.
`RESULT_AVAILABLE` indica arquivo disponível, não sucesso do comando. O arquivo é lido com limite de
128.000 bytes, inclusive sem `Content-Length`; o conteúdo não é salvo no banco.

`Reinstalar impressora` e `Reinstalar driver` ficam **como procedimentos assistidos**
no ISL Light, até que se confirme o repositório de drivers homologados e o
contexto de usuário correto. Não são executados automaticamente.

Quando a execução é permitida, o ISL AlwaysOn executa no contexto SYSTEM sem GUI;
isso não equivale ao perfil interativo de impressão do funcionário. Evite
reiniciar Spooler durante trabalhos críticos e obtenha a autorização adequada.

### Fontes oficiais

- https://help.islonline.com/19973/166148 — WebAPI2, POST, `hedata` e `hs`
- https://help.islonline.com/165993 — ISL AlwaysOn Execute, autenticação e resultado
- https://help.islonline.com/19145/164067 — ISL Light `--connect` com `co_id`

### Arquitetura

- `apps/backend/src/modules/support/isl.client.ts`: adaptador de WebAPI2 para ambos os modos.
- `apps/backend/src/modules/support/support.auth.ts`: autorização com chave isolada.
- `apps/backend/src/modules/support/support.routes.ts`: contratos HTTP de lista, vínculo, impressoras, histórico e ações.
- `apps/backend/src/modules/support/support.service.ts`: regras, estados e coordenação das operações.
- `apps/backend/src/modules/support/support.repository.ts`: persistência e bloqueio de ações concorrentes.
- `apps/backend/src/modules/support/isl.launcher.ts`: abertura local do aplicativo com confirmação da criação do processo.
- `apps/backend/src/modules/support/support.actions.ts`: comandos permitidos, sem comandos livres.
- `apps/frontend/src/features/support/`: UI, cliente de suporte, presença, comparação de filas e histórico.
- `packages/database/prisma/migrations/20261025000000_isl_support/`: migração aditiva.

Não publique o frontend sem autenticação em uma rede corporativa ou na internet.
Não utilize o módulo de manutenção em computadores sem autorização institucional.
