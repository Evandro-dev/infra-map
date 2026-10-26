# Cadastro técnico de impressoras — Economart Pouso Alegre

**Última atualização:** 23/10/2026  
**Servidor de impressão observado:** `SRV-SKY-PRT-01`

> Os dados de rede abaixo foram conferidos nas filas do servidor e/ou em testes relatados. Onde há informação pendente, isso está explícito. Não usar dados inferidos como configuração definitiva.

## 1. RH — Epson WorkForce Pro WF-M5899

### Identificação e rede

| Campo                              | Valor                                      | Situação                                        |
| ---------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| Nome de cadastro sugerido          | `RH-EPSON-M5899-SKY`                       | Sugestão local                                  |
| Fabricante / modelo                | Epson WorkForce Pro WF-M5899               | Confirmado                                      |
| Tipo                               | Monocromática — preto e branco             | Especificação do fabricante                     |
| Local                              | RH; posição exata a confirmar              | Parcialmente confirmado                         |
| IP                                 | `192.168.27.202`                           | Confirmado                                      |
| MAC                                | `A4:D7:3C:77:9B:BA`                        | Lido no cadastro EpsonNet de outro PC funcional |
| Servidor                           | `SRV-SKY-PRT-01`                           | Confirmado                                      |
| Nome compartilhado                 | `ECO-POA-RHU-P01`                          | Confirmado                                      |
| Caminho de rede                    | `\\SRV-SKY-PRT-01\ECO-POA-RHU-P01`         | Confirmado                                      |
| Driver da fila no servidor         | `EPSON WF-M5899 Series`                    | Confirmado                                      |
| Porta indicada no servidor         | `192.168.27.202`                           | Confirmado                                      |
| Fila local WSD neste PC            | `RH-EPSON-M5899-WSD`                       | Observado                                       |
| Driver da fila WSD                 | `Microsoft IPP Class Driver`               | Observado                                       |
| Porta WSD                          | `WSD-4f7cfee6-a3a1-48a4-bc0f-0565a9e6d8f0` | Observado                                       |
| Status local mais recente relatado | `Normal`                                   | Após reinício do Spooler                        |

### Histórico relevante

- A fila compartilhada foi identificada como acesso à Epson do RH.
- A fila WSD local mostrou `PaperOut` mesmo quando a impressora conseguia imprimir.
- Após reiniciar o serviço de impressão do Windows (Spooler), o status da fila WSD voltou para `Normal`.
- A causa exata do estado `PaperOut` não foi confirmada.
- Em outro PC funcional, foi observado o monitor `EpsonNet Print Port`, com IP `192.168.27.202`, LPR `515`, nome de fila `ENPQueue` e MAC `A4:D7:3C:77:9B:BA`. Isso é uma configuração observada naquele PC, não necessariamente a configuração da fila compartilhada no servidor.

### Especificações do fabricante

- Impressora multifuncional monocromática: impressão, cópia, digitalização e fax.
- Até 34 páginas/minuto em preto, conforme modo e condições.
- Volume mensal recomendado de até 8.300 páginas.
- ADF para 50 folhas e duplex automático.
- Capacidade de até 1.830 folhas com bandejas opcionais/configuração adequada.
- Fonte oficial: https://epson.com.br/Para-empresas/Impressoras/Impressoras-a-Jato-de-Tinta/Impressora-Multifuncional-Monocrom%C3%A1tica-WorkForce-Pro-WF-M5899/p/C11CK76301

### Dados ainda necessários

- Número de série da impressora principal.
- Etiqueta patrimonial da impressora principal.
- Posição física exata.
- Número e tipo das bandejas realmente instaladas.
- Protocolo/porta exatos configurados na fila do servidor.

---

## 2. Impressora colorida — Epson WorkForce Pro WF-C878R

### Identificação e rede

| Campo                                      | Valor                                       | Situação                                         |
| ------------------------------------------ | ------------------------------------------- | ------------------------------------------------ |
| Nome de cadastro sugerido                  | `POA-EPSON-WFC878R-COLOR`                   | Sugestão para o sistema local                    |
| Nome da fila compartilhada                 | `ECO-POA-PLC-P01`                           | Confirmado                                       |
| Fabricante / modelo                        | Epson WorkForce Pro WF-C878R                | Etiqueta e cadastro do servidor correspondem     |
| Modelo/regulatório na etiqueta fotografada | `C524A`                                     | Transcrição da etiqueta; confirmar se necessário |
| Tipo                                       | Colorida e preto e branco                   | Confirmado por modelo/função                     |
| Local                                      | Ao lado da sala; posição exata a confirmar  | Informado pelo usuário                           |
| IP                                         | `192.168.27.201`                            | Confirmado no cadastro do servidor               |
| MAC                                        | Pendente                                    | Não coletado                                     |
| Servidor                                   | `SRV-SKY-PRT-01`                            | Confirmado                                       |
| Caminho de rede                            | `\\SRV-SKY-PRT-01\ECO-POA-PLC-P01`          | Confirmado                                       |
| Driver da fila no servidor                 | `EPSON WF-C878R Series`                     | Confirmado                                       |
| Porta indicada no servidor                 | `192.168.27.201`                            | Confirmado                                       |
| Status atual                               | Não consultado diretamente                  | Pendente                                         |
| Fila instalada neste PC                    | Não; foi feito teste via fila compartilhada | Confirmado na ocasião do teste                   |

### Teste comprovado

Em 23/10/2026, foi solicitada uma página de teste pela fila `\\SRV-SKY-PRT-01\ECO-POA-PLC-P01` sem adicionar a impressora ao computador. A folha saiu na impressora colorida física ao lado da sala.

Comando usado:

```powershell
rundll32 printui.dll,PrintUIEntry /k /n "\\SRV-SKY-PRT-01\ECO-POA-PLC-P01"
```

### Especificações do fabricante

- Impressora multifuncional colorida com 4 cores (CMYK): impressão, cópia, digitalização e fax.
- Velocidade ISO publicada: 25 ppm em preto / 24 ppm em cores, simplex.
- Resolução máxima publicada: 4800 × 1200 dpi.
- Duplex automático.
- Capacidade de até 1.835 folhas com bandejas adicionais.
- Impressão em formatos até 33 × 48 cm conforme especificação do fabricante.
- Fonte oficial: https://epson.com.br/Para-empresas/Impressoras/Impressoras-a-Jato-de-Tinta/Impressora-Multifuncional-WorkForce-Pro-WF-C878R/p/C11CH60301

### Acessório de gavetas identificado

A etiqueta fotografada na unidade de gavetas opcional mostrava os códigos `C522AC1` e `PXA3CU2`. Esses códigos devem ficar cadastrados como informação do acessório, não como número de série ou modelo principal da impressora.

### Dados ainda necessários

- Número de série da impressora principal.
- Etiqueta patrimonial da impressora principal.
- MAC address.
- Número/tipo de bandejas instaladas.
- Status atual de tinta, papel e fila.

---

## 3. Roteiro padrão para registrar um incidente

1. **Identificar:** nome da fila, modelo, IP, localização e computador/setor afetado.
2. **Descrever o sintoma:** texto exato do erro, quando começou, se é em uma ou várias máquinas e se todos os trabalhos falham.
3. **Verificar a impressora física:** ligada/conectada, mensagem do painel, bandeja e tamanho do papel, tinta/consumíveis.
4. **Verificar o Windows:** fila selecionada, driver, porta, status e trabalhos pendentes.
5. **Testar com cuidado:** conexão ao equipamento ou servidor conforme as regras de TI; página de teste só depois de conferir a impressora de destino.
6. **Escalar com evidências:** incluir horário, impacto, dados técnicos, foto sem dados pessoais desnecessários, verificações feitas e número de chamado.

### Cuidados operacionais

- Não confundir IP da impressora, nome da fila no servidor e nome local no Windows.
- Não alterar nem renomear filas no servidor sem autorização.
- Não remover filas WSD/compartilhadas sem conferir se alguém depende delas.
- Antes de reiniciar o Spooler, verificar se há trabalhos pendentes importantes.
- A sigla `PLC` aparece no nome da fila colorida, mas seu significado interno não foi confirmado.
