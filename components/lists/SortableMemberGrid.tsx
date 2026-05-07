'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { AnimeCard } from '@/components/rolodex/AnimeCard';
import { jsonFetch } from '@/lib/api/fetch-json';
import type { EntryWithAnime, ListWithMembers } from '@/lib/types';

interface Props {
  listId: string;
  members: EntryWithAnime[];
}

export function SortableMemberGrid({ listId, members }: Props) {
  const qc = useQueryClient();

  const sensors = useSensors(
    // Mouse: 5px movement threshold so a click on the handle that doesn't
    // move isn't interpreted as a drag start.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Touch: 250 ms press-and-hold + small tolerance so vertical scroll
    // gestures aren't hijacked by the drag handle.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorder = useMutation({
    mutationFn: (orderedEntryIds: string[]) =>
      jsonFetch<{ data: { listId: string; count: number } }>(
        `/api/lists/${listId}/entries/order`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderedEntryIds }),
        },
      ),
    onMutate: async (orderedEntryIds) => {
      await qc.cancelQueries({ queryKey: ['list', listId] });
      const prev = qc.getQueryData<{ data: ListWithMembers }>(['list', listId]);
      if (prev) {
        const memberMap = new Map(prev.data.members.map((m) => [m.entry.id, m]));
        const reordered = orderedEntryIds
          .map((id) => memberMap.get(id))
          .filter((m): m is EntryWithAnime => m !== undefined);
        qc.setQueryData<{ data: ListWithMembers }>(['list', listId], {
          data: { ...prev.data, members: reordered },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['list', listId], ctx.prev);
      toast.error('Failed to reorder');
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['list', listId] });
    },
  });

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = members.findIndex((m) => m.entry.id === active.id);
    const newIndex = members.findIndex((m) => m.entry.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(members, oldIndex, newIndex);
    reorder.mutate(next.map((m) => m.entry.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={members.map((m) => m.entry.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {members.map((m) => (
            <SortableMember key={m.entry.id} member={m} listId={listId} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableMember({
  member,
  listId,
}: {
  member: EntryWithAnime;
  listId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: member.entry.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/sortable">
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Drag to reorder"
        className="absolute top-2 left-2 z-10 size-7 rounded-md bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground opacity-0 group-hover/sortable:opacity-100 focus-visible:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      <AnimeCard {...member} removeFromListId={listId} />
    </div>
  );
}
