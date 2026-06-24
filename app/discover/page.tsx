import { DiscoverView } from '@/components/discover/DiscoverView';

export default function DiscoverPage() {
  return (
    <div className="px-6 py-8 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suggestions drawn from what you&rsquo;ve rated highly — and what fans of
          those titles reach for next.
        </p>
      </div>
      <DiscoverView />
    </div>
  );
}
