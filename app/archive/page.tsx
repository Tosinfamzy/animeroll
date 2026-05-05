import { LibraryView } from '@/components/rolodex/LibraryView';

export default function ArchivePage() {
  return (
    <div className="px-6 py-8 max-w-7xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Archive</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Entries you&rsquo;ve set aside. Unarchive any of them to bring them back.
        </p>
      </div>
      <LibraryView archived />
    </div>
  );
}
