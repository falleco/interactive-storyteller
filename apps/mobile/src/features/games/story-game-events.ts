type StoryGameSessionKeyInput = {
  bookId: string;
  gameId: string;
  pageId: string;
};

export function buildStoryGameSessionKey({
  bookId,
  gameId,
  pageId,
}: StoryGameSessionKeyInput) {
  return `${bookId}:${pageId}:${gameId}`;
}
