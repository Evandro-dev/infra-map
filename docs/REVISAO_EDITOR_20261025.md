# Infra Map — revisão do editor (25/10/2026)

Esta atualização foi construída a partir do ZIP atual do usuário, preservando a arquitetura existente de `apps/frontend`, `apps/backend` e PostgreSQL/Prisma.

## Interface

- Painel lateral direito com as abas **Propriedades**, **Camadas**, **Inventário** e **Suporte**. Inventário e Suporte aparecem apenas para equipamentos.
- Backend de inventário dividido em **rotas → serviço → repositório** e formulário com nome, IP, MAC, patrimônio, fabricante, modelo, serial e estado informado manualmente. Computadores possuem usuário, hostname e sistema operacional; impressoras possuem servidor, fila e driver homologado.
- O botão **Salvar cadastro** salva os campos diretamente no banco. O botão **Salvar mapa** (ícone na sidebar esquerda) salva posições, hierarquia e organização.
- Nomes editados diretamente no desenho (Enter para confirmar; Esc para cancelar; vazio não substitui o nome anterior).
- Camadas: seleção por hierarquia, visibilidade, bloqueio e ordenação para frente/trás. IDs permanecem internos e estáveis.

## Estrutura espacial

- Território movível independentemente da câmera. Arrastar a **grade** navega pelo canvas; arrastar o **território** desloca sua origem, preservando filhos e medidas. Ambas as operações mantêm zoom.
- Arrastar dispositivo para dentro de setor atualiza seu pai (reparenting) sem alterar a posição visível. Mover setor desloca seus filhos junto.
- Sobreposição de setores oferece três opções: **dentro**, **nível superior** ou **independente**. Níveis possuem conteúdos distintos.
- Remover um setor exclui seus descendentes; remover o território exclui seus elementos, com confirmação. Inventário órfão é limpo pela lógica do backend existente.
- A estrutura e as coordenadas relativas dos setores são validadas pelo backend antes do salvamento.

## Dados / Prisma

A migration `20261025020000_editor_inventory_upgrade` **somente adiciona colunas**; não remove tabelas, dispositivos ou mapas existentes. Adiciona origem do território, estado de visibilidade/bloqueio, ordem de camadas e campos técnicos ao cadastro.

## Atualização / execução

1. Faça backup do projeto e interrompa `npm run dev`.
2. Inicie o Docker Desktop (o PostgreSQL depende dele).
3. Execute `atualizar-infra-map-revisao.ps1`, fornecido separadamente, e confirme `SIM`.
4. O script faz backup dos arquivos modificados, aplica a migration, gera o Prisma Client e executa `npm run verify`.
5. Depois de passar, na raiz do projeto execute `npm run dev`.

O módulo ISL mantém as proteções originais e suas chaves `.env` existentes. **Nenhum acesso remoto foi habilitado automaticamente**. O status do inventário é manual e não equivale a uma verificação de rede em tempo real.

## Limitações da validação neste ambiente

Foram feitas verificações de sintaxe TypeScript/TSX e testes locais da lógica espacial (sem banco ou navegador). A validação final do `npm run verify` e as interações gráficas precisam ocorrer no Windows onde estão instalados Node 24 e Docker, pois o ambiente de geração não tem acesso ao registry npm nem ao Docker Desktop.
