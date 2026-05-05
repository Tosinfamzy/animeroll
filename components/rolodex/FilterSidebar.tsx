'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { STATUSES, type Status } from '@/lib/db/schema';
import {
  isFilterEmpty,
  LENGTH_BUCKETS,
  LENGTH_BUCKET_LABELS,
  type EntryFilter,
  type LengthBucket,
} from '@/lib/filters';
import { cn } from '@/lib/utils';
import { STATUS_LABELS } from './StatusBadge';

interface Props {
  filter: EntryFilter;
  onChange: (f: EntryFilter) => void;
  availableGenres: string[];
}

export function FilterSidebar({ filter, onChange, availableGenres }: Props) {
  const activeCount = countActive(filter);

  const toggleStatus = (s: Status) =>
    onChange({
      ...filter,
      status: filter.status?.includes(s)
        ? filter.status.filter((x) => x !== s)
        : [...(filter.status ?? []), s],
    });
  const toggleLength = (b: LengthBucket) =>
    onChange({
      ...filter,
      lengthBuckets: filter.lengthBuckets?.includes(b)
        ? filter.lengthBuckets.filter((x) => x !== b)
        : [...(filter.lengthBuckets ?? []), b],
    });
  const toggleGenre = (g: string) =>
    onChange({
      ...filter,
      genres: filter.genres?.includes(g)
        ? filter.genres.filter((x) => x !== g)
        : [...(filter.genres ?? []), g],
    });
  const numberOrUndefined = (v: string): number | undefined => {
    if (v === '') return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  };

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline">
            Filters
            {activeCount > 0 ? (
              <Badge className="ml-2" variant="secondary">
                {activeCount}
              </Badge>
            ) : null}
          </Button>
        }
      />
      <SheetContent className="w-[360px] overflow-y-auto">
        <SheetHeader className="border-b border-border/50">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Combined with AND. Cleared filters restore the full grid.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          <FilterGroup label="Status">
            <PillRow
              options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              selected={filter.status ?? []}
              onToggle={toggleStatus}
            />
          </FilterGroup>

          <FilterGroup label="Length">
            <PillRow
              options={LENGTH_BUCKETS.map((b) => ({ value: b, label: LENGTH_BUCKET_LABELS[b] }))}
              selected={filter.lengthBuckets ?? []}
              onToggle={toggleLength}
            />
          </FilterGroup>

          {availableGenres.length > 0 ? (
            <FilterGroup label={`Genre (${availableGenres.length})`}>
              <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
                {availableGenres.map((g) => (
                  <Pill
                    key={g}
                    active={filter.genres?.includes(g) ?? false}
                    onClick={() => toggleGenre(g)}
                  >
                    {g}
                  </Pill>
                ))}
              </div>
            </FilterGroup>
          ) : null}

          <FilterGroup label="Year range">
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="From"
                value={filter.yearMin ?? ''}
                onChange={(e) => onChange({ ...filter, yearMin: numberOrUndefined(e.target.value) })}
              />
              <Input
                type="number"
                placeholder="To"
                value={filter.yearMax ?? ''}
                onChange={(e) => onChange({ ...filter, yearMax: numberOrUndefined(e.target.value) })}
              />
            </div>
          </FilterGroup>

          <FilterGroup label="Min your score (1–10)">
            <Input
              type="number"
              min={1}
              max={10}
              placeholder="Any"
              value={filter.minScore ?? ''}
              onChange={(e) => onChange({ ...filter, minScore: numberOrUndefined(e.target.value) })}
            />
          </FilterGroup>

          {!isFilterEmpty(filter) ? (
            <Button variant="ghost" onClick={() => onChange({})}>
              Clear all
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      {children}
    </div>
  );
}

function PillRow<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: Array<{ value: T; label: string }>;
  selected: readonly T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Pill key={o.value} active={selected.includes(o.value)} onClick={() => onToggle(o.value)}>
          {o.label}
        </Pill>
      ))}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'px-2.5 py-1 text-xs rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
          : 'bg-background border-border hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

function countActive(f: EntryFilter): number {
  return (
    (f.status?.length ?? 0) +
    (f.lengthBuckets?.length ?? 0) +
    (f.genres?.length ?? 0) +
    (f.yearMin !== undefined ? 1 : 0) +
    (f.yearMax !== undefined ? 1 : 0) +
    (f.minScore !== undefined ? 1 : 0)
  );
}
