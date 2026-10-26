# Catálogos pesquisáveis e descoberta de impressão

O cadastro permite selecionar, pesquisar e digitar valores novos no mesmo campo. Servidor, fila no servidor, compartilhamento, driver, nome da porta e protocolo têm sugestões relacionadas. Fabricante, modelo, hostname, sistema operacional e usuário principal também reutilizam valores do inventário.

Número de série, patrimônio, MAC e nome do equipamento continuam sendo campos de identificação individual. Não são sugeridos como se fossem valores intercambiáveis.

## Usar no cadastro

1. Selecione uma impressora no mapa e abra **Inventário**.
2. Em **Servidor de impressão**, pesquise ou selecione o servidor. A referência fornecida já inclui `SRV-SKY-PRT-01`.
3. Em **Fila no servidor**, pesquise uma fila. A lista mostra servidor e origem.
4. Selecionar a fila preenche os dados conhecidos no rascunho: nome do compartilhamento, driver, porta, protocolo e número TCP quando disponíveis. Um IP só é preenchido quando consta nos dados e é um endereço válido.
5. Confira os campos e use **Salvar cadastro**. Selecionar uma fila não altera o Windows nem salva o cadastro automaticamente.
6. Se o valor não estiver na lista, digite e use **Usar como valor manual**, ou deixe o texto no campo e salve. O valor salvo passa a aparecer como sugestão do inventário.

As teclas de seta percorrem opções, Enter seleciona a opção em foco e Esc fecha a lista. Tab preserva o texto digitado. O botão de seta permite visualizar as opções sem apagar o valor atual. O menu tem páginas de 20 opções, botões Anterior/Próxima e busca no servidor. Somente o campo aberto faz consultas, com cancelamento de respostas antigas e um pequeno intervalo para não consultar a cada tecla.

O campo usa CSS Module e uma seta posicionada dentro da caixa. O menu é renderizado em um portal, para não ser cortado pelo scroll das sidebars; ele abre acima do campo quando falta espaço abaixo.

Trocar o servidor limpa os campos dependentes de fila, driver e porta no rascunho. Isso evita manter configurações do servidor anterior. A troca não altera o cadastro até o salvamento.

**Fila no servidor** é o nome local da fila instalada naquele servidor. **Nome da fila compartilhada** é o nome usado em `\\servidor\compartilhamento`. **Nome da porta** pode ser um nome como `IP_192.168...`, WSD ou outro identificador; **Porta TCP (número)** é um número de 1 a 65535. Esses campos têm significados distintos.

## Fontes e atualidade

| Origem              | Significado                                                                            |
| ------------------- | -------------------------------------------------------------------------------------- |
| Documento fornecido | Referência técnica histórica. A data original é preservada; não indica consulta atual. |
| Inventário salvo    | Valores cadastrados manualmente ou conferidos pelo operador.                           |
| Consulta Windows    | Última coleta concluída no servidor selecionado, com horário de coleta.                |

Há um snapshot por servidor e origem. Uma coleta Windows não remove a referência documental. Em filas de mesmo nome e servidor, a coleta Windows tem preferência para apresentar os dados observados. O catálogo não altera um cadastro que já existe: aplicar uma opção e salvar continua sendo uma decisão do operador.

A presença de um driver no servidor não comprova homologação do pacote. Filas virtuais, múltiplas filas do mesmo equipamento e filas sem compartilhamento podem existir; listar filas não equivale a contar equipamentos físicos. A coleta não cria automaticamente dispositivos nem posições no mapa.

Protocolo, número TCP e acessórios não são deduzidos pelo nome do modelo ou da porta. Na referência das duas Epson, protocolo e número TCP do servidor permanecem sem valor, como no documento original. Dados WSD/LPR observados em outro PC não substituem a configuração do servidor.

## Consultar o servidor

Na aba **Suporte**, autorize com a chave do operador e abra **Descobrir filas, drivers e portas**. Confira **Servidor para consulta** e clique em **Consultar servidor de impressão**.

A API executa consultas de leitura com `Get-Printer`, `Get-PrinterDriver` e `Get-PrinterPort`. Por padrão utiliza a conta Windows que executa o backend. É necessário acesso desse computador ao servidor, permissões adequadas e módulo PrintManagement disponível.

Se essa conta não tiver acesso, marque **Usar outra conta Windows somente nesta consulta** e informe usuário e senha temporários. Prefira a identificação completa `DOMINIO\usuario` ou `usuario@dominio`; o sistema não inventa o domínio nem preenche credenciais particulares. O backend cria uma sessão CIM/DCOM temporária com essa conta. Não há elevação automática da sessão ISL ou de um PowerShell interativo.

A senha não entra na URL, linha de comando, variáveis de ambiente, arquivos `.env`, cadastro ou snapshot. O coletor a recebe por stdin em UTF-8, cria um PSCredential na memória e encerra a sessão CIM ao terminar. O frontend limpa o campo após a tentativa e ao mudar de conta/servidor. O processo recebe apenas variáveis necessárias do Windows, sem as configurações de banco e ISL. A API protege a consulta com a chave de suporte e oculta credenciais no logger.

Isso é diferente da elevação UAC no computador atendido: nesse caso, informe as credenciais no prompt do Windows dentro do ISL Light. A senha da conta Windows também é diferente da senha de acesso do computador ISL AlwaysOn. Veja [o roteiro para o teste na empresa](teste-empresa-20261026.md).

O destino é um único hostname ou IPv4, sem caminho, intervalo de rede ou comando livre. Há limite de 20 segundos e 2 MB por coleta, até duas coletas simultâneas na API e seis solicitações por minuto na rota. Consultas simultâneas ao mesmo servidor são bloqueadas. O código não instala drivers, não altera filas, não imprime e não reinicia Spooler.

Se só a consulta de portas ou drivers falhar, as filas coletadas são mantidas com um aviso. Se a coleta das filas falhar, o snapshot anterior permanece. Campos manuais e referências continuam disponíveis. As mensagens distinguem módulo ausente, permissão negada quando identificável e falha de consulta do servidor; saídas brutas do PowerShell não são publicadas.

Também existem comandos locais:

```powershell
# Sincroniza o catálogo documental; não consulta a rede nem altera equipamentos
npm run inventory:reference

# Consulta somente este servidor e armazena o catálogo obtido
npm run inventory:discover -- SRV-SKY-PRT-01
```

O comando CLI usa as permissões do operador local do Windows. O endpoint HTTP exige `x-support-token`. O catálogo de sugestões segue o mesmo acesso local do inventário existente.

## Organização e validação

- `packages/contracts/src/inventory-catalog.ts`: validação dos snapshots e tipos de catálogo.
- `apps/backend/src/modules/inventory/print-catalog.*`: regras de coleta e persistência de snapshots.
- `apps/backend/src/modules/inventory/catalog-search.repository.ts`: busca, deduplicação, prioridade de fontes e paginação no PostgreSQL.
- `apps/backend/src/modules/inventory/adapters/`: coletor PowerShell fixo e adaptador com limite de execução.
- `apps/frontend/src/components/ui/searchable-field.tsx` e seu CSS Module: combobox reutilizável com texto livre, teclado, portal e páginas.
- `apps/frontend/src/features/inventory/`: campos relacionados, cliente do catálogo e painel de descoberta.

A migration `20261025220000_print_catalog` adiciona os quatro campos técnicos e a tabela de snapshots. Não redefine tabelas nem altera dispositivos existentes. O catálogo da documentação foi sincronizado para `SRV-SKY-PRT-01`, com as duas filas fornecidas.

Os testes incluem isolamento por servidor, prioridade das fontes, validação do destino, concorrência, preservação após falha, persistência PostgreSQL e o fluxo no Chromium de seleção, preenchimento e entrada manual.

Validação concluída no projeto: `npm run verify` aprovado, com 56 testes em 16 arquivos, lint incluindo configurações `.mjs`, tipos, formatação, Knip e build. A integração PostgreSQL passou; os três testes de navegador passaram. O teste específico do catálogo também confirma busca pelo compartilhamento, seleção por teclado, posição da seta dentro do campo e navegação entre páginas. Credenciais dos testes são fictícias e os processos Windows são simulados; a autenticação corporativa não foi tentada nesta revisão.

A revisão seguinte acrescentou paginação real no PostgreSQL e testes de geometria do campo, navegação entre páginas e descarte de credenciais temporárias. `GET /api/v1/inventory/options` exige `field`, aceita `kind`, `server`, `search`, `page` e `pageSize`, limita páginas a 50 opções e retorna `items`, `total`, `page`, `pageSize`, `totalPages` e `hasNext`. `GET /api/v1/inventory/catalog` agora retorna apenas o resumo dos snapshots do servidor selecionado e o servidor de referência, sem carregar listas completas. A prioridade de fontes e a deduplicação ocorrem antes do limite/offset, no banco; os valores do cliente são parâmetros SQL.

`POST /api/v1/inventory/print-discovery` também retorna somente identificação, horário, avisos e contagens de filas/drivers/portas. As listas coletadas permanecem no servidor e são consultadas pelas páginas de opções, em vez de serem enviadas por inteiro após a coleta.

Na tentativa local de 25/10/2026, o Windows não conseguiu consultar as filas de `SRV-SKY-PRT-01`. A coleta em ambiente corporativo acessível permanece necessária para obter a lista atual completa. Não foi fabricada uma lista de impressoras nem alterado o estado manual dos equipamentos.

## Fontes oficiais

- [Get-Printer e consulta a computador remoto](https://learn.microsoft.com/en-us/powershell/module/printmanagement/get-printer)
- [Get-PrinterPort](https://learn.microsoft.com/en-us/powershell/module/printmanagement/get-printerport)
- [Get-PrinterDriver](https://learn.microsoft.com/en-us/powershell/module/printmanagement/get-printerdriver)
- [Portas TCP/IP e protocolo RAW/LPR](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-tcpipprinterport)
