'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { jsonFetch } from '@/lib/api/fetch-json';
import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  HANDLE_ERROR_MESSAGES,
  validateHandle,
} from '@/lib/profile';

interface ProfileRow {
  userId: string;
  handle: string;
  displayName: string | null;
  bio: string | null;
  isPublic: boolean;
}

export function ProfileEditor() {
  const q = useQuery<{ data: ProfileRow | null }>({
    queryKey: ['profile'],
    queryFn: () => jsonFetch<{ data: ProfileRow | null }>('/api/profile'),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="text-sm text-destructive">Failed to load your profile.</p>;

  // Mount the form only once data is available, so useState initializers seed
  // it directly — no effect, no flash of empty fields.
  return <ProfileForm initial={q.data?.data ?? null} />;
}

function ProfileForm({ initial }: { initial: ProfileRow | null }) {
  const qc = useQueryClient();

  const [handle, setHandle] = useState(initial?.handle ?? '');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [savedHandle, setSavedHandle] = useState(initial?.isPublic ? initial.handle : null);

  const save = useMutation({
    mutationFn: () =>
      jsonFetch<{ data: ProfileRow }>('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle: handle.trim(),
          displayName: displayName.trim() || null,
          bio: bio.trim() || null,
          isPublic,
        }),
      }),
    onSuccess: ({ data }) => {
      qc.setQueryData(['profile'], { data });
      setSavedHandle(data.isPublic ? data.handle : null);
      toast.success('Profile saved');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('handle_taken') || msg.includes('409')) {
        toast.error('That handle is already in use.');
      } else {
        toast.error('Could not save profile.');
      }
    },
  });

  const handleCheck = validateHandle(handle);
  const handleError = handle.length > 0 && !handleCheck.ok ? HANDLE_ERROR_MESSAGES[handleCheck.error] : null;
  const canSubmit = handleCheck.ok && !save.isPending;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) save.mutate();
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Handle</span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">/u/</span>
          <Input
            value={handle}
            placeholder="yourname"
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setHandle(e.target.value)}
          />
        </div>
        {handleError ? <span className="text-xs text-destructive">{handleError}</span> : null}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Display name (optional)</span>
        <Input
          value={displayName}
          placeholder="Your name"
          maxLength={DISPLAY_NAME_MAX}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Bio (optional)</span>
        <Textarea
          value={bio}
          rows={3}
          maxLength={BIO_MAX}
          placeholder="What you're into."
          onChange={(e) => setBio(e.target.value)}
        />
        <span className="text-xs text-muted-foreground self-end tabular-nums">
          {bio.length}/{BIO_MAX}
        </span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        <span className="text-sm">
          Make my profile public
          <span className="text-muted-foreground"> — anyone with the link can see it</span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {save.isPending ? 'Saving…' : 'Save profile'}
        </Button>
        {savedHandle ? (
          <Link
            href={`/u/${savedHandle}`}
            className="text-sm text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View public profile →
          </Link>
        ) : null}
      </div>
    </form>
  );
}
