import { SharesView } from '@/components/shares/SharesView';

export default function SharesPage() {
  return (
    <div className="px-6 py-8 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">My shares</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every share link you&rsquo;ve created. See reactions, revoke, or
          re-snapshot to refresh what recipients see.
        </p>
      </div>
      <SharesView />
    </div>
  );
}
