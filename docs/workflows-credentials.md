# Workflows e Credentials

## Workflows

`/workflows` abre o Overview e `/personal` abre o espaço Personal. As duas páginas usam as abas `Workflows` e `Credentials`; as rotas de credenciais correspondentes são `/credentials` e `/personal/credentials`. O espaço Personal usa o mesmo conjunto de mapas porque o modelo atual ainda não tem propriedade ou compartilhamento por usuário.

O termo workflow na interface identifica um mapa de infraestrutura e suas conexões, não uma automação executável. A listagem usa `GET /api/v1/maps/paged` com página, tamanho (até 100), busca, ordenação e filtro de atualização recente. Os controles de busca e paginação consultam esse endpoint; o `GET /api/v1/maps` sem paginação permanece disponível ao editor do mapa. `GET /api/v1/maps/summary` fornece as contagens usadas no cabeçalho. Criar ou abrir um item leva ao editor existente em `/workflow/:id`; essa rota individual não foi substituída.

## Credentials

A página `/credentials` usa a navegação do operador e exige `SUPPORT_OPERATOR_TOKEN`, informado somente em memória. As operações `GET`, `POST`, `PATCH` e `DELETE /api/v1/credentials` também exigem `x-support-token`.

O primeiro formulário disponível é **Windows Print Server** porque essa é a integração com conta de usuário implementada no projeto. A credencial pode ser limitada a um host ou liberada para qualquer servidor. Na descoberta de filas, o operador pode escolher a conta do processo, informar uma senha temporária para uma consulta ou selecionar uma credencial do cofre. O coletor continua recebendo usuário/senha por stdin; o segredo não é colocado em URL, argumento de processo, log, snapshot ou resposta da API.

O PostgreSQL armazena usuário e senha juntos como payload AES-256-GCM. O nonce e a tag ficam em colunas separadas, e a lista da API devolve somente nome, tipo, servidor-alvo e datas. Para trocar a conta, o operador informa os novos dados explicitamente. A chave de 32 bytes em Base64 é gerada por `npm run setup` na variável `CREDENTIALS_ENCRYPTION_KEY` de `apps/backend/.env`, separada da chave de suporte. Ela precisa ser incluída em backup protegido: sem a chave original não há recuperação das credenciais salvas. Rotação deve ser planejada com recriptografia antes de substituir a chave.

## Tipos ainda indisponíveis

Os arquivos de referência confirmam endereços IP, filas compartilhadas, drivers e observações WSD/LPR das Epson WF-M5899 e WF-C878R. Os CSVs também marcam SNMP como ativo e registram portas, mas não informam versão SNMP, comunidade, usuário ou senha. Não há autenticação confirmada para o painel web ou SNMP; esses dados continuam no inventário e não viram credenciais inventadas. A WebAPI2 ISL continua configurada pelas variáveis de ambiente existentes; a página não altera essa integração. Um novo tipo só deve ser liberado quando houver requisitos, contrato de dados e ação consumidora implementada.
