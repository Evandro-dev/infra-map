# Monitoramento e integração computador/impressora

## Uso no editor

Conectar um computador a uma impressora cadastra essa impressora como **esperada naquele computador**. A relação é compartilhada pelo inventário e pela aba Suporte. O desenho não instala filas ou drivers no Windows. Os demais pares permanecem conexões de topologia.

Salve o mapa quando houver posições ou conexões em rascunho. Selecione o equipamento e abra **Monitorar**. Autorize com a mesma chave de operador do Suporte, escolha as fontes, confira intervalo e timeout e salve. **Coletar agora** faz uma leitura. **Monitoramento automático** permite ao worker repeti-la. Todos os equipamentos começam com o agendamento desligado.

Para conectar dispositivos, segure um ponto lateral e arraste até o ponto ou corpo do outro dispositivo. A linha acompanha o cursor e fica verde quando o destino é válido. Também é possível clicar em um ponto e depois no outro. Soltar em espaço vazio ou pressionar Esc cancela o arraste. Arrastar o corpo do node continua movendo sua posição.

Ao passar o mouse sobre uma linha, a lixeira aparece no centro da curva e remove somente aquela conexão. Também é possível focar a linha pelo teclado e usar Delete. Associações de impressão pedem confirmação do efeito nos outros mapas; linhas tracejadas vindas do inventário exigem o acesso de suporte já utilizado para gerenciar essas associações.

O ponto no dispositivo indica saúde observada: verde sem alertas, amarelo atenção/parcial, vermelho crítico, cinza sem leitura/desativado e roxo dados antigos. Os detalhes mostram fonte, horário, métricas e histórico. O estado manual do inventário permanece separado. As linhas de impressão usam a comparação das filas esperadas quando existe leitura recente.

Remover explicitamente uma conexão de impressão remove a associação esperada, inclusive suas linhas em outros mapas. Não desinstala a impressora. Excluir um mapa ou uma posição preserva a associação, o equipamento e o histórico.

## Fontes disponíveis

| Fonte                 | Verifica                                                                      | Requisitos e limites                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ISL                   | Presença do computador vinculado na conta autorizada                          | Configurar WebAPI2 e vínculo no Suporte. Não armazena senha Windows ou de acesso AlwaysOn. Ausência na lista é desconhecida; offline vem explicitamente do provedor.      |
| Windows               | Spooler, sistema, tempo ligado, RAM livre, discos e filas visíveis à consulta | API no Windows, hostname/IP cadastrado, CIM/DCOM permitido e identidade do processo autorizada. PrintManagement para listar filas. Sem acesso, a fonte fica indisponível. |
| Servidor de impressão | Existência da fila, driver e estado informado pelo servidor                   | Impressora com servidor e fila/compartilhamento cadastrados. API no Windows com PrintManagement e conta autorizada. Usa a identidade do processo.                         |
| TCP                   | Resposta de uma porta explicitamente informada no endereço cadastrado         | Não varre a rede. Porta sem resposta não comprova equipamento offline. Uma resposta não comprova funcionamento dos demais serviços.                                       |

A conta Windows temporária da descoberta manual do catálogo **não é guardada nem reaproveitada pelo worker**. As credenciais persistentes do cofre também são usadas somente pela descoberta manual; Monitorar e o worker continuam executando com a identidade do processo da API. A coleta automática precisa que a API execute sob uma identidade autorizada. O prompt UAC visto durante um atendimento pelo ISL continua sendo tratado na sessão remota. A senha de TI não é necessária para consultar presença pelo ISL.

## Comparação de impressão

A comparação exige servidor e compartilhamento da impressora esperada. O mesmo nome de fila em outro servidor não é aceito. Driver diferente do homologado gera atenção. Uma fila não vista fica sem confirmação: consultas CIM/DCOM e Execute como SYSTEM podem não enxergar as conexões do perfil interativo do funcionário.

Os relatórios **Impressoras e drivers** e **Conferir Spooler** da central de suporte também alimentam observações ao consultar seu resultado. O conteúdo bruto não é persistido no monitoramento. Execute continua dependendo de homologação e da senha de acesso ISL fornecida somente naquela operação.

Fila normal, driver correspondente ou TCP aberto não confirmam impressão física. Tinta/toner, sensores, contadores, SNMP e página de teste ainda não foram implementados. Reinício/limpeza de Spooler continuam manuais com confirmação; o monitoramento não faz reparos automáticos.

## Organização e operação

- `packages/contracts/src/monitoring.ts`: validação e contratos compartilhados.
- `apps/backend/src/modules/monitoring`: rotas, serviço, regras puras de saúde e repositório.
- `apps/backend/src/modules/monitoring/adapters`: leituras Windows e TCP. ISL e catálogo Windows reutilizam seus adaptadores.
- `apps/backend/src/shared/windows-powershell.ts`: execução de scripts locais fixos, timeout e stdin sem credenciais em argumentos.
- `apps/worker/src`: agendador que chama a API local; não implementa regras de negócio.
- `apps/frontend/src/features/monitoring`: painel e consultas paginadas. O polling não modifica layout ou histórico de desfazer.

`npm run dev` inicia API, interface e agendador. Se o sistema já estava aberto antes desta implementação, reinicie esse comando para incluir o worker. Para iniciar somente o worker, use `npm run dev:worker`.

O worker reserva até três equipamentos vencidos usando locks PostgreSQL e lease de 120 segundos. As fontes têm timeout; há no máximo três coletas simultâneas por lote e nenhuma sobreposição de ciclos no worker. Com lote cheio, busca o próximo após um segundo; sem pendências, aguarda quinze segundos. A periodicidade pode atrasar conforme volume e latência. Falhas não disparam manutenção.

Os resumos têm páginas de 100 equipamentos e atualização a cada quinze segundos. São mantidas até 200 observações por equipamento; o painel exibe as 20 mais recentes. Leituras envelhecem após três intervalos sem atualização, com mínimo de 90 segundos. Se a API falhar, o mapa sinaliza os dados anteriores como antigos. Uma fonte indisponível impede o resultado agregado de ficar totalmente verde.

## Validação na empresa

Comece com um computador piloto e uma impressora. Confirme os vínculos e faça leituras manuais das fontes permitidas. Confira a fila também no perfil do funcionário pelo ISL Light. Habilite o agendamento após validar o piloto. Consulte o [roteiro de teste](teste-empresa-20261026.md).

Referências: [Microsoft — New-CimSession](https://learn.microsoft.com/en-us/powershell/module/cimcmdlets/new-cimsession?view=powershell-5.1), [ISL — Execute](https://help.islonline.com/165993), [ISL — estados do computador](https://help.islonline.com/1250716).
