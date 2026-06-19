# First Public-Domain Classic Stories

Recommendation for the first five classic children's stories to seed Wonder Tales with curated, public-domain-friendly content and a small reusable set of story games.

## Working Assumptions

- Use only public-domain story sources as source material. Do not reuse modern retellings, modern illustrations, movie designs, character designs, songs, or branded adaptations.
- Project Gutenberg marks the referenced source collections as "Public domain in the USA." This is enough for a US-first launch, but international publishing should still get a quick legal review before using exact text outside the US.
- Rewrite for Wonder Tales instead of copying full source text verbatim. Keep the core plot, motifs, and moral arc, but use original narration, original generated art, and app-specific interactivity.
- Fit the existing book player shape: cover, story pages, optional `pageType: 'game'` pages, narration blocks, generated audio, and `StoryGameDescriptor` configs.
- Keep each first book short: one embedded game is the default. A second game can be used in a "magic" or extended version, but the first catalog should not feel like a stack of minigames.
- Prefer reusable game mechanics with story skins and parameters over one-off game implementations.

## Recommended First Five

| Priority | Story | Public-domain source basis | Why it should be early | Primary game moment |
| --- | --- | --- | --- | --- |
| 1 | The Three Little Pigs | Joseph Jacobs, `English Fairy Tales`, via [Project Gutenberg #7439](https://www.gutenberg.org/ebooks/7439). The Gutenberg record includes "The story of the three little pigs" and marks the ebook public domain in the USA. | Extremely recognizable, clear problem-solution structure, strong tactile "build it" moment, easy to make gentle for ages 3-7. | `fit-puzzle`: build the brick house. |
| 2 | Goldilocks and the Three Bears | Joseph Jacobs, `English Fairy Tales`, via [Project Gutenberg #7439](https://www.gutenberg.org/ebooks/7439). The Gutenberg record includes "The story of the three bears" and marks the ebook public domain in the USA. | Familiar household objects, strong sequencing and comparison language, good social-emotional arc if rewritten around apology and repair. | `hidden-objects`: tidy the bears' cottage, or `fit-puzzle`: repair Baby Bear's chair. |
| 3 | Little Red-Cap / Little Red Riding Hood | Grimm, `Grimms' Fairy Tales`, via [Project Gutenberg #2591](https://www.gutenberg.org/ebooks/2591). The Gutenberg record includes "Little Red-Cap [Little Red Riding Hood]" and marks the ebook public domain in the USA. | High parent recognition, clear navigation/safety theme, strong forest visual world, easy to make non-violent with a Wonder Tales rewrite. | `hidden-objects`: pack the basket and find safe path markers. |
| 4 | The Hare and the Tortoise | Aesop, `Three hundred Aesop's fables`, via [Project Gutenberg #21](https://www.gutenberg.org/ebooks/21). The Gutenberg text includes "The Hare and the Tortoise" and the ebook record marks it public domain in the USA. | Short, universal, funny, and moral without needing magic. Works as a fast first fable for families who want something calmer than fairy tales. | `word-puzzle`: spell `SLOW`, or `fit-puzzle`: assemble the race path. |
| 5 | The Ugly Duckling | H. C. Andersen, `Fairy Tales of Hans Christian Andersen`, via [Project Gutenberg #27200](https://www.gutenberg.org/ebooks/27200). The Gutenberg record names "The Ugly Duckling" in the collection and marks the ebook public domain in the USA. | Emotional transformation, acceptance theme, animal cast, strong seasonal art direction. Needs the gentlest adaptation pass of the five. | `hidden-objects`: find safe pond items, or `word-puzzle`: spell `SWAN`. |

## Game Library For These Stories

Do not launch five separate games. For this first catalog, the right set is three core game mechanics plus one optional creative reskin.

### 1. Hidden Objects

Status: exists in mobile as `hidden-objects`, but should be promoted into the shared `AVAILABLE_GAMES` list before generators use it in stories.

Why it belongs in the first catalog:

- It is the easiest game to skin per story.
- It fits younger children because the interaction is a simple tap.
- It turns illustrations into active scenes without requiring custom game logic.
- It covers many story beats: pack, find, tidy, gather, prepare, notice.

Suggested config shape:

```ts
type HiddenObjectsStoryConfig = {
  sceneId: string;
  sceneTitle: string;
  skinId:
    | 'forest-path'
    | 'bear-cottage'
    | 'building-yard'
    | 'race-meadow'
    | 'pond-reeds';
  targets: Array<{
    id: string;
    label: string;
    prompt: string;
  }>;
};
```

This is the authoring shape. Before publishing a page to the current runtime, convert it to the existing `HiddenObjectGameConfig` by adding placed `items` with `x`, `y`, `visualSize`, `hitSize`, and `tint`.

Story examples:

- Three Little Pigs: find straw, sticks, bricks, trowel.
- Goldilocks: find bowl, spoon, chair piece, blanket.
- Little Red Riding Hood: find basket, flowers, path sign, red ribbon.
- Hare and Tortoise: find start flag, finish flag, water cup, shady tree.
- Ugly Duckling: find feather, reed, berry, warm nest.

### 2. Fit Puzzle

Status: already story-enabled as `fit-puzzle`.

Use it when the story needs the child to repair, build, unlock, arrange, or complete something. For the current Godot contract, story-specific `roundId`s are the practical short-term path. Later, make the puzzle data-driven with themed silhouettes and draggable items.

Suggested launch parameters:

```ts
type FitPuzzleStoryConfig = {
  roundId: string;
  skinId:
    | 'brick-house'
    | 'bear-chair'
    | 'forest-signpost'
    | 'race-path'
    | 'pond-reflection';
  completionNoun: string;
};
```

Best first uses:

- Three Little Pigs: build the brick house from wall, roof, door, chimney.
- Goldilocks: repair the small chair.
- Little Red Riding Hood: match signs to the safe forest path.
- Hare and Tortoise: assemble a simple route from start to finish.
- Ugly Duckling: complete a pond reflection or nest shape.

### 3. Word Puzzle

Status: already story-enabled as `word-puzzle`.

Use it sparingly, mostly for ages 5-10 or as an optional older-child variant. It works best when the word unlocks a story beat.

Suggested launch words:

| Story | Target word | Why |
| --- | --- | --- |
| The Three Little Pigs | `BRICK` | Reinforces the key solution. |
| Goldilocks and the Three Bears | `SORRY` | Turns the ending into repair and responsibility. |
| Little Red Riding Hood | `PATH` | Reinforces the safety/navigation theme. |
| The Hare and the Tortoise | `SLOW` | Makes the moral playable without a new racing game. |
| The Ugly Duckling | `SWAN` | Names the reveal. |

Localization note: `targetWord` must be localized per language, not translated blindly by the generator. Some words will become too long for early readers and should be swapped for simpler local equivalents.

### 4. Decorate Surface, Optional

Status: current implementation is `nail-paint`, which is too specific for most classic stories.

Recommendation: do not force literal nail painting into these first five stories. If the engine is reusable, wrap it as a generic `decorate-surface` story game with skins for:

- shoe or slipper decoration
- house sign painting
- picnic cloth patterning
- shell, feather, or crown decoration

Suggested config shape:

```ts
type DecorateSurfaceConfig = {
  roundId: string;
  surfaceId: 'slipper' | 'house-sign' | 'picnic-cloth' | 'shell' | 'feather';
  colorHexes: string[];
  patternIds: string[];
};
```

Use this only when the story naturally calls for decoration or color restoration. It is a nice creative mechanic, but not a launch dependency for the five recommended stories.

## Story Plans

### 1. The Three Little Pigs

Adaptation stance:

- Keep the repeated structure and "stronger house" lesson.
- Remove devouring/death. The wolf can huff, puff, get tired, and leave after the brick house holds.
- Make the pigs cooperative by the end, not just "two foolish pigs and one smart pig."

Suggested 5-page arc:

1. The three pigs set out to build homes.
2. Straw and sticks go up quickly, but the wind makes them wobble.
3. Game: build the brick house with `fit-puzzle`.
4. The wolf huffs and puffs, but the brick house stays steady.
5. The pigs share soup inside and plan to build carefully next time.

Primary descriptor:

```ts
{
  id: 'three-pigs-build-brick-house',
  type: 'godot-fit-puzzle',
  title: 'Build the Brick House',
  ageRange: { min: 3, max: 8 },
  prompt: 'Help the pigs fit each brick-house piece into place before the wind arrives.',
  config: {
    roundId: 'three-pigs-brick-house',
    skinId: 'brick-house',
    completionNoun: 'brick house'
  }
}
```

Optional older-child game: `word-puzzle` with `targetWord: 'BRICK'`.

### 2. Goldilocks and the Three Bears

Adaptation stance:

- Keep the "too hot, too cold, just right" rhythm.
- Do not present entering someone's home as harmless. Goldilocks should be lost, make mistakes, and repair/apologize.
- Use the ending for empathy: she tidies up and leaves a note or says sorry when the bears return.

Suggested 5-page arc:

1. Goldilocks wanders off the path and finds a cottage.
2. She tries the porridge, chairs, and beds while looking for help.
3. The bears come home and notice the cottage is messy.
4. Game: tidy the cottage with `hidden-objects`, or repair Baby Bear's chair with `fit-puzzle`.
5. Goldilocks apologizes and learns to ask before entering.

Primary descriptor:

```ts
{
  id: 'goldilocks-tidy-cottage',
  type: 'hidden-objects',
  title: "Tidy the Bears' Cottage",
  ageRange: { min: 3, max: 8 },
  prompt: 'Help Goldilocks find the things she moved so the cottage feels just right again.',
  config: {
    sceneId: 'goldilocks-cottage',
    sceneTitle: "The Bears' Cottage",
    skinId: 'bear-cottage',
    targets: [
      { id: 'small-spoon', label: 'Small spoon', prompt: 'Find Baby Bear's spoon.' },
      { id: 'chair-piece', label: 'Chair piece', prompt: 'Find the missing chair piece.' },
      { id: 'blanket', label: 'Blanket', prompt: 'Find the blanket for the little bed.' }
    ],
    items: [] // Builder should place target items before publish.
  }
}
```

Optional older-child game: `word-puzzle` with `targetWord: 'SORRY'`.

### 3. Little Red Riding Hood

Adaptation stance:

- Use the Grimm/folk structure, but make it non-violent.
- The wolf can trick, distract, and pretend. The resolution should be adult help, clever noticing, and safe choices.
- Avoid hunter weapons, cutting, swallowing, or death in the first app version.

Suggested 5-page arc:

1. Red packs a basket for Grandma.
2. Game: find basket items with `hidden-objects`.
3. Red meets the wolf and remembers to stay on the path.
4. Red notices odd clues at Grandma's cottage and calls for help.
5. Grandma is safe, the wolf runs away, and Red goes home with a safety lesson.

Primary descriptor:

```ts
{
  id: 'red-riding-hood-pack-basket',
  type: 'hidden-objects',
  title: 'Pack the Basket',
  ageRange: { min: 3, max: 8 },
  prompt: 'Help Red find the things Grandma needs before she walks through the forest.',
  config: {
    sceneId: 'red-forest-basket',
    sceneTitle: 'The Forest Basket',
    skinId: 'forest-path',
    targets: [
      { id: 'bread', label: 'Bread', prompt: 'Find the bread.' },
      { id: 'jam', label: 'Jam', prompt: 'Find the jam.' },
      { id: 'flowers', label: 'Flowers', prompt: 'Find the flowers.' },
      { id: 'path-sign', label: 'Path sign', prompt: 'Find the safe path sign.' }
    ],
    items: [] // Builder should place target items before publish.
  }
}
```

Optional older-child game: `word-puzzle` with `targetWord: 'PATH'`.

### 4. The Hare and the Tortoise

Adaptation stance:

- Keep it short, playful, and low-stakes.
- Make the hare silly rather than cruel.
- Do not build a racing game for this yet. Use existing mechanics to support the story.

Suggested 5-page arc:

1. Hare laughs that Tortoise is too slow to race.
2. The race begins and Tortoise keeps walking.
3. Game: assemble the race path with `fit-puzzle`, or spell `SLOW` with `word-puzzle`.
4. Hare naps while Tortoise keeps going.
5. Tortoise crosses the finish line and Hare learns to respect steady effort.

Primary descriptor:

```ts
{
  id: 'tortoise-hare-slow-steady',
  type: 'godot-word-puzzle',
  title: 'Slow and Steady',
  ageRange: { min: 5, max: 10 },
  prompt: 'Spell the word that helps Tortoise remember how to win: slow and steady.',
  config: {
    roundId: 'tortoise-hare-slow',
    targetWord: 'SLOW',
    extraLetterCount: 3
  }
}
```

Younger-child variant: `hidden-objects` to find the start flag, finish flag, water cup, and shady tree.

### 5. The Ugly Duckling

Adaptation stance:

- Keep the transformation and belonging arc.
- Strongly soften the rejection. The first version should not dwell on bullying or isolation.
- Focus on "not yet", seasons changing, finding safe helpers, and discovering his swan family.

Suggested 5-page arc:

1. A different-looking duckling hatches by the pond.
2. He feels out of place and wanders through reeds and snow.
3. Game: find safe pond items with `hidden-objects`.
4. Spring arrives and he sees his reflection.
5. The swans welcome him, and he understands he has grown in his own way.

Primary descriptor:

```ts
{
  id: 'ugly-duckling-pond-search',
  type: 'hidden-objects',
  title: 'Find a Cozy Pond',
  ageRange: { min: 3, max: 8 },
  prompt: 'Help the little bird find safe, cozy things near the pond.',
  config: {
    sceneId: 'duckling-pond-reeds',
    sceneTitle: 'The Quiet Pond',
    skinId: 'pond-reeds',
    targets: [
      { id: 'soft-feather', label: 'Soft feather', prompt: 'Find a soft feather.' },
      { id: 'reeds', label: 'Reeds', prompt: 'Find the tall reeds.' },
      { id: 'berries', label: 'Berries', prompt: 'Find the berries.' },
      { id: 'sunbeam', label: 'Sunbeam', prompt: 'Find the warm sunbeam.' }
    ],
    items: [] // Builder should place target items before publish.
  }
}
```

Optional older-child game: `word-puzzle` with `targetWord: 'SWAN'`.

## Launch Order

1. Promote `hidden-objects` to a real story-enabled game in `packages/shared/src/games.ts`.
2. Add source metadata fields for curated classic books: source title, source author/compiler, source URL, public-domain note, adaptation note.
3. Seed two books first: `The Three Little Pigs` and `Goldilocks and the Three Bears`. They exercise the clearest game contexts and youngest audience.
4. Add `Little Red Riding Hood` once the adaptation guidelines are accepted, because it needs the strictest safety rewrite.
5. Add `The Hare and the Tortoise` and `The Ugly Duckling` as the second pair: one short fable, one emotional transformation story.
6. Defer a generic `decorate-surface` wrapper until after these books are playable. Do not make `nail-paint` the default creative mechanic for classic stories unless its story-facing label and skins are generalized.

## Content Safety Notes

- Avoid exact modern titles, visual styles, costumes, and dialogue from Disney, modern picture books, TV adaptations, or other protected retellings.
- Avoid public-domain illustrations unless each asset's rights are tracked. Original generated art is cleaner for the first catalog.
- Keep violence off-screen or rewrite it away for ages 3-7.
- Let the narrator acknowledge repair, consent, safety, persistence, and belonging in plain child-friendly language.
- Keep each game result narratively meaningful. The next page should explicitly say what changed because the child completed the game.
