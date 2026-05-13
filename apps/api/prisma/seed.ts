import { PrismaClient } from '@prisma/client';
import {
  getStorytellerPortraitUrl,
  getStorytellerPreviewAudioUrl,
  STORYTELLER_CATALOG,
  SUPPORTED_LANGUAGES,
} from '../src/storytellers/storyteller-catalog';

const prisma = new PrismaClient();

async function seedStorytellers() {
  console.log('Seeding storytellers…');
  let count = 0;
  for (const storyteller of STORYTELLER_CATALOG) {
    for (const language of SUPPORTED_LANGUAGES) {
      const data = {
        identifier: storyteller.identifier,
        language,
        name: storyteller.names[language],
        model: storyteller.model,
        voice: storyteller.voice,
        imageUrl: getStorytellerPortraitUrl(storyteller.identifier),
        previewAudioUrl: getStorytellerPreviewAudioUrl(
          language,
          storyteller.identifier,
        ),
        sortOrder: storyteller.sortOrder,
        enabled: true,
      };

      await prisma.storyteller.upsert({
        where: {
          language_identifier: {
            language,
            identifier: storyteller.identifier,
          },
        },
        create: data,
        update: data,
      });
      count++;
    }
  }
  console.log(`  upserted ${count} storyteller records`);
}

interface PublicTemplateSeed {
  title: string;
  description: string;
  theme: string;
  language: string | null;
  sortOrder: number;
}

const PUBLIC_TEMPLATES: PublicTemplateSeed[] = [
  {
    title: '🌊 Aventura no Fundo do Mar',
    description: 'Uma viagem submarina com criaturas marinhas amigáveis.',
    theme: [
      'Uma aventura submarina cheia de descobertas no fundo do oceano.',
      '',
      'Exemplos de cenários: recifes de coral brilhantes, cavernas escondidas, jardins de algas dançantes, um castelo de pérolas, naufrágios pacíficos.',
      'Exemplos de personagens: polvos sábios, cavalos-marinhos guias, tartarugas anciãs, golfinhos brincalhões, peixes-palhaço travessos, sereias bondosas.',
      'Itens possíveis: bússola mágica, mapa de pérolas, concha que canta, escama brilhante, alga curativa.',
      'Possíveis temas: amizade entre espécies, coragem para explorar o desconhecido, cuidar do oceano, descobrir um segredo antigo.',
    ].join('\n'),
    language: 'pt',
    sortOrder: 10,
  },
  {
    title: '🚀 Viagem ao Espaço',
    description: 'Astronautas em uma missão entre planetas coloridos.',
    theme: [
      'Uma jornada espacial pilotando um foguete por planetas estranhos e amistosos.',
      '',
      'Exemplos de cenários: planetas de algodão-doce, luas de gelo brilhante, anéis de poeira de estrela, estações espaciais com mercados, nebulosas coloridas.',
      'Exemplos de personagens: alienígenas tímidos, robôs falantes, comandantes de naves espaciais amigáveis, criaturas de luz, animais de estimação espaciais.',
      'Itens possíveis: capacete que traduz idiomas, mochila a jato, mapa estelar, cristal que aponta o caminho, sementes alienígenas.',
      'Possíveis temas: descobrir o que é diferente, fazer amigos no desconhecido, resolver um problema técnico, voltar para casa.',
    ].join('\n'),
    language: 'pt',
    sortOrder: 20,
  },
  {
    title: '🐉 O Pequeno Dragão',
    description: 'Amizade improvável com um dragão que tem medo de fogo.',
    theme: [
      'Uma história de coragem com um pequeno dragão e uma criança que viram amigos.',
      '',
      'Exemplos de cenários: vale de cristais, floresta enevoada, montanha do clã dos dragões, lago do espelho, ruínas antigas.',
      'Exemplos de personagens: dragão filhote tímido, fada conselheira, guarda-floresta gentil, irmãos dragões mais velhos brincalhões, sábio do vale.',
      'Itens possíveis: pena de fênix, pedra que aquece, escama de dragão, mapa da montanha, livro de fagulhas.',
      'Possíveis temas: vencer medos, descobrir o próprio poder, aceitar quem se é, ajudar um amigo, amizade improvável.',
    ].join('\n'),
    language: 'pt',
    sortOrder: 30,
  },
  {
    title: '🌊 Underwater Adventure',
    description: 'A journey beneath the waves with friendly sea creatures.',
    theme: [
      'An underwater adventure full of discoveries on the ocean floor.',
      '',
      'Sample settings: glowing coral reefs, hidden caves, dancing kelp gardens, a pearl castle, peaceful shipwrecks.',
      'Sample characters: wise octopuses, seahorse guides, ancient sea turtles, playful dolphins, mischievous clownfish, kind mermaids.',
      'Possible items: a magic compass, a pearl map, a singing shell, a glowing scale, healing seaweed.',
      'Possible themes: friendship between species, courage to explore the unknown, protecting the ocean, uncovering an ancient secret.',
    ].join('\n'),
    language: 'en',
    sortOrder: 10,
  },
  {
    title: '🚀 Space Voyage',
    description: 'Astronauts on a mission across colorful planets.',
    theme: [
      'A space journey piloting a rocket through strange and friendly planets.',
      '',
      'Sample settings: cotton-candy planets, glowing ice moons, rings of stardust, space stations with markets, colorful nebulas.',
      'Sample characters: shy aliens, talking robots, friendly starship captains, light creatures, space pets.',
      'Possible items: a helmet that translates languages, a jet backpack, a star map, a crystal that points the way, alien seeds.',
      'Possible themes: discovering what is different, making friends in the unknown, solving a technical puzzle, finding the way home.',
    ].join('\n'),
    language: 'en',
    sortOrder: 20,
  },
  {
    title: '🐉 The Little Dragon',
    description: 'An unlikely friendship with a dragon afraid of fire.',
    theme: [
      'A courage story with a tiny dragon and a child who become friends.',
      '',
      'Sample settings: a valley of crystals, a misty forest, the dragon-clan mountain, a mirror lake, ancient ruins.',
      'Sample characters: shy baby dragon, advisor fairy, gentle forest ranger, playful older dragon siblings, valley sage.',
      'Possible items: phoenix feather, warming stone, dragon scale, mountain map, book of sparks.',
      'Possible themes: overcoming fears, discovering one\'s own power, accepting who you are, helping a friend, unlikely friendship.',
    ].join('\n'),
    language: 'en',
    sortOrder: 30,
  },
];

async function seedStoryTemplates() {
  console.log('Seeding story templates…');
  let created = 0;
  let updated = 0;
  for (const tpl of PUBLIC_TEMPLATES) {
    // Public templates don't have a natural unique key; treat (userId=null,
    // title) as the de-dupe key, and refresh content on every seed run so
    // updates to the prompt material flow through.
    const existing = await prisma.storyTemplate.findFirst({
      where: { userId: null, title: tpl.title },
      select: { id: true },
    });
    if (existing) {
      await prisma.storyTemplate.update({
        where: { id: existing.id },
        data: {
          description: tpl.description,
          theme: tpl.theme,
          language: tpl.language,
          sortOrder: tpl.sortOrder,
          enabled: true,
        },
      });
      updated++;
    } else {
      await prisma.storyTemplate.create({
        data: {
          userId: null,
          title: tpl.title,
          description: tpl.description,
          theme: tpl.theme,
          language: tpl.language,
          enabled: true,
          sortOrder: tpl.sortOrder,
        },
      });
      created++;
    }
  }
  console.log(`  created ${created}, updated ${updated} story templates`);
}

async function main() {
  await seedStorytellers();
  await seedStoryTemplates();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
