# Teste na empresa — 26/10/2026

As correções de interface, busca paginada e credenciais temporárias foram preparadas localmente. Autenticação no domínio, acesso ao servidor corporativo e prompts UAC precisam ser conferidos no ambiente da empresa. Nenhuma senha particular foi inserida em código ou configuração.

1. Inicie o Docker Desktop e execute `npm run dev` na raiz. Abra `http://127.0.0.1:3000`.
2. Selecione uma impressora e abra **Inventário**. A seta dos campos pesquisáveis deve estar dentro da caixa. Confira o menu, a busca e os botões de página quando houver mais de 20 opções. Valores manuais continuam permitidos.
3. Em **Suporte**, use a chave do operador já configurada e confira o servidor `SRV-SKY-PRT-01`. Clique em **Consultar servidor de impressão** primeiro com a conta Windows atual.
4. Se essa conta não tiver acesso, marque **Usar outra conta Windows somente nesta consulta** e informe uma conta autorizada, preferencialmente com domínio explícito. O campo da senha deve ficar vazio ao concluir ou falhar. A coleta só lista dados; não instala ou modifica filas.
5. Confira o horário da coleta, avisos de consultas parciais e a distinção entre **Consulta Windows**, **Documento fornecido** e **Inventário salvo**. Selecionar uma fila preenche um rascunho; confira antes de salvar.
6. Para um PC atendido no **ISL Light**, confirme o vínculo ao equipamento correto. Se abrir um PowerShell como administrador provocar um prompt UAC, informe a conta autorizada no prompt nativo. O Modo Administrativo do ISL permite interagir com a elevação conforme a configuração do Windows.
7. A **senha de acesso ISL AlwaysOn**, a **conta Windows/TI** e a **chave de operador do Infra Map** têm funções diferentes. A opção temporária de conta Windows do coletor não substitui nenhuma das outras nem dá elevação automática ao atendimento remoto.
8. A homologação de Execute continua separada. Comece por consultas de leitura em um PC de teste. Reinício/limpeza de Spooler e reinstalação de drivers exigem o procedimento já documentado, com confirmação de destino e impacto.
9. Posicione um computador e uma impressora, conecte seus pontos e salve. Confira a associação no Suporte. Essa ligação define a impressora esperada e não instala uma fila.
10. Em **Monitorar**, escolha uma fonte, salve com agendamento desligado e use **Coletar agora**. Confira fonte, horário, dados parciais e permissões. Para Windows e servidor de impressão, a API precisa executar sob uma conta autorizada; a credencial temporária de descoberta não é reutilizada.
11. Valide as filas também no perfil do funcionário. Depois de validar o piloto, habilite **Monitoramento automático** e confira o processo `monitor` iniciado por `npm run dev`.
12. Arraste os dispositivos: pontos e menu devem acompanhar antes de soltar o mouse. Confira os ícones em contorno dos nove tipos de dispositivo.

Detalhes de configuração e limites: [monitoramento e integração](monitoramento.md).

Se uma consulta falhar, anote o horário, o servidor e a mensagem apresentada. Os snapshots anteriores e os campos manuais permanecem disponíveis. Não envie senhas junto das evidências do teste.

Referências: [ISL — Administrative Mode](https://help.islonline.com/109823/3727558), [Microsoft — New-CimSession](https://learn.microsoft.com/en-us/powershell/module/cimcmdlets/new-cimsession?view=powershell-5.1).
