import type { AnimeCacheRow, EntryRow, ListRow } from './db/schema';

export interface AnimeView extends Omit<AnimeCacheRow, 'genres'> {
  genres: string[];
}

export interface EntryWithAnime {
  entry: EntryRow;
  anime: AnimeView;
  listIds: string[];
}

export interface ListWithCount {
  list: ListRow;
  entryCount: number;
}

export interface ListWithMembers {
  list: ListRow;
  members: EntryWithAnime[];
}
