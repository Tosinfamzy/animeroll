import { ListsView } from '@/components/lists/ListsView';

export default function ListsPage() {
  return (
    <div className="px-6 py-8 max-w-7xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Lists</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Curate groupings of entries: rotations, top-tens, recommendations for friends.
        </p>
      </div>
      <ListsView />
    </div>
  );
}
