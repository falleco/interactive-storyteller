import { describe, expect, it } from 'vitest';
import { chunkNoteStatuses } from '../rhythm-layout';

describe('chunkNoteStatuses', () => {
  it('splits items into equally sized chunks', () => {
    // given
    const items = [1, 2, 3, 4, 5, 6];

    // when
    const result = chunkNoteStatuses(items, 2);

    // then
    expect(result).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('leaves a shorter chunk when items do not divide evenly', () => {
    // given
    const items = ['a', 'b', 'c', 'd', 'e'];

    // when
    const result = chunkNoteStatuses(items, 3);

    // then
    expect(result).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ]);
  });

  it('throws when size is zero or negative', () => {
    // given
    const items = [1, 2];

    // when
    const call = () => chunkNoteStatuses(items, 0);

    // then
    expect(call).toThrowError(
      /greater than zero/,
    );
  });
});
