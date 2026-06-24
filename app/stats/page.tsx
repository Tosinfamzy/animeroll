import { StatsView } from '@/components/stats/StatsView';

export default function StatsPage() {
  return (
    <div className="px-6 py-8 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A look at your library — how you watch, what you reach for, and how your
          scores compare to the crowd.
        </p>
      </div>
      <StatsView />
    </div>
  );
}
