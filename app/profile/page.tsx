import { ProfileEditor } from '@/components/profile/ProfileEditor';

export default function ProfilePage() {
  return (
    <div className="px-6 py-8 max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Public profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Claim a handle to get one stable page that collects your shares. It stays
          private until you turn it on.
        </p>
      </div>
      <ProfileEditor />
    </div>
  );
}
