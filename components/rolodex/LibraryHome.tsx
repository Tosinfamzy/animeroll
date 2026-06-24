import { AddAnimeDialog } from '@/components/rolodex/AddAnimeDialog';
import { ImportLibraryDialog } from '@/components/rolodex/ImportLibraryDialog';
import { LibraryView } from '@/components/rolodex/LibraryView';

export function LibraryHome() {
  return (
    <div className="px-6 py-8 max-w-7xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything you&rsquo;re tracking, in one place.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ImportLibraryDialog source="mal" />
          <ImportLibraryDialog source="anilist" />
          <AddAnimeDialog />
        </div>
      </div>
      <LibraryView />
    </div>
  );
}
