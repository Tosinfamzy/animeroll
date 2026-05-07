import { auth } from '@clerk/nextjs/server';

import { Landing } from '@/components/marketing/Landing';
import { LibraryHome } from '@/components/rolodex/LibraryHome';

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) return <LibraryHome />;
  return <Landing />;
}
