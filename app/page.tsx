import { AddAnimeDialog } from '@/components/rolodex/AddAnimeDialog';
import { LibraryView } from '@/components/rolodex/LibraryView';

export default function HomePage() {
  return (
    <div className="px-6 py-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything you&rsquo;re tracking, in one place.
          </p>
        </div>
        <AddAnimeDialog />
      </div>
      <LibraryView />
    </div>
  );
}
