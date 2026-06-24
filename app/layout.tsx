import { ClerkProvider, Show, UserButton } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';

import './globals.css';
import { Providers } from './providers';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Animeroll',
  description: 'Track your anime watchlist and share it with friends.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: 'oklch(0.7 0.13 290)',
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      >
        <body className="min-h-full flex flex-col bg-background text-foreground">
          <Providers>
            <header className="border-b border-border/50 px-6 py-4 flex items-center justify-between">
              <Link href="/" className="font-semibold text-lg tracking-tight">
                Animeroll
              </Link>
              <nav className="flex gap-6 text-sm text-muted-foreground items-center">
                <Show when="signed-in">
                  <Link href="/" className="hover:text-foreground transition-colors">
                    Library
                  </Link>
                  <Link href="/lists" className="hover:text-foreground transition-colors">
                    Lists
                  </Link>
                  <Link href="/discover" className="hover:text-foreground transition-colors">
                    Discover
                  </Link>
                  <Link href="/shares" className="hover:text-foreground transition-colors">
                    Shares
                  </Link>
                  <Link href="/stats" className="hover:text-foreground transition-colors">
                    Stats
                  </Link>
                  <Link href="/archive" className="hover:text-foreground transition-colors">
                    Archive
                  </Link>
                  <Link href="/profile" className="hover:text-foreground transition-colors">
                    Profile
                  </Link>
                  <UserButton />
                </Show>
                <Show when="signed-out">
                  <Link href="/sign-in" className="hover:text-foreground transition-colors">
                    Sign in
                  </Link>
                </Show>
              </nav>
            </header>
            <main className="flex-1">{children}</main>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
