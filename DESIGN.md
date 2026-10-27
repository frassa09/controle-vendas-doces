---
name: Controle de Vendas de Doces
description: O cantinho do cliente na loja, um quartinho isométrico cuja estante é a cartela de pontos.
colors:
  loja: "#D6336C"
  loja-forte: "#9F234C"
  loja-forte-hover: "#851C3F"
  loja-suave: "#FEE5E9"
  parede: "#FFE0E9"
  parede-sombra: "#FFCEDA"
  parede-desenho: "#FFB6C8"
  parede-desenho-forte: "#FA98AE"
  cacau: "#4A2E22"
  cacau-2: "#6E4E40"
  menta: "#CFE8DC"
  menta-2: "#A8D2BE"
  rosa: "#F7DEE5"
  madeira: "#E6C196"
  madeira-2: "#C38F5D"
  papel: "#FFFEFB"
  campo: "#FFFFFF"
  brownie: "#5A3020"
  brownie-topo: "#7B4429"
  sucesso: "#2F7D57"
typography:
  display:
    fontFamily: "Caprasimo, Georgia, serif"
    fontSize: "clamp(30px, 8.6vw, 38px)"
    fontWeight: 400
    lineHeight: 1.1
  display-valor:
    fontFamily: "Caprasimo, Georgia, serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1.1
    fontFeature: "tnum"
  headline:
    fontFamily: "Caprasimo, Georgia, serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.1
  headline-folha:
    fontFamily: "Caprasimo, Georgia, serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.1
  contador:
    fontFamily: "Caprasimo, Georgia, serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.1
    fontFeature: "tnum"
  lead:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label-botao:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1.2
  label:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.45
rounded:
  papel-colado: "6px"
  caixinha: "10px"
  icone: "12px"
  campo: "14px"
  botao: "16px"
  cartao: "18px"
  folha: "26px"
  redondo: "50%"
spacing:
  xs: "4px"
  sm: "6px"
  gap: "10px"
  md: "14px"
  margem: "16px"
  folha: "20px"
  secao: "28px"
  fim: "40px"
components:
  button-primary:
    backgroundColor: "{colors.loja-forte}"
    textColor: "{colors.campo}"
    typography: "{typography.label-botao}"
    rounded: "{rounded.botao}"
    padding: "12px 18px"
    height: "56px"
  button-primary-hover:
    backgroundColor: "{colors.loja-forte-hover}"
    textColor: "{colors.campo}"
  button-secondary:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.cacau}"
    typography: "{typography.label-botao}"
    rounded: "{rounded.botao}"
    padding: "12px 18px"
    height: "56px"
  button-secondary-hover:
    backgroundColor: "{colors.campo}"
  button-disabled:
    backgroundColor: "{colors.parede}"
    textColor: "{colors.cacau-2}"
  contador-placar:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.cacau}"
    typography: "{typography.contador}"
    rounded: "{rounded.cartao}"
    padding: "6px 14px 6px 6px"
  chip-saldo:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.cacau}"
    rounded: "{rounded.campo}"
    padding: "4px"
  bilhete:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.cacau}"
    rounded: "{rounded.papel-colado}"
    padding: "22px 18px 18px"
  cupom:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.cacau}"
    rounded: "{rounded.cartao}"
    padding: "14px 16px"
  recados:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.cacau}"
    rounded: "{rounded.cartao}"
    padding: "14px 16px"
  recado-icone:
    backgroundColor: "{colors.loja-suave}"
    textColor: "{colors.loja-forte}"
    rounded: "{rounded.icone}"
    size: "36px"
  folha:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.cacau}"
    rounded: "{rounded.folha}"
    padding: "12px 20px 22px"
  formato-radio:
    backgroundColor: "{colors.campo}"
    textColor: "{colors.cacau}"
    rounded: "{rounded.botao}"
    padding: "12px"
  campo-pin:
    backgroundColor: "{colors.campo}"
    textColor: "{colors.cacau}"
    rounded: "{rounded.campo}"
    height: "60px"
  casa-raspar:
    backgroundColor: "{colors.campo}"
    rounded: "{rounded.campo}"
  escolha:
    backgroundColor: "{colors.campo}"
    textColor: "{colors.cacau}"
    rounded: "{rounded.campo}"
    padding: "8px 14px"
    height: "56px"
  aviso:
    backgroundColor: "{colors.cacau}"
    textColor: "{colors.campo}"
    rounded: "{rounded.campo}"
    padding: "12px 18px"
---

# Design System: Controle de Vendas de Doces

## Overview

**Creative North Star: "O Cantinho na Loja"**

Cada cliente tem um quartinho isométrico dentro da loja. A parede é de papel de parede pastel, tingido da cor da loja e estampado com brownies e brigadeiros miúdos; o piso é xadrez menta e rosa-claro; a moldura e a estante são de madeira clara. Os números da relação com a loja moram em objetos do quarto: a estante de 2 prateleiras com 5 vagas cada é a cartela de pontos, a caixa de presente no chão é a raspadinha, e o bilhete preso na geladeira é o que ficou em aberto. Nada é arrumado pelo cliente: o quarto reflete o estado real.

A página inteira está dentro desse mundo. O fundo é sempre a parede (nunca creme, nunca branco liso), o texto é cacau, e tudo o que é objeto vira um adesivo com contorno macio cacau (1.5px). As superfícies de leitura são pedaços de papel quase branco apoiados na parede: placar, bilhete com fita, cupom, lista de recadinhos e a folha que sobe de baixo. A densidade é de celular, uma coluna, alvos grandes (56px), e o tom é carinhoso e caseiro, não de cassino nem de banco.

A cor da loja é variável. O sistema não guarda uma paleta, guarda uma receita: a partir de `--loja` deriva todos os tons tingidos, com travas que garantem legibilidade e uma parede que nunca desbota. O mundo foi testado com sete cores de loja e precisa continuar funcionando com qualquer uma.

**Key Characteristics:**
- Quarto isométrico em SVG como primeira dobra (cerca de 55% da altura), estante 2x5 como cartela.
- Cor da loja como semente única; todos os tons tingidos derivados por `color-mix` em oklab e cor relativa em oklch.
- Objetos-adesivo: preenchimento chapado, contorno cacau 1.5px, sem gradiente.
- Display Caprasimo para títulos e números; Nunito para todo o resto.
- Contadores em caixinha de borda dupla (anel madeira-2 por fora, borda madeira por dentro).
- Movimento com mola amortecida; respeita `prefers-reduced-motion`.

### Segunda superfície: app Android da loja (orientação, ainda não construído)

O app da loja (Expo / React Native, Material 3) herda este mundo pelo tema, não pela cena. Orientação a seguir quando ele for construído: usar `--loja` como cor-semente do esquema dinâmico do Material 3; reaproveitar cacau como cor de texto sobre superfícies claras e a madeira como contorno; Caprasimo apenas nos papéis de display (títulos de tela, números grandes como saldo e total da venda), nunca em rótulos, campos ou listas; corpo em Roboto conforme a orientação da plataforma, ou Nunito se a loja quiser continuidade com a página do cliente. O quartinho isométrico é exclusivo da página do cliente; o app é ferramenta de balcão e prioriza velocidade. Nada disto está construído; trate como direção, não como token.

## Colors

Uma semente variável da loja, tons de parede derivados dela, e um conjunto fixo de materiais (cacau, madeira, menta, rosa, papel) que mantém o quarto igual em qualquer loja.

### Primary
- **Cor da Loja** (`loja`, padrão #D6336C, framboesa): a semente configurada pela loja. Usada crua apenas em objetos-adesivo: papel de presente listrado da caixa e das casinhas de raspar, forminha do brigadeiro, tampa do pote, alfinete do bilhete, detalhe tracejado da placa e do tapete. Nunca como fundo de texto.
- **Loja Forte** (`loja-forte`): a versão de texto e ação. Receita: `oklch(from color-mix(in oklab, var(--loja) 76%, #2a1410) min(l, .47) c h)`. Mistura a semente com cacau quase preto e trava a luminosidade em no máximo 0.47, para que texto branco sobre ela passe de 6.5:1 com qualquer cor de loja. Usada no botão principal, no título "Cantinho de...", no valor em aberto, no resultado da raspadinha, no anel de foco, na seleção de formato, nas vagas tracejadas da estante e na tampa da caixa de presente.
- **Loja Forte Hover** (`loja-forte-hover`): `color-mix(in oklab, var(--loja-forte) 88%, #000)`, só no hover do botão principal.
- **Loja Suave** (`loja-suave`): `color-mix(in oklab, var(--loja) 14%, #fff)`. Fundo do ícone dos recadinhos, botão de fechar da folha, anel interno do cupom e halo de foco do PIN.

### Secondary
- **Parede** (`parede`): `oklch(from color-mix(in oklab, var(--loja) 13%, #fff) l max(c, .05) h)`. O fundo da página e da parede direita do quarto.
- **Parede na Sombra** (`parede-sombra`): mistura de 22% com croma mínimo 0.07. Parede esquerda do quarto e fundo das prateleiras.
- **Desenho da Parede** (`parede-desenho`): mistura de 34% com croma mínimo 0.1. Os motivos do papel de parede da página (brownie e brigadeiro em máscara SVG de 64px, opacidade 0.55).
- **Desenho Forte** (`parede-desenho-forte`): mistura de 52%, luminosidade no máximo 0.8, croma mínimo 0.12. Os motivos do papel de parede dentro do quarto (ladrilho de 40px).

Os valores hex no frontmatter são a resolução da cor padrão #D6336C; a receita é o que vale. Cores de loja testadas, todas com texto branco sobre `loja-forte` entre 6.5:1 e 7.8:1 e `loja-forte` sobre a parede acima de 5.6:1: #D6336C framboesa, #E8590C laranja, #2B8A3E verde, #1971C2 azul, #7048E8 roxo, #8B5A3C caramelo, #F2C94C amarelo.

### Tertiary
- **Menta** (#CFE8DC) e **Rosa-claro** (#F7DEE5): o xadrez do piso, fixos em qualquer loja.
- **Menta Escura** (`menta-2`): a fita adesiva do bilhete, a 70% de opacidade.
- **Brownie** e **Topo do Brownie**: o corpo e a cobertura dos doces desenhados (brownie, brigadeiro, camada do bolo de pote).
- **Sucesso** (#2F7D57): ganho de pontos ("+2 doces na estante", o "+1" que sobe na estante) e a plantinha do vaso.

### Neutral
- **Cacau** (#4A2E22): todo o texto principal, todos os contornos de objeto, o aviso (toast) e a base das sombras.
- **Cacau Claro** (`cacau-2`): texto de apoio (subtítulos, datas, descrições, itens do bilhete), 7.4:1 sobre papel.
- **Madeira Clara** (`madeira`): moldura da estante, rodapé do quarto, bordas internas das caixinhas, divisórias tracejadas, alça da folha.
- **Madeira Escura** (`madeira-2`): anel externo das caixinhas e do botão secundário, prateleiras, borda do piso, borda do PIN.
- **Papel** (#FFFEFB): superfície de leitura apoiada na parede (placar, bilhete, cupom, recadinhos, folha).
- **Campo** (#FFFFFF): o branco puro de dentro da folha, reservado a campos e escolhas tocáveis (cartão de formato, PIN, casinha de raspar, opção de doce), para que se destaquem do papel.

### Named Rules
**The Receita, Não Paleta Rule.** Nenhum tom tingido pela loja é escrito em hex no código; todos derivam de `--loja` pelas receitas acima. Trocar a semente tem que retingir parede, motivos, ações e objetos de uma vez.

**The Parede Nunca Desbota Rule.** Os tons de parede têm croma mínimo (0.05, 0.07, 0.1, 0.12). Mesmo uma loja amarela ou caramelo ganha uma parede com cor, nunca creme.

**The Cor Crua Veste Objetos Rule.** A semente `loja` sem trava só aparece em objetos ilustrados. Texto, botão e foco usam `loja-forte`.

## Typography

**Display Font:** Caprasimo (com Georgia, serif), auto-hospedada, peso 400.
**Body Font:** Nunito (com system-ui, sans-serif), auto-hospedada, eixo de peso 400 a 800.

**Character:** Caprasimo é gorducha, arredondada e de confeitaria, lida como letreiro de doceria; Nunito é redonda e amigável, e carrega o peso (600 a 800) que a hierarquia precisa sem trocar de família.

### Hierarchy
- **Display** (400, clamp(30px, 8.6vw, 38px), 1.1): o nome do cantinho ("Cantinho da Júlia"), em `loja-forte`, centralizado, com `text-wrap: balance`.
- **Display Valor** (400, 40px, 1.1, algarismos tabulares): o valor em aberto no bilhete.
- **Headline** (400, 24px, 1.1): títulos de seção ("Seus prêmios", "Recadinhos da loja"); 22px no título do bilhete; 26px no título da folha e no resultado da raspadinha.
- **Contador** (400, 26px no placar, 22px no saldo do topo, 32px com espaçamento 0.5em no PIN): números em Caprasimo com algarismos tabulares.
- **Lead** (600, 17px): a frase sob o título ("Mais 3 doces na estante...").
- **Body** (400, 16px, 1.45): texto corrido; títulos de item em 700 a 800.
- **Label de botão** (800, 17px; 16px nos botões em par): rótulos de ação, com linha de apoio em 700, 14px.
- **Label** (600 a 700, 14px; datas em 700, 13px): descrições, notas e metadados, em `cacau-2`.

### Named Rules
**The Caprasimo Só Fala Alto Rule.** Caprasimo é para títulos e números de destaque. Rótulos, botões, listas e frases ficam em Nunito.

**The Número Tabular Rule.** Todo número que muda (pontos, placar, valores) usa algarismos tabulares, para não pular quando atualiza.

## Layout

Coluna única centralizada de no máximo 440px, margens laterais de 16px, topo respeitando a área segura e 40px de respiro no fim. Não há breakpoints: a página é desenhada a 390px e só centraliza em telas maiores. A primeira dobra é placa da loja e saldo no topo, o quarto isométrico em SVG (viewBox 360 x 340, sangrando 6px para cada lado), o título, o placar e as ações. As ações formam uma grade de 2 colunas com 10px de vão: a ação principal ocupa a linha inteira, as duas secundárias ficam lado a lado com ícone empilhado sobre o rótulo. Seções seguintes ficam a 28px umas das outras, com título a 10px do conteúdo. O ritmo interno é de 4 a 16px (4, 6, 10, 12, 14, 16), com 18 a 22px no papel do bilhete e 20px nas laterais da folha.

## Elevation & Depth

Profundidade vem de duas fontes: a projeção isométrica do quarto (paredes em tom de parede e parede na sombra, piso com borda de madeira, uma elipse cacau a 10% como sombra no chão) e sombras macias tingidas de cacau sob os papéis apoiados na parede. Não há sombra cinza nem sombra dura deslocada; tudo puxa para o marrom do cacau. Contornos de caixinha são anéis de `box-shadow` sem desfoque, não elevação.

### Shadow Vocabulary
- **Apoio** (`box-shadow: 0 6px 18px -8px color-mix(in oklab, var(--cacau) 45%, transparent)`): placar, saldo, cupom e recadinhos.
- **Papel Colado** (`box-shadow: 0 10px 22px -12px color-mix(in oklab, var(--cacau) 55%, transparent)`): o bilhete, que também gira -0.6deg.
- **Brilho da Ação** (`box-shadow: 0 8px 18px -8px var(--loja-forte)`): só o botão principal, tingido da cor da loja.
- **Folha** (`box-shadow: 0 -12px 40px -12px color-mix(in oklab, var(--cacau) 60%, transparent)`): a folha que sobe de baixo, com fundo atrás em cacau a 45%.

### Named Rules
**The Sombra de Cacau Rule.** Toda sombra é cacau (ou `loja-forte`, no botão principal) com espalhamento negativo, macia e curta. Nada de preto puro.

## Shapes

Cantos generosos e redondos, coerentes com Caprasimo e com os doces: 18px nos cartões, 16px nos botões e cartões de formato, 14px em campos, casinhas e aviso, 10 a 12px em caixinhas internas e ícones, 26px no topo da folha. O papel colado (bilhete) é a exceção de propósito: 6px e levemente torto. Bordas são anéis de 1.5px em madeira; a borda dupla (anel externo `madeira-2` mais borda interna `madeira` numa caixinha) marca contadores. Tracejado é material nativo do mundo: vagas vazias da estante, divisórias entre itens do bilhete e dos recadinhos, moldura da placa, tapete e casinhas vazias. Objetos ilustrados usam contorno cacau 1.5px com junção arredondada.

## Components

### Buttons
Táteis e gordinhos, com mola ao apertar.
- **Shape:** cantos arredondados (16px), altura mínima de 56px, ícone de traço de 22px.
- **Primary:** fundo `loja-forte`, texto branco, 800 a 17px, brilho tingido da cor da loja. Só uma ação principal por vez: pagar o que está em aberto; se não há dívida e a estante está cheia, trocar vira a principal.
- **Hover / Focus / Active:** hover escurece para `loja-forte-hover`; foco é anel de 3px em `loja-forte` com afastamento de 3px; ao apertar, encolhe para 0.97 com a curva de mola em 0.2s.
- **Secondary:** fundo papel, texto cacau, anel de 1.5px em `madeira-2`; hover vai para branco puro.
- **Disabled:** fundo papel misturado com a parede, texto `cacau-2`, anel em `madeira`; não encolhe ao apertar. A linha de apoio diz quanto falta ("faltam 3").

### Chips
- **Saldo do topo:** pílula de papel (14px) com anel `madeira-2` e sombra de apoio; o número fica numa caixinha interna de borda `madeira` (10px) em Caprasimo 22px, seguido de "pontos" em 700.

### Cards / Containers
- **Placar:** papel, 18px, anel `madeira-2`, número "7 de 10" em caixinha de borda dupla, frase de quanto falta e validade dos pontos em `cacau-2`.
- **Bilhete (dívida):** papel, 6px, girado -0.6deg, fita menta no topo (84 x 22px, girada 2deg), valor em Display Valor, itens separados por tracejado `madeira`, botão secundário de copiar Pix e nota explicando que os doces vão pra estante quando o pagamento cair.
- **Cupom:** papel, 18px, anel duplo (2px `loja-suave` mais 3.5px `madeira`), ilustração do doce a 52px, título em 700 e instrução em `cacau-2`.
- **Recadinhos:** lista em papel, 18px, linhas com ícone em quadradinho `loja-suave` (36px, 12px de canto, traço em `loja-forte`), título, linha de apoio e data à direita; divisórias tracejadas. Ganhos em `sucesso`.

### Inputs / Fields
- **PIN:** branco puro, 60px de altura, 14px de canto, borda de 2px em `madeira-2`, Caprasimo 32px espaçada 0.5em, centralizada, cursor em `loja-forte`.
- **Focus:** borda vira `loja-forte` com halo de 4px em `loja-suave`.
- **Error:** mensagem em 700, 14px, abaixo do campo, num espaço reservado de 22px para não empurrar o layout.

### Navigation
Não há navegação: a página é uma rolagem única. O quarto é navegável por objetos tocáveis (geladeira leva ao bilhete, caixa de presente abre a raspadinha), com papel de botão, foco por teclado e contorno de foco em `loja-forte`.

### Quarto Isométrico (assinatura)
Cena SVG com piso xadrez em projeção 2:1, duas paredes com papel de parede de motivos, placa da loja pendurada com o nome em Caprasimo e `loja-forte`, janela, vaso, geladeira e caixa de presente. A estante 2x5 desenha brownies nas vagas preenchidas e retângulos tracejados em `loja-forte` nas vazias; pontos além de 10 aparecem como "+N guardados". O doce mais novo cai na estante com mola (0.9s, atraso de 0.5s) e um "+1" em `sucesso` sobe e some. A tampa da caixa de presente levanta 4px no hover e no foco.

### Folha (raspar e trocar)
Diálogo modal ancorado embaixo, até 440px, 92% da altura, papel com topo de 26px, alça de madeira (44 x 5px), título em headline de 26px e botão de fechar redondo em `loja-suave` (44px). Sobe com 0.45s na curva de saída. Na raspadinha: dois cartões de formato (rádio) em branco puro com anel `madeira`, selecionado com anel de 3px em `loja-forte`, cada um mostrando a miniatura do papel de presente; a frase "Os dois jeitos têm a mesma chance."; o campo de PIN; e o botão principal que diz o custo.

### Casinhas de Raspar
Quadrados brancos (14px de canto, anel `madeira`) com o resultado por baixo e um canvas por cima pintado com a cor crua da loja, listras brancas a 32% em diagonal e um círculo branco no centro. O dedo apaga em círculos; após 14 toques a cobertura some em 0.4s. "Revelar tudo" é sempre oferecido como secundário. Casinha vazia mostra um círculo tracejado em `madeira-2`.

### Estados da página inteira
Abrindo, link não encontrado e sem conexão ficam fora do quarto, centralizados na parede: o brigadeiro balançando ("Abrindo seu cantinho…"), ou a geladeira com um bilhete em branco, título em Display `loja-forte` e uma frase em `cacau-2`. O link não encontrado não mostra nada da loja (usa a cor padrão); sem conexão oferece "Tentar de novo" como ação principal. Na primeira visita a estante se enche doce a doce; nas seguintes, só os doces novos caem e o "+N" aparece. "+N guardados" fica no rodapé de madeira, à direita do vaso.

### Aviso
Pílula cacau com texto branco em 700, 14px de canto, fixa a 24px do fundo; entra subindo 20px com a curva de saída e some após 2.6s.

## Do's and Don'ts

### Do:
- **Do** derivar todo tom tingido de `--loja` pelas receitas de `loja-forte`, `loja-suave` e parede, e testar qualquer mudança com as sete cores de loja registradas, incluindo amarelo #F2C94C e caramelo #8B5A3C.
- **Do** usar a parede como fundo da página inteira, com o papel de parede de doces miúdos por cima.
- **Do** desenhar objetos como adesivos: preenchimento chapado, contorno cacau 1.5px, junção arredondada.
- **Do** colocar contadores em caixinha de borda dupla (anel `madeira-2`, borda interna `madeira`) com Caprasimo e algarismos tabulares.
- **Do** usar o tracejado para o que ainda falta ou para separar itens (vagas vazias, divisórias, casinha vazia).
- **Do** manter alvos de toque com no mínimo 44px e ações com 56px.
- **Do** usar a mola `cubic-bezier(.34, 1.56, .64, 1)` para assentar e levantar, a curva de saída `cubic-bezier(.16, 1, .3, 1)` para entrar e sumir, e zerar animações sob `prefers-reduced-motion`.

### Don't:
- **Don't** pôr texto branco sobre a cor crua da loja; texto branco vai sempre sobre `loja-forte`.
- **Don't** usar fundo creme ou branco liso na página; o branco é dos papéis e campos, não do chão.
- **Don't** voltar à cartela de círculos sobre fundo branco; os pontos são doces numa estante.
- **Don't** usar sombra preta ou cinza; sombras são de cacau.
- **Don't** usar Caprasimo em rótulos, botões, listas ou texto corrido.
- **Don't** dar ao quarto cara de cassino (luzes piscando, contagem regressiva, moedas) ou de banco (cinza, tabela fria).
- **Don't** herdar o painel "Controles do protótipo" (seletor de cores, botões de simulação, borda tracejada cacau) como componente; é andaime do protótipo.
