'use client';

import {
  Archive,
  BookOpen,
  CaretDown,
  Desktop,
  DeviceMobile,
  DeviceTablet,
  DotsSixVertical,
  FloppyDisk,
  GameController,
  ImageSquare,
  MagicWand,
  MicrophoneStage,
  PencilSimple,
  Play,
  Plus,
  RocketLaunch,
  Trash,
  UserCircle,
  X,
} from '@phosphor-icons/react';
import {
  AVAILABLE_GAMES,
  findAvailableGame,
  STORY_GAME_NARRATION_CUES,
  type StoryGameDescriptor,
  type StoryGameNarrationCueId,
  toStoryGameDescriptor,
} from '@wondertales/shared/games';
import {
  type CSSProperties,
  type DragEvent,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type BuilderBookPayload,
  type BuilderBookSummary,
  type BuilderCharacter,
  type BuilderImageAspect,
  type BuilderLanguage,
  type BuilderNarrationBlock,
  type BuilderPagePayload,
  DEFAULT_IMAGE_ASPECT,
  IMAGE_ASPECT_OPTIONS,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  VOICE_PRESETS,
} from '~/lib/types';

type BuilderWorkspaceProps = {
  initialBooks: BuilderBookSummary[];
  initialBook?: BuilderBookPayload;
};

type BusyAction =
  | 'create'
  | 'load'
  | 'save'
  | 'revise'
  | 'publish'
  | 'archive'
  | 'delete';

type PageEditorTab = 'content' | 'images' | 'narration';

type MediaProgress = {
  imageUrl?: string;
  index?: number;
  message: string;
};

const storyGames = AVAILABLE_GAMES.filter((game) => game.storyEnabled);
const PAGE_DRAG_TYPE = 'application/x-wonder-page-index';
const PAGE_EDITOR_TABS = [
  { id: 'content', label: 'Content', icon: BookOpen },
  { id: 'images', label: 'Images', icon: ImageSquare },
  { id: 'narration', label: 'Narration', icon: MicrophoneStage },
] satisfies Array<{
  id: PageEditorTab;
  label: string;
  icon: typeof BookOpen;
}>;

const IMAGE_ASPECT_ICONS = {
  desktop: Desktop,
  tablet: DeviceTablet,
  phone: DeviceMobile,
} satisfies Record<BuilderImageAspect, typeof Desktop>;

const GAME_NARRATION_PLACEHOLDERS = {
  en: {
    start: 'Listen carefully, then help the story by playing this game.',
    failure: 'That did not work yet. Try a different move.',
    successMove: 'Great move. Keep going.',
    idle: 'Try one more move when you are ready.',
    complete: 'You did it. The story can continue.',
  },
  fr: {
    start: "Ecoute bien, puis aide l'histoire avec ce jeu.",
    failure: "Ce n'est pas encore ca. Essaie un autre mouvement.",
    successMove: 'Tres bien. Continue.',
    idle: 'Essaie encore quand tu es pret.',
    complete: "Tu as reussi. L'histoire peut continuer.",
  },
  pt: {
    start: 'Escuta com atencao e ajuda a historia com este jogo.',
    failure: 'Ainda nao deu certo. Tenta um movimento diferente.',
    successMove: 'Muito bem. Continua.',
    idle: 'Tenta mais uma vez quando estiveres pronto.',
    complete: 'Conseguiste. A historia pode continuar.',
  },
  it: {
    start: 'Ascolta bene, poi aiuta la storia con questo gioco.',
    failure: 'Non ha ancora funzionato. Prova una mossa diversa.',
    successMove: 'Ottima mossa. Continua cosi.',
    idle: 'Prova ancora quando sei pronto.',
    complete: 'Ce l hai fatta. La storia puo continuare.',
  },
} satisfies Record<BuilderLanguage, Record<StoryGameNarrationCueId, string>>;
const PUBLISH_REQUIRED_LANGUAGES = [
  'en',
] as const satisfies readonly BuilderLanguage[];

export function BuilderWorkspace({
  initialBooks,
  initialBook,
}: BuilderWorkspaceProps) {
  const [books, setBooks] = useState(initialBooks);
  const [book, setBook] = useState<BuilderBookPayload | undefined>(initialBook);
  const [language, setLanguage] = useState<BuilderLanguage>('en');
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [mediaLoading, setMediaLoading] = useState<Record<string, boolean>>({});
  const [mediaProgress, setMediaProgress] = useState<
    Record<string, MediaProgress>
  >({});
  const [audioLoading, setAudioLoading] = useState<Record<string, boolean>>({});
  const [collapsedPages, setCollapsedPages] = useState<Record<string, boolean>>(
    {},
  );
  const [collapsedCharacters, setCollapsedCharacters] = useState<
    Record<string, boolean>
  >({});
  const [draggingPageId, setDraggingPageId] = useState<string | null>(null);
  const [pageDropTarget, setPageDropTarget] = useState<{
    pageId: string;
    placement: 'before' | 'after';
  } | null>(null);
  const [pageTabs, setPageTabs] = useState<Record<string, PageEditorTab>>({});
  const [reviewPageId, setReviewPageId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newStoryBrief, setNewStoryBrief] = useState('');
  const [imageModal, setImageModal] = useState<{
    title: string;
    url: string;
  } | null>(null);
  const [revisionInstructions, setRevisionInstructions] = useState<
    Record<string, string>
  >({});

  const selectedTitle = book?.localizations[language].title || book?.slug || '';
  const selectedSummary = book?.localizations[language].summary ?? '';
  const isMediaGenerating = Object.values(mediaLoading).some(Boolean);
  const isAudioGenerating = Object.values(audioLoading).some(Boolean);

  const pagesWithGames = useMemo(
    () => book?.pages.filter((page) => page.game) ?? [],
    [book],
  );
  const reviewPageContext = useMemo(() => {
    if (!book || !reviewPageId) return null;
    const pageIndex = book.pages.findIndex((page) => page.id === reviewPageId);
    const page = book.pages[pageIndex];
    return page ? { page, pageIndex } : null;
  }, [book, reviewPageId]);
  const publishBlockReasons = useMemo(
    () =>
      book
        ? getPublishBlockReasons(book, {
            busy,
            isAudioGenerating,
            isMediaGenerating,
          })
        : [],
    [book, busy, isAudioGenerating, isMediaGenerating],
  );
  const publishTooltip =
    publishBlockReasons.length > 0
      ? `Publish unavailable:\n${publishBlockReasons
          .map((reason) => `- ${reason}`)
          .join('\n')}`
      : 'Publish';

  useEffect(() => {
    if (!imageModal) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setImageModal(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageModal]);

  async function run<T>(
    action: BusyAction,
    task: () => Promise<T>,
    successMessage: string,
  ): Promise<T | undefined> {
    setBusy(action);
    setMessage('');
    setIsError(false);
    try {
      const result = await task();
      setMessage(successMessage);
      return result;
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Unexpected error');
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function loadBook(id: string) {
    const payload = await run(
      'load',
      () => requestJson<BuilderBookPayload>(`/api/books/${id}`),
      'Loaded',
    );
    if (payload) setBook(payload);
  }

  async function createBook() {
    const brief = newStoryBrief.trim();
    if (!brief) {
      setIsError(true);
      setMessage('Write a story brief first');
      return;
    }
    const payload = await run(
      'create',
      () =>
        requestJson<BuilderBookPayload>('/api/books', {
          method: 'POST',
          body: JSON.stringify({ brief }),
        }),
      'Story generated for review',
    );
    if (payload) {
      mergePayload(payload);
      setCreateDialogOpen(false);
      setNewStoryBrief('');
    }
  }

  async function saveBook() {
    if (!book) return;
    const payload = await run(
      'save',
      () =>
        requestJson<BuilderBookPayload>(`/api/books/${book.id}`, {
          method: 'PATCH',
          body: JSON.stringify(book),
        }),
      'Saved',
    );
    if (payload) mergePayload(payload);
  }

  async function saveBookForMediaGeneration(
    sourceBook: BuilderBookPayload,
  ): Promise<BuilderBookPayload | undefined> {
    try {
      const payload = await requestJson<BuilderBookPayload>(
        `/api/books/${sourceBook.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(sourceBook),
        },
      );
      mergePayload(payload);
      return payload;
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not save changes before generation',
      );
      return undefined;
    }
  }

  function findSavedPageForGeneration(
    sourceBook: BuilderBookPayload,
    pageNumber: number,
  ): BuilderPagePayload | undefined {
    return sourceBook.pages.find((page) => page.pageNumber === pageNumber);
  }

  async function generateCoverImage(
    bookId: string,
    options: { skipSave?: boolean } = {},
  ) {
    let targetBookId = bookId;
    if (!options.skipSave) {
      const currentBook = book;
      if (!currentBook) return;
      const targetBook = await saveBookForMediaGeneration(currentBook);
      if (!targetBook) return;
      targetBookId = targetBook.id;
    }
    await generateMediaAsset({
      key: coverImageKey(),
      url: `/api/books/${targetBookId}/media/cover`,
    });
    setMessage('Cover image generated');
  }

  async function generatePageImage(
    bookId: string,
    pageId: string,
    pageNumber: number,
    options: { skipSave?: boolean } = {},
  ) {
    let targetBookId = bookId;
    let targetPageId = pageId;
    if (!options.skipSave) {
      const currentBook = book;
      if (!currentBook) return;
      const targetBook = await saveBookForMediaGeneration(currentBook);
      if (!targetBook) return;
      targetBookId = targetBook.id;
      const targetPage =
        targetBook.pages.find((page) => page.pageNumber === pageNumber) ??
        targetBook.pages.find((page) => page.id === pageId);
      if (!targetPage) {
        setIsError(true);
        setMessage(`Page ${pageNumber} could not be reloaded`);
        return;
      }
      targetPageId = targetPage.id;
    }
    await generateMediaAsset({
      key: pageImageKey(targetPageId),
      url: `/api/books/${targetBookId}/pages/${targetPageId}/media`,
    });
    setMessage(`Page ${pageNumber} image generated`);
  }

  async function generateCharacterImage(characterId: string) {
    if (!book) return;
    setMessage('Saving character details...');
    const savedBook = await saveBookForMediaGeneration(book);
    if (!savedBook) return;
    const character = savedBook.characters.find(
      (item) => item.id === characterId,
    );
    if (!character) {
      setIsError(true);
      setMessage('Character not found');
      return;
    }
    await generateMediaAsset({
      key: characterImageKey(characterId),
      url: `/api/books/${savedBook.id}/characters/${characterId}/media`,
    });
    setMessage(`${character.name || 'Character'} image generated`);
  }

  async function generateMediaAsset(input: { key: string; url: string }) {
    const { key, url } = input;
    setMediaLoading((current) => ({ ...current, [key]: true }));
    setMediaProgress((current) => ({
      ...current,
      [key]: { message: 'Starting OpenAI stream' },
    }));
    setIsError(false);
    try {
      const payload = await requestEventStream<BuilderBookPayload>(
        url,
        { method: 'POST' },
        (event, data) => {
          if (event === 'status') {
            setMediaProgress((current) => ({
              ...current,
              [key]: {
                ...current[key],
                message: readStreamMessage(data) ?? 'Waiting for OpenAI',
              },
            }));
          }
          if (event === 'partial') {
            const partial = readImagePartial(data);
            if (!partial) return;
            setMediaProgress((current) => ({
              ...current,
              [key]: {
                imageUrl: partial.imageUrl,
                index: partial.index,
                message: `OpenAI preview ${partial.index + 1}`,
              },
            }));
          }
        },
      );
      mergePayload(payload);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Image failed');
      throw error;
    } finally {
      setMediaLoading((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setMediaProgress((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  async function generateBlockAudio(
    pageId: string,
    blockId: string,
    pageNumber: number,
  ) {
    if (!book) return;
    const key = audioBlockKey(pageId, language, blockId);
    setAudioLoading((current) => ({ ...current, [key]: true }));
    setIsError(false);
    try {
      const savedBook = await saveBookForMediaGeneration(book);
      const savedPage = savedBook
        ? findSavedPageForGeneration(savedBook, pageNumber)
        : undefined;
      if (!savedBook || !savedPage) return;
      const payload = await requestJson<BuilderBookPayload>(
        `/api/books/${savedBook.id}/pages/${savedPage.id}/audio`,
        {
          method: 'POST',
          body: JSON.stringify({ language, blockId, regenerate: true }),
        },
      );
      mergePayload(payload);
      setMessage(`Page ${pageNumber} audio generated`);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Audio failed');
    } finally {
      setAudioLoading((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  async function generateGameCueAudio(
    pageId: string,
    cueId: StoryGameNarrationCueId,
    cueLabel: string,
    pageNumber: number,
  ) {
    if (!book) return;
    const key = gameCueAudioKey(pageId, language, cueId);
    setAudioLoading((current) => ({ ...current, [key]: true }));
    setIsError(false);
    try {
      const savedBook = await saveBookForMediaGeneration(book);
      const savedPage = savedBook
        ? findSavedPageForGeneration(savedBook, pageNumber)
        : undefined;
      if (!savedBook || !savedPage) return;
      const payload = await requestJson<BuilderBookPayload>(
        `/api/books/${savedBook.id}/pages/${savedPage.id}/audio`,
        {
          method: 'POST',
          body: JSON.stringify({ language, cueId, regenerate: true }),
        },
      );
      mergePayload(payload);
      setMessage(`Page ${pageNumber} ${cueLabel} audio generated`);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Audio failed');
    } finally {
      setAudioLoading((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  function playAudio(url: string) {
    if (!url) return;
    const audio = new Audio(url);
    void audio.play().catch((error) => {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Playback failed');
    });
  }

  function openImageModal(url: string, title: string) {
    if (!url) return;
    setImageModal({ title, url });
  }

  async function publishBook() {
    if (!book) return;
    const payload = await run(
      'publish',
      () =>
        requestJson<BuilderBookPayload>(`/api/books/${book.id}/publish`, {
          method: 'POST',
        }),
      'Published',
    );
    if (payload) mergePayload(payload);
  }

  async function archiveBook() {
    if (!book) return;
    const payload = await run(
      'archive',
      () =>
        requestJson<BuilderBookPayload>(`/api/books/${book.id}/archive`, {
          method: 'POST',
        }),
      'Archived',
    );
    if (payload) mergePayload(payload);
  }

  async function deleteArchivedBook() {
    if (book?.status !== 'archived') return;
    const id = book.id;
    const payload = await run(
      'delete',
      () =>
        requestJson<{ ok: true }>(`/api/books/${id}`, {
          method: 'DELETE',
        }),
      'Archived story deleted',
    );
    if (payload) {
      setBook(undefined);
      setBooks((current) => current.filter((item) => item.id !== id));
    }
  }

  function mergePayload(payload: BuilderBookPayload) {
    const previousBook = book?.id === payload.id ? book : undefined;
    if (previousBook) {
      setPageTabs((current) => remapPageState(current, previousBook, payload));
      setCollapsedPages((current) =>
        remapPageState(current, previousBook, payload),
      );
      setRevisionInstructions((current) =>
        remapPageState(current, previousBook, payload),
      );
      setReviewPageId((current) => remapPageId(current, previousBook, payload));
    }
    setBook(payload);
    setBooks((current) => {
      const summary = toSummary(payload);
      const next = current.filter((item) => item.id !== payload.id);
      return [summary, ...next];
    });
  }

  function updateBook(patch: Partial<BuilderBookPayload>) {
    setBook((current) => (current ? { ...current, ...patch } : current));
  }

  function updateDefaultVoice(defaultVoice: string) {
    setBook((current) => {
      if (!current) return current;
      const nextPhase =
        current.builderPhase === 'ready' || current.builderPhase === 'audio'
          ? 'audio'
          : current.builderPhase;
      return {
        ...current,
        defaultVoice,
        storyteller: defaultVoice,
        builderPhase: nextPhase,
        pages: current.pages.map((page) => ({
          ...page,
          localizations: mapPageLocalizations(page, (localization) => ({
            ...localization,
            audioUrl: '',
            narrationBlocks: localization.narrationBlocks.map((block) =>
              block.voice
                ? block
                : { ...block, audioUrl: '', audioObjectKey: null },
            ),
          })),
        })),
      };
    });
  }

  function markTextDirty<T extends BuilderBookPayload>(payload: T): T {
    return payload.builderPhase === 'text'
      ? payload
      : { ...payload, builderPhase: 'text' };
  }

  function markImagesDirty<T extends BuilderBookPayload>(payload: T): T {
    return payload.builderPhase === 'text'
      ? payload
      : { ...payload, builderPhase: 'images' };
  }

  function updateBookLocalization(
    field: keyof BuilderBookPayload['localizations'][BuilderLanguage],
    value: string,
  ) {
    if (!book) return;
    updateBook(
      markTextDirty({
        ...book,
        localizations: {
          ...book.localizations,
          [language]: {
            ...book.localizations[language],
            [field]: value,
          },
        },
      }),
    );
  }

  function updatePage(
    index: number,
    updater: (page: BuilderPagePayload) => BuilderPagePayload,
  ) {
    if (!book) return;
    updateBook({
      pages: book.pages.map((page, pageIndex) =>
        pageIndex === index ? updater(page) : page,
      ),
    });
  }

  function updatePageLocalization(
    index: number,
    field: keyof BuilderPagePayload['localizations'][BuilderLanguage],
    value: string,
  ) {
    if (!book) return;
    const isTextField = field !== 'audioUrl';
    const next = {
      ...book,
      pages: book.pages.map((page, pageIndex) =>
        pageIndex === index
          ? {
              ...page,
              imageUrl: isTextField ? '' : page.imageUrl,
              localizations: {
                ...page.localizations,
                [language]: {
                  ...page.localizations[language],
                  [field]: value,
                  ...(isTextField ? { audioUrl: '' } : {}),
                  ...(field === 'narrationText'
                    ? {
                        narrationBlocks: createDefaultNarrationBlocks(value),
                      }
                    : {}),
                  ...(field === 'content' &&
                  !page.localizations[language].narrationText.trim()
                    ? {
                        narrationBlocks: createDefaultNarrationBlocks(value),
                      }
                    : {}),
                },
              },
            }
          : page,
      ),
    };
    updateBook(isTextField ? markTextDirty(next) : next);
  }

  function updatePageRichText(
    index: number,
    field: 'content',
    value: { html: string; text: string },
  ) {
    if (!book) return;
    const next = {
      ...book,
      pages: book.pages.map((page, pageIndex) => {
        if (pageIndex !== index) return page;
        const localization = page.localizations[language];
        const nextLocalization = {
          ...localization,
          [field]: value.text,
          contentHtml: value.html,
          audioUrl: '',
          ...(!localization.narrationText.trim()
            ? {
                narrationBlocks: createDefaultNarrationBlocks(value.text),
              }
            : {}),
        };
        return {
          ...page,
          imageUrl: '',
          localizations: {
            ...page.localizations,
            [language]: nextLocalization,
          },
        };
      }),
    };
    updateBook(markTextDirty(next));
  }

  function addCharacter() {
    if (!book) return;
    const id = uniqueCharacterId(book.characters, 'character');
    setCollapsedCharacters((current) => ({ ...current, [id]: false }));
    updateBook(
      markImagesDirty({
        ...book,
        characters: [
          ...book.characters,
          {
            id,
            name: 'New character',
            imageUrl: '',
            role: '',
            appearance: '',
            details: '',
          },
        ],
      }),
    );
  }

  function updateCharacter(id: string, patch: Partial<BuilderCharacter>) {
    if (!book) return;
    updateBook(
      markImagesDirty({
        ...book,
        characters: book.characters.map((character) =>
          character.id === id ? { ...character, ...patch } : character,
        ),
        coverImageUrl: book.coverCharacterIds.includes(id)
          ? ''
          : book.coverImageUrl,
        pages: book.pages.map((page) =>
          page.characterIds.includes(id) ? { ...page, imageUrl: '' } : page,
        ),
      }),
    );
  }

  function removeCharacter(id: string) {
    if (!book) return;
    updateBook(
      markImagesDirty({
        ...book,
        characters: book.characters.filter((character) => character.id !== id),
        coverCharacterIds: book.coverCharacterIds.filter(
          (characterId) => characterId !== id,
        ),
        coverImageUrl: book.coverCharacterIds.includes(id)
          ? ''
          : book.coverImageUrl,
        pages: book.pages.map((page) => ({
          ...page,
          characterIds: page.characterIds.filter(
            (characterId) => characterId !== id,
          ),
          imageUrl: page.characterIds.includes(id) ? '' : page.imageUrl,
        })),
      }),
    );
  }

  function toggleCoverCharacter(characterId: string) {
    if (!book) return;
    const selected = book.coverCharacterIds.includes(characterId);
    updateBook(
      markImagesDirty({
        ...book,
        coverCharacterIds: selected
          ? book.coverCharacterIds.filter((id) => id !== characterId)
          : [...book.coverCharacterIds, characterId],
        coverImageUrl: '',
      }),
    );
  }

  function addCharacterToPage(pageIndex: number, characterId: string) {
    if (!book) return;
    updateBook(
      markImagesDirty({
        ...book,
        pages: book.pages.map((page, currentPageIndex) =>
          currentPageIndex === pageIndex &&
          !page.characterIds.includes(characterId)
            ? {
                ...page,
                characterIds: [...page.characterIds, characterId],
                imageUrl: '',
              }
            : page,
        ),
      }),
    );
  }

  function removeCharacterFromPage(pageIndex: number, characterId: string) {
    if (!book) return;
    updateBook(
      markImagesDirty({
        ...book,
        pages: book.pages.map((page, currentPageIndex) =>
          currentPageIndex === pageIndex
            ? {
                ...page,
                characterIds: page.characterIds.filter(
                  (id) => id !== characterId,
                ),
                imageUrl: '',
              }
            : page,
        ),
      }),
    );
  }

  function updateNarrationBlock(
    pageIndex: number,
    blockIndex: number,
    patch: Partial<BuilderNarrationBlock>,
  ) {
    if (!book) return;
    applyNarrationBlocks(pageIndex, (blocks) =>
      blocks.map((block, currentBlockIndex) =>
        currentBlockIndex === blockIndex
          ? {
              ...block,
              ...patch,
              audioUrl: '',
              audioObjectKey: null,
              audioTiming: null,
            }
          : block,
      ),
    );
  }

  function splitNarrationSelection(input: {
    pageIndex: number;
    blockIndex: number;
    selectionStart: number;
    selectionEnd: number;
    voice: string;
  }) {
    if (!book) return;
    applyNarrationBlocks(input.pageIndex, (blocks) => {
      const block = blocks[input.blockIndex];
      if (!block) return blocks;
      const start = Math.min(input.selectionStart, input.selectionEnd);
      const end = Math.max(input.selectionStart, input.selectionEnd);
      if (start === end) {
        setIsError(true);
        setMessage('Select narration text before splitting');
        return blocks;
      }
      const before = block.text.slice(0, start).trim();
      const selected = block.text.slice(start, end).trim();
      const after = block.text.slice(end).trim();
      if (!selected) return blocks;
      const nextVoice =
        input.voice && input.voice !== book.defaultVoice ? input.voice : null;
      const rawSplitBlocks: Array<BuilderNarrationBlock | null> = [
        before
          ? {
              ...block,
              id: `${block.id}-before-${Date.now()}`,
              text: before,
              audioUrl: null,
              audioObjectKey: null,
              audioTiming: null,
            }
          : null,
        {
          ...block,
          id: `${block.id}-selected-${Date.now()}`,
          text: selected,
          voice: nextVoice,
          audioUrl: null,
          audioObjectKey: null,
          audioTiming: null,
        },
        after
          ? {
              ...block,
              id: `${block.id}-after-${Date.now()}`,
              text: after,
              audioUrl: null,
              audioObjectKey: null,
              audioTiming: null,
            }
          : null,
      ];
      const splitBlocks = rawSplitBlocks.filter(
        (item): item is BuilderNarrationBlock => item !== null,
      );
      return blocks.flatMap((item, currentIndex) =>
        currentIndex === input.blockIndex ? splitBlocks : [item],
      );
    });
  }

  function removeNarrationBlock(pageIndex: number, blockIndex: number) {
    if (!book) return;
    applyNarrationBlocks(pageIndex, (blocks) =>
      blocks.filter((_, currentBlockIndex) => currentBlockIndex !== blockIndex),
    );
  }

  function mergeNarrationBlock(pageIndex: number, blockIndex: number) {
    if (!book || blockIndex <= 0) return;
    applyNarrationBlocks(pageIndex, (blocks) => {
      const previous = blocks[blockIndex - 1];
      const current = blocks[blockIndex];
      if (!previous || !current) return blocks;
      return blocks.flatMap((block, currentIndex) => {
        if (currentIndex === blockIndex - 1) {
          return [
            {
              ...previous,
              text: `${previous.text.trim()} ${current.text.trim()}`.trim(),
              audioUrl: null,
              audioObjectKey: null,
              audioTiming: null,
            },
          ];
        }
        if (currentIndex === blockIndex) return [];
        return [block];
      });
    });
  }

  function resetNarrationBlocks(pageIndex: number) {
    if (!book) return;
    applyNarrationBlocks(pageIndex, (_blocks, localization) =>
      createDefaultNarrationBlocks(
        localization.narrationText || localization.content,
      ),
    );
  }

  function applyNarrationBlocks(
    pageIndex: number,
    updater: (
      blocks: BuilderNarrationBlock[],
      localization: BuilderPagePayload['localizations'][BuilderLanguage],
    ) => BuilderNarrationBlock[],
  ) {
    if (!book) return;
    const next = {
      ...book,
      pages: book.pages.map((page, currentPageIndex) => {
        if (currentPageIndex !== pageIndex) return page;
        const localization = page.localizations[language];
        const currentBlocks = localization.narrationBlocks.length
          ? localization.narrationBlocks
          : createDefaultNarrationBlocks(
              localization.narrationText || localization.content,
            );
        const blocks = normalizeUiNarrationBlocks(
          updater(currentBlocks, localization),
          book.defaultVoice,
        );
        const narrationText = blocks.map((block) => block.text).join('\n\n');
        return {
          ...page,
          localizations: {
            ...page.localizations,
            [language]: {
              ...localization,
              narrationText,
              narrationHtml: textToHtml(narrationText),
              audioUrl: '',
              narrationBlocks: blocks,
            },
          },
        };
      }),
    };
    updateBook(markTextDirty(next));
  }

  function addPage() {
    if (!book) return;
    insertPageAt(book.pages.length);
  }

  function insertPageAt(index: number) {
    if (!book) return;
    const safeIndex = Math.max(0, Math.min(index, book.pages.length));
    const newPage = createEmptyPage(safeIndex + 1);
    const pages = [...book.pages];
    pages.splice(safeIndex, 0, newPage);
    setCollapsedPages((current) => ({ ...current, [newPage.id]: false }));
    updateBook({
      builderPhase: 'text',
      pages: pages.map((page, pageIndex) => ({
        ...page,
        pageNumber: pageIndex + 1,
      })),
    });
  }

  function removePage(index: number) {
    if (!book) return;
    updateBook({
      builderPhase: 'text',
      pages: book.pages
        .filter((_, pageIndex) => pageIndex !== index)
        .map((page, pageIndex) => ({ ...page, pageNumber: pageIndex + 1 })),
    });
  }

  function togglePageCollapsed(pageId: string) {
    setCollapsedPages((current) => ({
      ...current,
      [pageId]: !current[pageId],
    }));
  }

  function setPageTab(pageId: string, tab: PageEditorTab) {
    setPageTabs((current) => ({ ...current, [pageId]: tab }));
  }

  function openPageReview(pageId: string) {
    setReviewPageId(pageId);
    setRevisionInstructions((current) => ({
      ...current,
      [pageId]: current[pageId] ?? '',
    }));
  }

  function toggleCharacterCollapsed(characterId: string) {
    setCollapsedCharacters((current) => ({
      ...current,
      [characterId]: !(current[characterId] ?? true),
    }));
  }

  function handleCharacterDragStart(
    event: DragEvent<HTMLElement>,
    characterId: string,
  ) {
    event.dataTransfer.setData('text/plain', characterId);
    event.dataTransfer.effectAllowed = 'copy';
  }

  function handlePageDragStart(
    event: DragEvent<HTMLElement>,
    pageId: string,
    index: number,
  ) {
    event.dataTransfer.setData(PAGE_DRAG_TYPE, String(index));
    event.dataTransfer.effectAllowed = 'move';
    setDraggingPageId(pageId);
  }

  function handlePageDragOver(event: DragEvent<HTMLElement>, pageId: string) {
    event.preventDefault();
    if (!hasPageDragData(event)) {
      event.dataTransfer.dropEffect = 'copy';
      return;
    }
    const placement = getPageDropPlacement(event);
    event.dataTransfer.dropEffect = 'move';
    setPageDropTarget((current) =>
      current?.pageId === pageId && current.placement === placement
        ? current
        : { pageId, placement },
    );
  }

  function handlePageDrop(event: DragEvent<HTMLElement>, targetIndex: number) {
    event.preventDefault();
    const draggedPageIndex = Number.parseInt(
      event.dataTransfer.getData(PAGE_DRAG_TYPE),
      10,
    );
    const placement = getPageDropPlacement(event);
    setDraggingPageId(null);
    setPageDropTarget(null);

    if (Number.isFinite(draggedPageIndex)) {
      reorderPage(draggedPageIndex, targetIndex, placement);
      return;
    }

    const characterId = event.dataTransfer.getData('text/plain');
    if (characterId) addCharacterToPage(targetIndex, characterId);
  }

  function handlePageDragEnd() {
    setDraggingPageId(null);
    setPageDropTarget(null);
  }

  function reorderPage(
    fromIndex: number,
    targetIndex: number,
    placement: 'before' | 'after',
  ) {
    if (!book || fromIndex === targetIndex) return;
    const pages = [...book.pages];
    const [movedPage] = pages.splice(fromIndex, 1);
    if (!movedPage) return;
    let insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex;
    if (fromIndex < insertIndex) insertIndex -= 1;
    if (insertIndex === fromIndex) return;
    pages.splice(
      Math.max(0, Math.min(pages.length, insertIndex)),
      0,
      movedPage,
    );
    updateBook(
      markTextDirty({
        ...book,
        pages: pages.map((page, pageIndex) => ({
          ...page,
          pageNumber: pageIndex + 1,
        })),
      }),
    );
  }

  function setPageGame(index: number, gameId: string) {
    updatePage(index, (page) => {
      if (!gameId) return { ...page, pageType: 'game', game: null };
      const game = findAvailableGame(gameId);
      if (!game) return page;
      return {
        ...page,
        pageType: 'game',
        game: ensureGameNarration({
          ...toStoryGameDescriptor(game),
          narration: page.game?.narration,
        }),
      };
    });
    updateBook({ builderPhase: 'text' });
  }

  function setPageGameEnabled(index: number, enabled: boolean) {
    updatePage(index, (page) => ({
      ...page,
      pageType: enabled ? 'game' : 'story',
      game: enabled
        ? page.game
          ? ensureGameNarration(page.game)
          : null
        : null,
    }));
    updateBook({ builderPhase: 'text' });
  }

  function updatePageGameNarration(
    index: number,
    cueId: StoryGameNarrationCueId,
    patch: { text?: string; voice?: string | null },
  ) {
    updatePage(index, (page) => {
      if (!page.game) return page;
      const game = ensureGameNarration(page.game);
      const languageNarration = game.narration?.[language] ?? {};
      const cue = languageNarration[cueId] ?? { text: '' };
      return {
        ...page,
        game: {
          ...game,
          narration: {
            ...game.narration,
            [language]: {
              ...languageNarration,
              [cueId]: {
                ...cue,
                ...patch,
                audioObjectKey: null,
                audioUrl: null,
                audioTiming: null,
              },
            },
          },
        },
      };
    });
    updateBook({ builderPhase: 'text' });
  }

  async function revisePage(index: number) {
    if (!book) return;
    const page = book.pages[index];
    if (!page) return;
    const instruction = revisionInstructions[page.id]?.trim();
    if (!instruction) {
      setIsError(true);
      setMessage('Write a page revision instruction first');
      return;
    }
    const payload = await run(
      'revise',
      () =>
        requestJson<BuilderBookPayload>(
          `/api/books/${book.id}/pages/${page.id}/revise`,
          {
            method: 'POST',
            body: JSON.stringify({ instruction }),
          },
        ),
      `Page ${page.pageNumber} revised`,
    );
    if (payload) {
      mergePayload(payload);
      setRevisionInstructions((current) => ({ ...current, [page.id]: '' }));
      setReviewPageId(null);
    }
  }

  const coverProgress = mediaProgress[coverImageKey()];
  const coverPreviewUrl = coverProgress?.imageUrl || book?.coverImageUrl || '';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="row" style={{ gap: 10 }}>
            <div className="brand-mark">
              <BookOpen size={22} weight="fill" />
            </div>
            <div>
              <h1 className="brand-title">Wonder Tales Builder</h1>
              <div className="brand-subtitle">Catalog workspace</div>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setCreateDialogOpen(true)}
            disabled={busy !== null}
            title="New story"
            aria-label="New story"
          >
            <Plus size={18} weight="bold" />
          </button>
        </div>

        <div className="book-list">
          {books.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`book-list-item ${book?.id === item.id ? 'active' : ''}`}
              onClick={() => loadBook(item.id)}
            >
              <span className="book-list-title">
                {item.localizations.en.title || item.slug}
              </span>
              <span className="meta">{item.slug}</span>
              <span className="book-list-meta">
                <span className={`badge ${item.status}`}>{item.status}</span>
                <span className="badge">{item.pageCount} pages</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        {!book ? (
          <div className="empty-state panel">
            <div className="empty-state-icon">
              <BookOpen size={28} weight="fill" />
            </div>
            <h2>No book selected</h2>
            <p>Select a draft from the catalog or create a new one.</p>
          </div>
        ) : (
          <>
            <div className="editor-header">
              <div>
                <div className="editor-kicker">
                  <span className={`badge ${book.status}`}>{book.status}</span>
                  <span className="badge">{book.pages.length} pages</span>
                </div>
                <h2 className="editor-title">{selectedTitle || book.slug}</h2>
                <div className="meta">
                  {book.slug} · updated {formatTimestamp(book.updatedAt)}
                </div>
              </div>
              <div className="toolbar">
                <button
                  type="button"
                  className="text-button"
                  onClick={saveBook}
                  disabled={busy !== null}
                >
                  <FloppyDisk size={18} weight="bold" />
                  Save
                </button>
                <span
                  className="tooltip-anchor"
                  data-tooltip={
                    publishBlockReasons.length > 0 ? publishTooltip : undefined
                  }
                >
                  <button
                    type="button"
                    className="primary-button"
                    onClick={publishBook}
                    disabled={publishBlockReasons.length > 0}
                    title={publishTooltip}
                  >
                    <RocketLaunch size={18} weight="bold" />
                    Publish
                  </button>
                </span>
                <button
                  type="button"
                  className="danger-button"
                  onClick={archiveBook}
                  disabled={busy !== null || book.status === 'archived'}
                >
                  <Archive size={18} weight="bold" />
                  Archive
                </button>
                {book.status === 'archived' ? (
                  <button
                    type="button"
                    className="danger-button"
                    onClick={deleteArchivedBook}
                    disabled={busy !== null}
                  >
                    <Trash size={18} weight="bold" />
                    Delete
                  </button>
                ) : null}
              </div>
            </div>

            {busy === 'create' || isMediaGenerating ? (
              <div className="work-banner">
                <span className="spinner" />
                <div>
                  <strong>
                    {busy === 'create'
                      ? 'Writing story draft'
                      : 'Generating images'}
                  </strong>
                  <span>
                    {busy === 'create'
                      ? 'The editor will open as soon as the text draft is ready.'
                      : 'Each image updates independently as soon as it finishes.'}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="editor-grid">
              <section className="panel">
                <h3 className="panel-title">Book</h3>
                <div className="form-grid">
                  <Field label="Slug">
                    <input
                      value={book.slug}
                      onChange={(event) =>
                        updateBook({ slug: event.currentTarget.value })
                      }
                    />
                  </Field>
                  <Field label="Default voice">
                    <select
                      value={book.defaultVoice}
                      onChange={(event) =>
                        updateDefaultVoice(event.currentTarget.value)
                      }
                    >
                      {VOICE_PRESETS.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Age min">
                    <input
                      type="number"
                      value={book.ageMin}
                      onChange={(event) =>
                        updateBook({
                          ageMin: Number(event.currentTarget.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Age max">
                    <input
                      type="number"
                      value={book.ageMax}
                      onChange={(event) =>
                        updateBook({
                          ageMax: Number(event.currentTarget.value),
                        })
                      }
                    />
                  </Field>

                  <Field label="Brief" span={4}>
                    <textarea
                      value={book.prompt}
                      onChange={(event) =>
                        updateBook(
                          markTextDirty({
                            ...book,
                            prompt: event.currentTarget.value,
                          }),
                        )
                      }
                    />
                  </Field>
                  <Field label="Style" span={4}>
                    <textarea
                      value={book.stylePrompt}
                      onChange={(event) =>
                        updateBook(
                          markImagesDirty({
                            ...book,
                            stylePrompt: event.currentTarget.value,
                            coverImageUrl: '',
                            pages: book.pages.map((page) =>
                              page.pageType === 'game'
                                ? page
                                : { ...page, imageUrl: '' },
                            ),
                          }),
                        )
                      }
                    />
                  </Field>
                </div>
              </section>

              <section className="panel">
                <div className="toolbar">
                  <h3 className="panel-title" style={{ margin: 0 }}>
                    Localization
                  </h3>
                  <div className="lang-tabs">
                    {SUPPORTED_LANGUAGES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={language === item ? 'active' : ''}
                        onClick={() => setLanguage(item)}
                      >
                        {item.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-grid" style={{ marginTop: 14 }}>
                  <Field label={`${LANGUAGE_LABELS[language]} title`} span={2}>
                    <input
                      value={book.localizations[language].title}
                      onChange={(event) =>
                        updateBookLocalization(
                          'title',
                          event.currentTarget.value,
                        )
                      }
                    />
                  </Field>
                  <Field label="Summary" span={4}>
                    <textarea
                      value={selectedSummary}
                      onChange={(event) =>
                        updateBookLocalization(
                          'summary',
                          event.currentTarget.value,
                        )
                      }
                    />
                  </Field>
                </div>
              </section>

              <section className="panel">
                <div className="panel-title-row">
                  <h3 className="panel-title">Media prompts</h3>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => generateCoverImage(book.id)}
                    disabled={
                      busy !== null ||
                      mediaLoading[coverImageKey()] ||
                      !book.coverImagePrompt
                    }
                  >
                    <ImageSquare size={18} weight="bold" />
                    {mediaLoading[coverImageKey()]
                      ? 'Cover...'
                      : 'Generate cover'}
                  </button>
                </div>
                <div className="form-grid">
                  <Field label="Default image aspect" span={2}>
                    <ImageAspectControl
                      value={book.imageAspect}
                      onChange={(imageAspect) =>
                        updateBook(
                          markImagesDirty({
                            ...book,
                            imageAspect,
                            coverImageUrl: '',
                          }),
                        )
                      }
                    />
                  </Field>
                  <Field label="Cover image prompt" span={4}>
                    <textarea
                      value={book.coverImagePrompt}
                      onChange={(event) =>
                        updateBook(
                          markImagesDirty({
                            ...book,
                            coverImagePrompt: event.currentTarget.value,
                            coverImageUrl: '',
                          }),
                        )
                      }
                    />
                  </Field>
                  <Field label="Cover characters" span={4}>
                    {book.characters.length > 0 ? (
                      <div className="cover-character-grid">
                        {book.characters.map((character) => {
                          const selected = book.coverCharacterIds.includes(
                            character.id,
                          );
                          return (
                            <button
                              key={character.id}
                              type="button"
                              className={`cover-character-option ${
                                selected ? 'selected' : ''
                              }`}
                              onClick={(event) => {
                                if (
                                  character.imageUrl &&
                                  (event.target as HTMLElement).closest(
                                    '[data-open-image]',
                                  )
                                ) {
                                  openImageModal(
                                    character.imageUrl,
                                    character.name || 'Character',
                                  );
                                  return;
                                }
                                toggleCoverCharacter(character.id);
                              }}
                              aria-pressed={selected}
                            >
                              {character.imageUrl ? (
                                <span
                                  className="character-chip-avatar"
                                  data-open-image
                                  title={`Open ${character.name || 'character'} image`}
                                  style={{
                                    backgroundImage: `url(${character.imageUrl})`,
                                  }}
                                />
                              ) : (
                                <UserCircle size={16} weight="fill" />
                              )}
                              <span>
                                {character.name.trim() || 'Unnamed character'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="hint">
                        Add characters to use them as cover references.
                      </div>
                    )}
                  </Field>
                  <Field label="Cover image URL" span={4}>
                    <input
                      value={book.coverImageUrl}
                      onChange={(event) =>
                        updateBook({ coverImageUrl: event.currentTarget.value })
                      }
                    />
                  </Field>
                </div>
              </section>

              <div className="section-header">
                <h3 className="section-title">Pages</h3>
                <button type="button" className="text-button" onClick={addPage}>
                  <Plus size={18} weight="bold" />
                  Add page
                </button>
              </div>

              <section className="pages">
                {book.pages.map((page, index) => {
                  const imageKey = pageImageKey(page.id);
                  const imageProgress = mediaProgress[imageKey];
                  const previewImageUrl =
                    imageProgress?.imageUrl || page.imageUrl;
                  const isCollapsed = collapsedPages[page.id] ?? false;
                  const activePageTab = pageTabs[page.id] ?? 'content';
                  const dropClass =
                    pageDropTarget?.pageId === page.id
                      ? `drop-${pageDropTarget.placement}`
                      : '';
                  return (
                    <Fragment key={page.id}>
                      <article
                        className={`page-card ${
                          isCollapsed ? 'collapsed' : ''
                        } ${
                          draggingPageId === page.id ? 'dragging' : ''
                        } ${dropClass}`}
                        onDragOver={(event) =>
                          handlePageDragOver(event, page.id)
                        }
                        onDragLeave={(event) => {
                          const nextTarget = event.relatedTarget;
                          if (
                            nextTarget instanceof Node &&
                            event.currentTarget.contains(nextTarget)
                          ) {
                            return;
                          }
                          setPageDropTarget((current) =>
                            current?.pageId === page.id ? null : current,
                          );
                        }}
                        onDrop={(event) => handlePageDrop(event, index)}
                        style={
                          {
                            '--page-delay': `${Math.min(index, 8) * 45}ms`,
                          } as CSSProperties
                        }
                      >
                        <div className="page-card-header">
                          <div className="page-card-title-wrap">
                            <button
                              type="button"
                              className="icon-button page-drag-handle"
                              draggable
                              onDragStart={(event) =>
                                handlePageDragStart(event, page.id, index)
                              }
                              onDragEnd={handlePageDragEnd}
                              title="Drag to reorder"
                              aria-label={`Drag page ${page.pageNumber}`}
                            >
                              <DotsSixVertical size={18} weight="bold" />
                            </button>
                            <span className="page-index-badge">
                              P{index + 1}
                            </span>
                            <div>
                              <h4 className="page-card-title">
                                Page {page.pageNumber}
                              </h4>
                              <div className="meta">
                                {page.pageType === 'game' ? (
                                  <>{page.game?.title || 'Game page'} · cues</>
                                ) : (
                                  <>
                                    Story page ·{' '}
                                    {
                                      page.localizations[language]
                                        .narrationBlocks.length
                                    }{' '}
                                    blocks
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="page-header-actions">
                            <button
                              type="button"
                              className={`icon-button page-collapse-toggle ${
                                isCollapsed ? 'collapsed' : ''
                              }`}
                              onClick={() => togglePageCollapsed(page.id)}
                              title={
                                isCollapsed ? 'Expand page' : 'Collapse page'
                              }
                              aria-label={
                                isCollapsed
                                  ? `Expand page ${page.pageNumber}`
                                  : `Collapse page ${page.pageNumber}`
                              }
                            >
                              <CaretDown size={17} weight="bold" />
                            </button>
                            <button
                              type="button"
                              className={`game-toggle ${
                                page.pageType === 'game' ? 'active' : ''
                              }`}
                              onClick={() =>
                                setPageGameEnabled(
                                  index,
                                  page.pageType !== 'game',
                                )
                              }
                              aria-pressed={page.pageType === 'game'}
                            >
                              <GameController size={16} weight="bold" />
                              Game
                              <span className="game-toggle-track">
                                <span className="game-toggle-thumb" />
                              </span>
                            </button>
                            <button
                              type="button"
                              className="text-button page-review-button"
                              onClick={() => openPageReview(page.id)}
                              disabled={busy !== null}
                              title="Review page with AI"
                            >
                              <PencilSimple size={16} weight="bold" />
                              Review
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => removePage(index)}
                              title="Remove page"
                              aria-label="Remove page"
                            >
                              <Trash size={17} weight="bold" />
                            </button>
                          </div>
                        </div>

                        {isCollapsed ? null : page.pageType === 'game' ? (
                          <div className="game-page-editor">
                            <Field label="Game" span={4}>
                              <select
                                value={page.game?.id ?? ''}
                                onChange={(event) =>
                                  setPageGame(index, event.currentTarget.value)
                                }
                              >
                                <option value="">Choose a game</option>
                                {storyGames.map((game) => (
                                  <option key={game.id} value={game.id}>
                                    {game.title}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            {page.game ? (
                              <div className="game-narration-grid">
                                {STORY_GAME_NARRATION_CUES.map((cue) => {
                                  const cueItem =
                                    page.game?.narration?.[language]?.[cue.id];
                                  const cueValue = cueItem?.text ?? '';
                                  const cueVoice = cueItem?.voice ?? '';
                                  const cueAudioUrl = cueItem?.audioUrl ?? '';
                                  const cueAudioKey = gameCueAudioKey(
                                    page.id,
                                    language,
                                    cue.id,
                                  );
                                  const isCueAudioLoading =
                                    audioLoading[cueAudioKey];
                                  return (
                                    <Field
                                      key={cue.id}
                                      label={cue.label}
                                      span={2}
                                    >
                                      <select
                                        value={cueVoice}
                                        onChange={(event) =>
                                          updatePageGameNarration(
                                            index,
                                            cue.id,
                                            {
                                              voice:
                                                event.currentTarget.value ||
                                                null,
                                            },
                                          )
                                        }
                                      >
                                        <option value="">
                                          Default ({book.defaultVoice})
                                        </option>
                                        {VOICE_PRESETS.map((voice) => (
                                          <option
                                            key={voice.id}
                                            value={voice.id}
                                          >
                                            {voice.label}
                                          </option>
                                        ))}
                                      </select>
                                      <textarea
                                        value={cueValue}
                                        placeholder={
                                          GAME_NARRATION_PLACEHOLDERS[language][
                                            cue.id
                                          ]
                                        }
                                        onChange={(event) =>
                                          updatePageGameNarration(
                                            index,
                                            cue.id,
                                            { text: event.currentTarget.value },
                                          )
                                        }
                                      />
                                      <div className="game-cue-audio-row">
                                        <button
                                          type="button"
                                          className="text-button"
                                          onClick={() =>
                                            cueAudioUrl
                                              ? playAudio(cueAudioUrl)
                                              : undefined
                                          }
                                          disabled={!cueAudioUrl}
                                        >
                                          <Play size={16} weight="fill" />
                                          Play
                                        </button>
                                        <button
                                          type="button"
                                          className="text-button"
                                          onClick={() =>
                                            generateGameCueAudio(
                                              page.id,
                                              cue.id,
                                              cue.label,
                                              page.pageNumber,
                                            )
                                          }
                                          disabled={
                                            busy !== null ||
                                            isCueAudioLoading ||
                                            !cueValue.trim()
                                          }
                                        >
                                          {isCueAudioLoading ? (
                                            <span className="spinner small" />
                                          ) : (
                                            <MicrophoneStage
                                              size={16}
                                              weight="bold"
                                            />
                                          )}
                                          {cueAudioUrl
                                            ? 'Regenerate'
                                            : 'Generate'}
                                        </button>
                                      </div>
                                    </Field>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <>
                            <div className="page-characters">
                              {page.characterIds.length > 0 ? (
                                page.characterIds.map((characterId) => {
                                  const character = book.characters.find(
                                    (item) => item.id === characterId,
                                  );
                                  return (
                                    <button
                                      key={characterId}
                                      type="button"
                                      className="character-chip"
                                      onClick={(event) => {
                                        if (
                                          character?.imageUrl &&
                                          (event.target as HTMLElement).closest(
                                            '[data-open-image]',
                                          )
                                        ) {
                                          openImageModal(
                                            character.imageUrl,
                                            character.name || characterId,
                                          );
                                          return;
                                        }
                                        removeCharacterFromPage(
                                          index,
                                          characterId,
                                        );
                                      }}
                                      title="Remove from page"
                                    >
                                      {character?.imageUrl ? (
                                        <span
                                          className="character-chip-avatar"
                                          data-open-image
                                          style={{
                                            backgroundImage: `url(${character.imageUrl})`,
                                          }}
                                          title={`Open ${character.name || characterId}`}
                                        />
                                      ) : (
                                        <UserCircle size={16} weight="fill" />
                                      )}
                                      {character?.name ?? characterId}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="drop-hint">
                                  Drag characters here for the illustration
                                  prompt
                                </div>
                              )}
                            </div>

                            <div
                              className="page-section-tabs"
                              role="tablist"
                              aria-label={`Page ${page.pageNumber} sections`}
                            >
                              {PAGE_EDITOR_TABS.map((tab) => {
                                const TabIcon = tab.icon;
                                const selected = activePageTab === tab.id;
                                return (
                                  <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    className={selected ? 'active' : ''}
                                    aria-selected={selected}
                                    onClick={() => setPageTab(page.id, tab.id)}
                                  >
                                    <TabIcon size={16} weight="bold" />
                                    {tab.label}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="page-tab-panel">
                              {activePageTab === 'content' ? (
                                <div className="form-grid">
                                  <Field label="Content" span={4}>
                                    <RichTextEditor
                                      html={
                                        page.localizations[language].contentHtml
                                      }
                                      text={
                                        page.localizations[language].content
                                      }
                                      onChange={(value) =>
                                        updatePageRichText(
                                          index,
                                          'content',
                                          value,
                                        )
                                      }
                                    />
                                  </Field>
                                </div>
                              ) : null}

                              {activePageTab === 'images' ? (
                                <div className="form-grid page-images-grid">
                                  <div
                                    className={`asset-preview ${
                                      mediaLoading[imageKey] ? 'loading' : ''
                                    }`}
                                  >
                                    {previewImageUrl ? (
                                      <button
                                        type="button"
                                        className="asset-image image-open-button"
                                        aria-label={`Page ${page.pageNumber} image`}
                                        title="Open image"
                                        onClick={() =>
                                          openImageModal(
                                            previewImageUrl,
                                            `Page ${page.pageNumber}`,
                                          )
                                        }
                                        style={{
                                          backgroundImage: `url(${previewImageUrl})`,
                                        }}
                                      />
                                    ) : (
                                      <div className="asset-empty">
                                        Page {page.pageNumber} image
                                      </div>
                                    )}
                                    {mediaLoading[imageKey] ? (
                                      <div className="asset-loading">
                                        <span className="spinner" />
                                        <span>
                                          {imageProgress?.message ??
                                            'Generating image'}
                                        </span>
                                      </div>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="text-button asset-action"
                                      onClick={() =>
                                        generatePageImage(
                                          book.id,
                                          page.id,
                                          page.pageNumber,
                                        )
                                      }
                                      disabled={
                                        busy !== null ||
                                        mediaLoading[imageKey] ||
                                        !page.imagePrompt
                                      }
                                    >
                                      <ImageSquare size={18} weight="bold" />
                                      Generate image
                                    </button>
                                  </div>
                                  <Field label="Image aspect" span={4}>
                                    <ImageAspectControl
                                      value={page.imageAspect}
                                      onChange={(imageAspect) =>
                                        updateBook(
                                          markImagesDirty({
                                            ...book,
                                            pages: book.pages.map(
                                              (current, currentIndex) =>
                                                currentIndex === index
                                                  ? {
                                                      ...current,
                                                      imageAspect,
                                                      imageUrl: '',
                                                    }
                                                  : current,
                                            ),
                                          }),
                                        )
                                      }
                                    />
                                  </Field>
                                  <Field label="Image prompt" span={4}>
                                    <textarea
                                      value={page.imagePrompt}
                                      onChange={(event) =>
                                        updateBook(
                                          markImagesDirty({
                                            ...book,
                                            pages: book.pages.map(
                                              (current, currentIndex) =>
                                                currentIndex === index
                                                  ? {
                                                      ...current,
                                                      imagePrompt:
                                                        event.currentTarget
                                                          .value,
                                                      imageUrl: '',
                                                    }
                                                  : current,
                                            ),
                                          }),
                                        )
                                      }
                                    />
                                  </Field>
                                  <Field label="Image URL" span={4}>
                                    <input
                                      value={page.imageUrl}
                                      onChange={(event) =>
                                        updatePage(index, (current) => ({
                                          ...current,
                                          imageUrl: event.currentTarget.value,
                                        }))
                                      }
                                    />
                                  </Field>
                                </div>
                              ) : null}

                              {activePageTab === 'narration' ? (
                                <div className="form-grid">
                                  <Field label="Narration sections" span={4}>
                                    <NarrationSegmentsEditor
                                      blocks={
                                        page.localizations[language]
                                          .narrationBlocks.length
                                          ? page.localizations[language]
                                              .narrationBlocks
                                          : createDefaultNarrationBlocks(
                                              page.localizations[language]
                                                .narrationText ||
                                                page.localizations[language]
                                                  .content,
                                            )
                                      }
                                      defaultVoice={book.defaultVoice}
                                      audioLoading={audioLoading}
                                      audioKey={(blockId) =>
                                        audioBlockKey(
                                          page.id,
                                          language,
                                          blockId,
                                        )
                                      }
                                      onUpdateBlock={(blockIndex, patch) =>
                                        updateNarrationBlock(
                                          index,
                                          blockIndex,
                                          patch,
                                        )
                                      }
                                      onSplit={(payload) =>
                                        splitNarrationSelection({
                                          pageIndex: index,
                                          ...payload,
                                        })
                                      }
                                      onMerge={(blockIndex) =>
                                        mergeNarrationBlock(index, blockIndex)
                                      }
                                      onRemove={(blockIndex) =>
                                        removeNarrationBlock(index, blockIndex)
                                      }
                                      onReset={() =>
                                        resetNarrationBlocks(index)
                                      }
                                      onGenerateAudio={(blockId) =>
                                        generateBlockAudio(
                                          page.id,
                                          blockId,
                                          page.pageNumber,
                                        )
                                      }
                                      onPlay={playAudio}
                                      disabled={busy !== null}
                                    />
                                  </Field>
                                  <Field label="Audio URL" span={4}>
                                    <input
                                      value={
                                        page.localizations[language].audioUrl
                                      }
                                      onChange={(event) =>
                                        updatePageLocalization(
                                          index,
                                          'audioUrl',
                                          event.currentTarget.value,
                                        )
                                      }
                                    />
                                  </Field>
                                </div>
                              ) : null}
                            </div>
                          </>
                        )}
                      </article>
                      {index < book.pages.length - 1 ? (
                        <div className="page-insert-row">
                          <span className="page-insert-line" />
                          <button
                            type="button"
                            className="page-insert-button"
                            onClick={() => insertPageAt(index + 1)}
                            title={`Add page between page ${page.pageNumber} and page ${
                              book.pages[index + 1]?.pageNumber ?? index + 2
                            }`}
                            aria-label={`Add page after page ${page.pageNumber}`}
                          >
                            <Plus size={18} weight="bold" />
                          </button>
                        </div>
                      ) : null}
                    </Fragment>
                  );
                })}
                <button
                  type="button"
                  className="add-page-full"
                  onClick={addPage}
                >
                  <Plus size={18} weight="bold" />
                  Add page
                </button>
              </section>
            </div>

            <p
              className={`status-line ${isError ? 'error-line' : ''} ${
                busy || message ? 'visible' : ''
              }`}
              role="status"
            >
              {busy ? `Working: ${busy}` : message}
            </p>
          </>
        )}
      </main>

      <aside className="inspector">
        {book ? (
          <>
            <div className="media-preview">
              <div className="media-preview-header">
                <strong>Cover</strong>
                <span className={`badge ${book.status}`}>{book.status}</span>
              </div>
              <div
                className={`cover-frame ${
                  mediaLoading[coverImageKey()] ? 'loading' : ''
                }`}
              >
                {coverPreviewUrl ? (
                  <button
                    type="button"
                    className="cover-preview image-open-button"
                    aria-label={book.localizations[language].title}
                    title="Open cover image"
                    onClick={() =>
                      openImageModal(
                        coverPreviewUrl,
                        book.localizations[language].title || 'Cover',
                      )
                    }
                    style={{ backgroundImage: `url(${coverPreviewUrl})` }}
                  />
                ) : (
                  <div className="empty-preview">No cover image</div>
                )}
                {mediaLoading[coverImageKey()] ? (
                  <div className="asset-loading">
                    <span className="spinner" />
                    <span>{coverProgress?.message ?? 'Generating cover'}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <section
              className="panel character-panel"
              style={{ marginTop: 16 }}
            >
              <div className="section-header compact">
                <h3 className="panel-title">Characters</h3>
                <button
                  type="button"
                  className="text-button"
                  onClick={addCharacter}
                >
                  <Plus size={16} weight="bold" />
                  Add
                </button>
              </div>
              {book.characters.length > 0 ? (
                <ul className="character-list">
                  {book.characters.map((character) => {
                    const isCharacterCollapsed =
                      collapsedCharacters[character.id] ?? true;
                    const characterMediaKey = characterImageKey(character.id);
                    const characterProgress = mediaProgress[characterMediaKey];
                    const characterPreviewUrl =
                      characterProgress?.imageUrl || character.imageUrl;
                    const isCharacterImageLoading =
                      mediaLoading[characterMediaKey];
                    return (
                      <li
                        key={character.id}
                        className={`character-card ${
                          isCharacterCollapsed ? 'collapsed' : 'expanded'
                        }`}
                        draggable={isCharacterCollapsed}
                        onDragStart={(event) => {
                          if (!isCharacterCollapsed) {
                            event.preventDefault();
                            return;
                          }
                          handleCharacterDragStart(event, character.id);
                        }}
                      >
                        <div className="character-card-head">
                          <button
                            type="button"
                            className="character-summary-button"
                            onClick={(event) => {
                              if (
                                characterPreviewUrl &&
                                (event.target as HTMLElement).closest(
                                  '[data-open-image]',
                                )
                              ) {
                                openImageModal(
                                  characterPreviewUrl,
                                  character.name || 'Character',
                                );
                                return;
                              }
                              toggleCharacterCollapsed(character.id);
                            }}
                            aria-expanded={!isCharacterCollapsed}
                          >
                            {characterPreviewUrl ? (
                              <span
                                className="character-avatar"
                                data-open-image
                                style={{
                                  backgroundImage: `url(${characterPreviewUrl})`,
                                }}
                                title={`Open ${character.name || 'character'} image`}
                              >
                                {isCharacterImageLoading ? (
                                  <span className="spinner small" />
                                ) : null}
                              </span>
                            ) : (
                              <span className="character-avatar empty">
                                {isCharacterImageLoading ? (
                                  <span className="spinner small" />
                                ) : (
                                  <UserCircle size={25} weight="fill" />
                                )}
                              </span>
                            )}
                            <span className="character-summary-copy">
                              <strong>
                                {character.name.trim() || 'Unnamed character'}
                              </strong>
                              {!isCharacterCollapsed && character.role ? (
                                <small>{character.role}</small>
                              ) : null}
                            </span>
                            {isCharacterCollapsed ? (
                              <span className="character-drag-cue">
                                <DotsSixVertical size={17} weight="bold" />
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            className={`icon-button character-collapse-toggle ${
                              isCharacterCollapsed ? 'collapsed' : ''
                            }`}
                            onClick={() =>
                              toggleCharacterCollapsed(character.id)
                            }
                            title={
                              isCharacterCollapsed
                                ? 'Expand character'
                                : 'Collapse character'
                            }
                            aria-label={
                              isCharacterCollapsed
                                ? `Expand ${character.name || 'character'}`
                                : `Collapse ${character.name || 'character'}`
                            }
                          >
                            <CaretDown size={16} weight="bold" />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => removeCharacter(character.id)}
                            title="Remove character"
                            aria-label="Remove character"
                          >
                            <Trash size={15} weight="bold" />
                          </button>
                        </div>
                        {isCharacterCollapsed ? null : (
                          <div className="character-edit-fields">
                            <input
                              value={character.name}
                              placeholder="Name"
                              onChange={(event) =>
                                updateCharacter(character.id, {
                                  name: event.currentTarget.value,
                                })
                              }
                            />
                            <input
                              value={character.role}
                              placeholder="Role or type"
                              onChange={(event) =>
                                updateCharacter(character.id, {
                                  role: event.currentTarget.value,
                                })
                              }
                            />
                            <input
                              value={character.imageUrl}
                              placeholder="Image URL"
                              onChange={(event) =>
                                updateCharacter(character.id, {
                                  imageUrl: event.currentTarget.value,
                                })
                              }
                            />
                            <div className="character-image-actions">
                              <button
                                type="button"
                                className="text-button"
                                onClick={() =>
                                  generateCharacterImage(character.id)
                                }
                                disabled={
                                  busy !== null ||
                                  isCharacterImageLoading ||
                                  !character.name.trim()
                                }
                              >
                                {isCharacterImageLoading ? (
                                  <span className="spinner small" />
                                ) : (
                                  <ImageSquare size={16} weight="bold" />
                                )}
                                {character.imageUrl
                                  ? 'Regenerate image'
                                  : 'Generate image'}
                              </button>
                              {characterProgress?.message ? (
                                <span className="hint">
                                  {characterProgress.message}
                                </span>
                              ) : null}
                            </div>
                            <textarea
                              value={character.appearance}
                              placeholder="Clothing, colors, materials, silhouette"
                              onChange={(event) =>
                                updateCharacter(character.id, {
                                  appearance: event.currentTarget.value,
                                })
                              }
                            />
                            <textarea
                              value={character.details}
                              placeholder="Personality, continuity notes, props"
                              onChange={(event) =>
                                updateCharacter(character.id, {
                                  details: event.currentTarget.value,
                                })
                              }
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="hint">
                  Add a character and drag it onto pages that should include it.
                </div>
              )}
            </section>

            <section className="panel" style={{ marginTop: 16 }}>
              <h3 className="panel-title">Games</h3>
              {pagesWithGames.length > 0 ? (
                <div className="book-list-meta">
                  {pagesWithGames.map((page) => (
                    <span key={page.id} className="badge">
                      <GameController size={13} weight="bold" /> p
                      {page.pageNumber} {page.game?.title}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="hint">No game pages</div>
              )}
            </section>

            <section className="panel" style={{ marginTop: 16 }}>
              <h3 className="panel-title">Publication</h3>
              <div className="stat-grid">
                <div className="stat-tile">
                  <span>Pages</span>
                  <strong>{book.pages.length}</strong>
                </div>
                <div className="stat-tile">
                  <span>Audio</span>
                  <strong>
                    {
                      book.pages
                        .flatMap((page) =>
                          SUPPORTED_LANGUAGES.flatMap((item) =>
                            page.localizations[item].narrationBlocks.map(
                              (block) => block.audioUrl,
                            ),
                          ),
                        )
                        .filter(Boolean).length
                    }
                  </strong>
                </div>
                <div className="stat-tile">
                  <span>Voice</span>
                  <strong>{book.defaultVoice}</strong>
                </div>
              </div>
              <div className="meta">
                Published:{' '}
                {book.publishedAt
                  ? formatTimestamp(book.publishedAt)
                  : 'not published'}
              </div>
              <div className="meta" style={{ marginTop: 6 }}>
                Languages: {SUPPORTED_LANGUAGES.join(', ')}
              </div>
            </section>
          </>
        ) : null}
      </aside>

      {createDialogOpen ? (
        <div className="modal-backdrop">
          <form
            className="review-modal brief-modal"
            onSubmit={(event) => {
              event.preventDefault();
              void createBook();
            }}
          >
            <div className="review-modal-header">
              <div>
                <span className="modal-kicker">New story</span>
                <h3>Story brief</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setCreateDialogOpen(false)}
                disabled={busy === 'create'}
                title="Close"
                aria-label="Close"
              >
                <X size={17} weight="bold" />
              </button>
            </div>
            <Field label="Brief" span={4}>
              <textarea
                value={newStoryBrief}
                placeholder="Little Red Riding Hood in a moonlit forest, with a shape game about matching safe paths."
                onChange={(event) =>
                  setNewStoryBrief(event.currentTarget.value)
                }
                disabled={busy === 'create'}
              />
            </Field>
            <div className="review-modal-actions">
              <button
                type="button"
                className="text-button subtle"
                onClick={() => setCreateDialogOpen(false)}
                disabled={busy === 'create'}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-button primary"
                disabled={busy !== null || !newStoryBrief.trim()}
              >
                <MagicWand size={18} weight="bold" />
                {busy === 'create' ? 'Writing...' : 'Generate story'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {reviewPageContext ? (
        <div className="modal-backdrop">
          <form
            className="review-modal"
            onSubmit={(event) => {
              event.preventDefault();
              void revisePage(reviewPageContext.pageIndex);
            }}
          >
            <div className="review-modal-header">
              <div>
                <span className="modal-kicker">
                  Page {reviewPageContext.page.pageNumber}
                </span>
                <h3>Review page with AI</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setReviewPageId(null)}
                title="Close review"
                aria-label="Close review"
              >
                <X size={17} weight="bold" />
              </button>
            </div>
            <Field label="Feedback for this revision" span={4}>
              <textarea
                value={revisionInstructions[reviewPageContext.page.id] ?? ''}
                placeholder="Explain what should change on this page, including tone, pacing, game fit, or narration details."
                onChange={(event) =>
                  setRevisionInstructions((current) => ({
                    ...current,
                    [reviewPageContext.page.id]: event.currentTarget.value,
                  }))
                }
              />
            </Field>
            <div className="review-modal-actions">
              <button
                type="button"
                className="text-button subtle"
                onClick={() => setReviewPageId(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-button primary"
                disabled={
                  busy !== null ||
                  !revisionInstructions[reviewPageContext.page.id]?.trim()
                }
              >
                <MagicWand size={18} weight="bold" />
                Send to AI
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {imageModal ? (
        <div
          className="image-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={imageModal.title}
          onClick={(event) => {
            if (event.target === event.currentTarget) setImageModal(null);
          }}
        >
          <div className="image-modal">
            <div className="image-modal-header">
              <strong>{imageModal.title}</strong>
              <button
                type="button"
                className="icon-button"
                onClick={() => setImageModal(null)}
                title="Close image"
                aria-label="Close image"
              >
                <X size={17} weight="bold" />
              </button>
            </div>
            <div
              className="image-modal-art"
              role="img"
              aria-label={imageModal.title}
              style={{ backgroundImage: `url(${imageModal.url})` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  span,
  children,
}: {
  label: string;
  span?: 2 | 4;
  children: React.ReactNode;
}) {
  return (
    <div className={`field ${span ? `span-${span}` : ''}`}>
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

function ImageAspectControl({
  value,
  onChange,
}: {
  value: BuilderImageAspect;
  onChange: (value: BuilderImageAspect) => void;
}) {
  const normalizedValue = IMAGE_ASPECT_OPTIONS.some(
    (option) => option.id === value,
  )
    ? value
    : DEFAULT_IMAGE_ASPECT;

  return (
    <fieldset className="image-aspect-control">
      <legend className="visually-hidden">Image aspect</legend>
      {IMAGE_ASPECT_OPTIONS.map((option) => {
        const Icon = IMAGE_ASPECT_ICONS[option.id];
        const selected = normalizedValue === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={selected ? 'active' : ''}
            aria-pressed={selected}
            title={`${option.label}: ${option.description} (${option.size})`}
            onClick={() => onChange(option.id)}
          >
            <Icon size={17} weight="bold" />
            <span>{option.label}</span>
            <small>{option.description}</small>
          </button>
        );
      })}
    </fieldset>
  );
}

function RichTextEditor({
  html,
  text,
  onChange,
}: {
  html: string;
  text: string;
  onChange: (value: { html: string; text: string }) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastHtmlRef = useRef('');

  useEffect(() => {
    const nextHtml = html || textToHtml(text);
    if (editorRef.current && nextHtml !== lastHtmlRef.current) {
      editorRef.current.innerHTML = nextHtml;
      lastHtmlRef.current = nextHtml;
    }
  }, [html, text]);

  function emitChange() {
    const element = editorRef.current;
    if (!element) return;
    const nextHtml = element.innerHTML;
    lastHtmlRef.current = nextHtml;
    onChange({
      html: nextHtml,
      text: element.innerText.replace(/\n{3,}/g, '\n\n').trim(),
    });
  }

  function runCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emitChange();
  }

  return (
    <div className="rich-editor">
      <div className="rich-toolbar">
        <button type="button" onClick={() => runCommand('bold')}>
          B
        </button>
        <button type="button" onClick={() => runCommand('italic')}>
          I
        </button>
        <button type="button" onClick={() => runCommand('formatBlock', 'p')}>
          P
        </button>
        <button
          type="button"
          onClick={() => runCommand('formatBlock', 'blockquote')}
        >
          Quote
        </button>
        <button type="button" onClick={() => runCommand('insertUnorderedList')}>
          List
        </button>
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: contentEditable is the editable rich text surface; textarea cannot preserve inline formatting. */}
      <div
        ref={editorRef}
        className="rich-surface"
        role="textbox"
        aria-multiline="true"
        tabIndex={0}
        contentEditable
        suppressContentEditableWarning
        onBlur={emitChange}
        onInput={emitChange}
        onPaste={(event) => {
          event.preventDefault();
          const pasted = event.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, pasted);
          emitChange();
        }}
      />
    </div>
  );
}

function NarrationSegmentsEditor({
  blocks,
  defaultVoice,
  audioLoading,
  audioKey,
  onUpdateBlock,
  onSplit,
  onMerge,
  onRemove,
  onReset,
  onGenerateAudio,
  onPlay,
  disabled,
}: {
  blocks: BuilderNarrationBlock[];
  defaultVoice: string;
  audioLoading: Record<string, boolean>;
  audioKey: (blockId: string) => string;
  onUpdateBlock: (
    blockIndex: number,
    patch: Partial<BuilderNarrationBlock>,
  ) => void;
  onSplit: (payload: {
    blockIndex: number;
    selectionStart: number;
    selectionEnd: number;
    voice: string;
  }) => void;
  onMerge: (blockIndex: number) => void;
  onRemove: (blockIndex: number) => void;
  onReset: () => void;
  onGenerateAudio: (blockId: string) => void;
  onPlay: (url: string) => void;
  disabled: boolean;
}) {
  const [splitVoice, setSplitVoice] = useState(defaultVoice);
  const selectionRef = useRef<
    Record<string, { selectionStart: number; selectionEnd: number }>
  >({});

  useEffect(() => {
    setSplitVoice(defaultVoice);
  }, [defaultVoice]);

  return (
    <div className="narration-sections">
      <div className="narration-toolbar">
        <select
          value={splitVoice}
          onChange={(event) => setSplitVoice(event.currentTarget.value)}
        >
          {VOICE_PRESETS.map((voice) => (
            <option key={voice.id} value={voice.id}>
              Split selection as {voice.label}
            </option>
          ))}
        </select>
        <button type="button" className="text-button" onClick={onReset}>
          Reset from text
        </button>
      </div>

      {blocks.map((block, blockIndex) => {
        const voiceId = block.voice || defaultVoice;
        const preset = VOICE_PRESETS.find((voice) => voice.id === voiceId);
        const isLoading = audioLoading[audioKey(block.id)];
        const colors = narratorColors(voiceId);
        return (
          <section
            key={block.id}
            className="narration-section"
            style={
              {
                '--narrator-color': colors.color,
                '--narrator-soft': colors.soft,
              } as CSSProperties
            }
          >
            <div className="narration-section-head">
              <span className="narrator-pill">{preset?.label ?? voiceId}</span>
              <select
                value={block.voice ?? ''}
                onChange={(event) =>
                  onUpdateBlock(blockIndex, {
                    voice: event.currentTarget.value || null,
                  })
                }
              >
                <option value="">Default ({defaultVoice})</option>
                {VOICE_PRESETS.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={block.text}
              onSelect={(event) => {
                selectionRef.current[block.id] = {
                  selectionStart: event.currentTarget.selectionStart,
                  selectionEnd: event.currentTarget.selectionEnd,
                };
              }}
              onChange={(event) =>
                onUpdateBlock(blockIndex, { text: event.currentTarget.value })
              }
            />
            <div className="narration-section-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  const selection = selectionRef.current[block.id] ?? {
                    selectionStart: 0,
                    selectionEnd: 0,
                  };
                  onSplit({
                    blockIndex,
                    selectionStart: selection.selectionStart,
                    selectionEnd: selection.selectionEnd,
                    voice: splitVoice,
                  });
                }}
              >
                Split selection
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => onMerge(blockIndex)}
                disabled={blockIndex === 0}
              >
                Merge previous
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  block.audioUrl ? onPlay(block.audioUrl) : undefined
                }
                disabled={!block.audioUrl}
              >
                <Play size={16} weight="fill" />
                Play
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => onGenerateAudio(block.id)}
                disabled={disabled || isLoading || !block.text.trim()}
              >
                {isLoading ? (
                  <span className="spinner small" />
                ) : (
                  <MicrophoneStage size={16} weight="bold" />
                )}
                {block.audioUrl ? 'Regenerate' : 'Generate'}
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => onRemove(blockIndex)}
                title="Remove section"
                aria-label="Remove section"
              >
                <Trash size={16} weight="bold" />
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

async function requestEventStream<T>(
  url: string,
  init: RequestInit,
  onEvent: (event: string, data: unknown) => void,
): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      accept: 'text/event-stream',
      ...init.headers,
    },
  });

  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Request failed with ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completePayload: T | null = null;

  function processBuffer(flush: boolean) {
    if (flush && buffer.trim()) buffer += '\n\n';
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
      if (!rawEvent.trim()) continue;

      const parsed = parseEventStreamMessage(rawEvent);
      if (!parsed) continue;
      if (parsed.event === 'error') {
        throw new Error(readStreamError(parsed.data));
      }
      if (parsed.event === 'complete') {
        completePayload = parsed.data as T;
      } else {
        onEvent(parsed.event, parsed.data);
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    processBuffer(false);
  }
  buffer += decoder.decode().replace(/\r\n/g, '\n');
  processBuffer(true);

  if (!completePayload) {
    throw new Error('Image stream closed before completion');
  }
  return completePayload;
}

function parseEventStreamMessage(
  rawEvent: string,
): { event: string; data: unknown } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of rawEvent.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }
  const dataText = dataLines.join('\n');
  return {
    event,
    data: dataText ? (JSON.parse(dataText) as unknown) : null,
  };
}

function readStreamError(data: unknown): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const error = (data as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) return error;
  }
  return 'Image stream failed';
}

function readStreamMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object' || !('message' in data)) return null;
  const message = (data as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

function readImagePartial(
  data: unknown,
): { imageUrl: string; index: number } | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as { imageUrl?: unknown; index?: unknown };
  if (typeof raw.imageUrl !== 'string' || !raw.imageUrl) return null;
  return {
    imageUrl: raw.imageUrl,
    index: typeof raw.index === 'number' ? raw.index : 0,
  };
}

function hasPageDragData(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes(PAGE_DRAG_TYPE);
}

function getPageDropPlacement(
  event: DragEvent<HTMLElement>,
): 'before' | 'after' {
  const bounds = event.currentTarget.getBoundingClientRect();
  return event.clientY > bounds.top + bounds.height / 2 ? 'after' : 'before';
}

function coverImageKey(): string {
  return 'cover:image';
}

function pageImageKey(pageId: string): string {
  return `page:${pageId}:image`;
}

function characterImageKey(characterId: string): string {
  return `character:${characterId}:image`;
}

function audioBlockKey(
  pageId: string,
  language: BuilderLanguage,
  blockId: string,
): string {
  return `page:${pageId}:audio:${language}:${blockId}`;
}

function gameCueAudioKey(
  pageId: string,
  language: BuilderLanguage,
  cueId: StoryGameNarrationCueId,
): string {
  return `page:${pageId}:game-audio:${language}:${cueId}`;
}

function remapPageState<T>(
  state: Record<string, T>,
  previousBook: BuilderBookPayload,
  nextBook: BuilderBookPayload,
): Record<string, T> {
  const nextPageIds = new Set(nextBook.pages.map((page) => page.id));
  return Object.fromEntries(
    Object.entries(state).flatMap(([pageId, value]) => {
      if (nextPageIds.has(pageId)) return [[pageId, value]];
      const nextPageId = remapPageId(pageId, previousBook, nextBook);
      return nextPageId ? [[nextPageId, value]] : [];
    }),
  );
}

function remapPageId(
  pageId: string | null,
  previousBook: BuilderBookPayload,
  nextBook: BuilderBookPayload,
): string | null {
  if (!pageId) return null;
  if (nextBook.pages.some((page) => page.id === pageId)) return pageId;
  const previousPage = previousBook.pages.find((page) => page.id === pageId);
  if (!previousPage) return null;
  return (
    nextBook.pages.find((page) => page.pageNumber === previousPage.pageNumber)
      ?.id ?? null
  );
}

function toSummary(book: BuilderBookPayload): BuilderBookSummary {
  return {
    id: book.id,
    slug: book.slug,
    status: book.status,
    builderPhase: book.builderPhase,
    coverImageUrl: book.coverImageUrl,
    publishedAt: book.publishedAt,
    updatedAt: book.updatedAt,
    localizations: book.localizations,
    pageCount: book.pages.length,
  };
}

function createEmptyPage(pageNumber: number): BuilderPagePayload {
  return {
    id: `new-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
    pageNumber,
    pageType: 'story',
    imageAspect: DEFAULT_IMAGE_ASPECT,
    imagePrompt: '',
    imageUrl: '',
    characterIds: [],
    game: null,
    localizations: Object.fromEntries(
      SUPPORTED_LANGUAGES.map((language) => [
        language,
        {
          content: '',
          contentHtml: '',
          narrationText: '',
          narrationHtml: '',
          narrationBlocks: [],
          audioUrl: '',
        },
      ]),
    ) as unknown as BuilderPagePayload['localizations'],
  };
}

function ensureGameNarration(game: StoryGameDescriptor): StoryGameDescriptor {
  const narration = { ...(game.narration ?? {}) };
  for (const language of SUPPORTED_LANGUAGES) {
    const languageNarration = { ...(narration[language] ?? {}) };
    for (const cue of STORY_GAME_NARRATION_CUES) {
      const existing = languageNarration[cue.id];
      languageNarration[cue.id] = {
        text:
          existing !== undefined
            ? existing.text
            : GAME_NARRATION_PLACEHOLDERS[language][cue.id],
        voice: existing?.voice ?? null,
        audioUrl: existing?.audioUrl ?? null,
        audioObjectKey: existing?.audioObjectKey ?? null,
        audioTiming: existing?.audioTiming ?? null,
      };
    }
    narration[language] = languageNarration;
  }
  return { ...game, narration };
}

function createDefaultNarrationBlocks(text: string): BuilderNarrationBlock[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return [
    {
      id: 'block-1',
      kind: 'narration',
      text: trimmed,
      voice: null,
      speaker: null,
      audioUrl: null,
      audioObjectKey: null,
      audioTiming: null,
    },
  ];
}

function normalizeUiNarrationBlocks(
  blocks: BuilderNarrationBlock[],
  defaultVoice: string,
): BuilderNarrationBlock[] {
  const normalized = blocks
    .map((block, index) => ({
      ...block,
      id: block.id || `block-${index + 1}-${Date.now()}`,
      kind: block.kind || 'narration',
      text: block.text,
      voice: block.voice && block.voice !== defaultVoice ? block.voice : null,
      speaker: block.speaker || null,
      audioUrl: block.audioUrl || null,
      audioObjectKey: block.audioObjectKey || null,
      audioTiming: block.audioUrl ? (block.audioTiming ?? null) : null,
    }))
    .filter((block) => block.text.trim().length > 0);
  return normalized.length ? normalized : createDefaultNarrationBlocks('');
}

function narratorColors(voiceId: string): { color: string; soft: string } {
  const palette: Record<string, { color: string; soft: string }> = {
    sparkle: { color: '#2f7d57', soft: 'rgba(47, 125, 87, 0.1)' },
    breeze: { color: '#2563eb', soft: 'rgba(37, 99, 235, 0.1)' },
    star: { color: '#a83367', soft: 'rgba(168, 51, 103, 0.11)' },
    firework: { color: '#a15c07', soft: 'rgba(161, 92, 7, 0.12)' },
    thunder: { color: '#4b5563', soft: 'rgba(75, 85, 99, 0.12)' },
    noble: { color: '#7c3aed', soft: 'rgba(124, 58, 237, 0.1)' },
  };
  return palette[voiceId] ?? palette.sparkle;
}

function getPublishBlockReasons(
  book: BuilderBookPayload,
  state: {
    busy: BusyAction | null;
    isAudioGenerating: boolean;
    isMediaGenerating: boolean;
  },
): string[] {
  const reasons: string[] = [];

  if (state.busy) {
    reasons.push(`Finish ${busyActionLabel(state.busy)} first.`);
  }
  if (state.isMediaGenerating) {
    reasons.push('Image generation is still running.');
  }
  if (state.isAudioGenerating) {
    reasons.push('Audio generation is still running.');
  }
  if (book.status === 'published') {
    reasons.push('This story is already published.');
  }
  if (book.status === 'archived') {
    reasons.push('Archived stories cannot be published.');
  }
  if (!book.localizations.en.title.trim()) {
    reasons.push('English title is required.');
  }
  if (book.pages.length === 0) {
    reasons.push('At least one page is required.');
  }

  if (book.coverImagePrompt.trim() && !book.coverImageUrl) {
    reasons.push('Cover image is missing.');
  }

  for (const page of book.pages) {
    if (page.pageType === 'game') {
      if (!page.game) {
        reasons.push(`Page ${page.pageNumber} is missing a game.`);
        continue;
      }
      for (const language of PUBLISH_REQUIRED_LANGUAGES) {
        for (const cue of STORY_GAME_NARRATION_CUES) {
          const item = page.game.narration?.[language]?.[cue.id];
          const text = item?.text.trim() ?? '';
          if (!text) {
            reasons.push(
              `Page ${page.pageNumber} game is missing ${LANGUAGE_LABELS[language]} ${cue.label}.`,
            );
          } else if (!item?.audioUrl) {
            reasons.push(
              `Page ${page.pageNumber} game is missing ${LANGUAGE_LABELS[language]} ${cue.label} audio.`,
            );
          }
        }
      }
      continue;
    }

    if (!page.localizations.en.content.trim()) {
      reasons.push(`Page ${page.pageNumber} is missing English content.`);
    }
    if (!page.imageUrl.trim()) {
      reasons.push(`Page ${page.pageNumber} image is missing.`);
    }
    for (const language of PUBLISH_REQUIRED_LANGUAGES) {
      const localization = page.localizations[language];
      const blocks = localization.narrationBlocks.length
        ? localization.narrationBlocks
        : createDefaultNarrationBlocks(
            localization.narrationText || localization.content,
          );
      const narratedBlocks = blocks.filter((block) => block.text.trim());
      if (narratedBlocks.length === 0) {
        reasons.push(
          `Page ${page.pageNumber} ${LANGUAGE_LABELS[language]} narration is missing.`,
        );
        continue;
      }
      if (narratedBlocks.some((block) => !block.audioUrl?.trim())) {
        reasons.push(
          `Page ${page.pageNumber} ${LANGUAGE_LABELS[language]} narration audio is missing.`,
        );
      }
    }
  }

  return limitPublishReasons(reasons);
}

function busyActionLabel(action: BusyAction): string {
  const labels = {
    archive: 'archiving',
    create: 'creating the story',
    delete: 'deleting',
    load: 'loading',
    publish: 'publishing',
    revise: 'revising',
    save: 'saving',
  } satisfies Record<BusyAction, string>;
  return labels[action];
}

function limitPublishReasons(reasons: string[]): string[] {
  const uniqueReasons = Array.from(new Set(reasons));
  const maxVisibleReasons = 10;
  if (uniqueReasons.length <= maxVisibleReasons) return uniqueReasons;
  return [
    ...uniqueReasons.slice(0, maxVisibleReasons),
    `${uniqueReasons.length - maxVisibleReasons} more issue(s) not shown.`,
  ];
}

function uniqueCharacterId(
  characters: BuilderCharacter[],
  baseName: string,
): string {
  const base = slugify(baseName) || 'character';
  let candidate = base;
  let suffix = 2;
  const existing = new Set(characters.map((character) => character.id));
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function textToHtml(value: string): string {
  const escaped = value
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    ? escaped
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
        .join('')
    : '';
}

function mapPageLocalizations(
  page: BuilderPagePayload,
  mapper: (
    localization: BuilderPagePayload['localizations'][BuilderLanguage],
    language: BuilderLanguage,
  ) => BuilderPagePayload['localizations'][BuilderLanguage],
): BuilderPagePayload['localizations'] {
  return Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [
      language,
      mapper(page.localizations[language], language),
    ]),
  ) as BuilderPagePayload['localizations'];
}

function formatTimestamp(value: string): string {
  return value.replace('T', ' ').slice(0, 16);
}
