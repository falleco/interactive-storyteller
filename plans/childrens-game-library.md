# Biblioteca de jogos infantis

Plano inicial para uma biblioteca de jogos infantis dentro do Wonder Tales, voltada para criancas de 3 a 10 anos. A ideia e que cada jogo seja pequeno, reutilizavel, serializavel e facil de encaixar dentro de fluxos de historias.

## Principios

- Jogos devem funcionar como blocos de historia: uma pagina pode chamar um jogo, receber resultado e continuar a narrativa.
- A dificuldade deve escalar por idade mudando quantidade de itens, tempo, vocabulario, numero de escolhas e complexidade visual.
- Regras, validacao, seed data, pontuacao e contratos devem ficar em modulos TypeScript puros, reutilizaveis pela API e pelo futuro builder.
- UI mobile deve viver em `apps/mobile/src/features/games/<game-id>/`.
- Contratos serializaveis devem viver em `packages/shared` ou em um futuro pacote puro como `packages/games`.
- Usar Skia para brilho, rastros, particulas, mascaras, shaders simples e preenchimentos.
- Usar Reanimated para drag-and-drop, spring, flip, pulse, transicoes e gestos continuos.
- Manter dimensoes estaveis para tabuleiros, tiles, botoes, contadores e canvases.

## MVP recomendado

1. Caca aos objetos
2. Liga os pares
3. Memoria magica
4. Quebra-cabeca simples
5. Conta e toca
6. Desenha o caminho
7. Escolhe o caminho

Esse conjunto cobre toque, drag-and-drop, pareamento, memoria, contagem e narrativa sem exigir uma engine grande logo no inicio.

## Ideias de jogos

### 1. Caca aos objetos

Crianca toca nos objetos pedidos pela narracao, por exemplo: "Encontra a estrela azul".

- Componentes basicos: cena/imagem, objetos tocaveis, contador, estado de acerto.
- Animacoes: brilho Skia em volta do item, particulas ao acertar, tremidinha ao errar.
- Idades: 3 a 8 anos.

### 2. Liga os pares

Associar animal com sombra, numero com quantidade, letra com som ou personagem com objeto.

- Componentes basicos: cards, linhas desenhadas, estado de pareamento.
- Animacoes: linha Skia seguindo o dedo, cards pulando quando pareados, brilho no par correto.
- Idades: 4 a 9 anos.

### 3. Quebra-cabeca simples

Montar uma imagem da historia em 4, 6, 9 ou 12 pecas.

- Componentes basicos: grid, pecas arrastaveis, slots.
- Animacoes: snap com spring, brilho ao encaixar, confete leve no final.
- Idades: 3 a 10 anos.

### 4. Memoria magica

Jogo da memoria com personagens, objetos, cores, formas ou palavras da historia.

- Componentes basicos: cards viraveis, pares, contador de tentativas.
- Animacoes: flip com Reanimated, aura Skia nos pares encontrados.
- Idades: 4 a 10 anos.

### 5. Escolhe o caminho

Mini-decisao narrativa: "Por onde o heroi deve ir?".

- Componentes basicos: 2 ou 3 opcoes grandes, resultado narrativo, proxima cena.
- Animacoes: caminho escolhido se ilumina, transicao liquida para a proxima cena.
- Idades: 3 a 10 anos.

### 6. Ordena a historia

Colocar cenas em ordem: comeco, meio e fim.

- Componentes basicos: cards de cenas, slots, validacao de ordem.
- Animacoes: arrastar com spring, slot acende quando correto.
- Idades: 5 a 10 anos.

### 7. Conta e toca

Responder a comandos como "Toca em 5 macas" ou "Quantos peixes ha no lago?".

- Componentes basicos: objetos repetidos, contador visual, feedback de acerto.
- Animacoes: objeto cresce ou desaparece ao toque, numero anima como marcador.
- Idades: 3 a 7 anos.

### 8. Desenha o caminho

Guiar um personagem por uma trilha sem sair do caminho.

- Componentes basicos: Canvas, path, personagem, zona inicial e final.
- Animacoes: rastro Skia seguindo o dedo, personagem deslizando pela linha.
- Idades: 4 a 9 anos.

### 9. Sons dos animais

Ouvir um som e escolher o animal correto.

- Componentes basicos: botao de audio, cards de resposta, placar simples.
- Animacoes: ondas sonoras Skia, card correto respirando suavemente.
- Idades: 3 a 7 anos.

### 10. Alimenta o personagem

Arrastar a comida certa para o personagem.

- Componentes basicos: personagem, itens arrastaveis, zona de drop.
- Animacoes: boca abre, item segue o dedo, reacao feliz ou triste.
- Idades: 3 a 8 anos.

### 11. Pinta a cena

Colorir partes de uma ilustracao simples.

- Componentes basicos: paleta, areas tocaveis, Canvas.
- Animacoes: preenchimento liquido Skia, gotas de tinta, preview de cor.
- Idades: 3 a 10 anos.

### 12. Constroi o monstro amigo

Escolher olhos, boca, bracos, acessorios e cores para montar um personagem.

- Componentes basicos: camadas de imagem ou Skia, carrossel de pecas, preview.
- Animacoes: pecas entrando com bounce, personagem reagindo ao toque.
- Idades: 4 a 10 anos.

### 13. Ritmo das estrelas

Tocar estrelas no tempo certo, como um mini jogo musical.

- Componentes basicos: trilha, estrelas/botoes, barra de timing, pontuacao.
- Animacoes: circulos pulsantes, ondas Skia no acerto.
- Idades: 5 a 10 anos.

### 14. Sombra misteriosa

Mostrar uma silhueta e escolher o objeto ou personagem correspondente.

- Componentes basicos: sombra, opcoes, revelacao.
- Animacoes: sombra se revela com mascara Skia ao acertar.
- Idades: 3 a 8 anos.

### 15. Labirinto do dedo

Levar um personagem ate o objetivo passando por um labirinto simples.

- Componentes basicos: labirinto fixo, ponto arrastavel, objetivo.
- Animacoes: rastro colorido, paredes vibram ao encostar.
- Idades: 4 a 10 anos.

### 16. Classifica por cores ou formas

Arrastar itens para cestos: vermelho, azul, circulo, triangulo.

- Componentes basicos: buckets, itens, validacao por categoria.
- Animacoes: cesto "engole" o item, particulas da cor correta.
- Idades: 3 a 7 anos.

### 17. Cuida do jardim

Plantar sementes, regar e ver crescer.

- Componentes basicos: slots de planta, ferramenta de regar, fases de crescimento.
- Animacoes: crescimento com escala, gotas Skia, folhas balancando.
- Idades: 3 a 8 anos.

### 18. Palavra que falta

Completar uma frase da historia com imagem ou palavra.

- Componentes basicos: frase, lacuna, opcoes, validacao.
- Animacoes: palavra encaixa no texto, destaque narrado.
- Idades: 6 a 10 anos.

### 19. Soletra com blocos

Arrastar letras para formar uma palavra curta.

- Componentes basicos: blocos de letras, slots, imagem de referencia.
- Animacoes: bloco pula no slot, palavra brilha ao completar.
- Idades: 5 a 10 anos.

### 20. Mini batalha de gentileza

Personagem enfrenta um problema escolhendo acoes positivas: ajudar, partilhar, pedir desculpa.

- Componentes basicos: cartas de acao, personagem, resultado narrativo.
- Animacoes: emocao do personagem muda, coracoes ou estrelas Skia no feedback.
- Idades: 4 a 10 anos.

## Modelo conceitual

Cada jogo deve poder ser descrito por um contrato serializavel:

```ts
type StoryGameDescriptor = {
  id: string;
  type: string;
  title: string;
  ageRange: {
    min: number;
    max: number;
  };
  prompt: string;
  config: Record<string, unknown>;
  successOutcome?: StoryGameOutcome;
  failureOutcome?: StoryGameOutcome;
};

type StoryGameOutcome = {
  narration?: string;
  nextSlideId?: string;
  scoreDelta?: number;
};
```

## Ordem sugerida de implementacao

1. Definir `StoryGameDescriptor` e tipos de resultado.
2. Criar um registry de jogos no mobile.
3. Implementar `Caca aos objetos` como primeiro jogo vertical completo.
4. Adicionar suporte do book player para slides do tipo `game`.
5. Implementar `Liga os pares` e `Conta e toca` reutilizando componentes do primeiro jogo.
6. Criar fixtures para testes e previews.
7. Evoluir para jogos com drag-and-drop e Canvas mais intenso.
