import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Status } from '@/lib/db/schema';

export const STATUS_LABELS: Record<Status, string> = {
  plan: 'Plan to Watch',
  watching: 'Watching',
  completed: 'Completed',
  dropped: 'Dropped',
  on_hold: 'On Hold',
};

const STATUS_STYLES: Record<Status, string> = {
  plan: 'bg-zinc-700 text-zinc-100 hover:bg-zinc-700',
  watching: 'bg-violet-600 text-white hover:bg-violet-600',
  completed: 'bg-emerald-600 text-white hover:bg-emerald-600',
  dropped: 'bg-rose-700 text-white hover:bg-rose-700',
  on_hold: 'bg-amber-600 text-white hover:bg-amber-600',
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge variant="secondary" className={cn(STATUS_STYLES[status], 'border-transparent', className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
