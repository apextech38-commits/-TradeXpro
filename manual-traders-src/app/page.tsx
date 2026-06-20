'use client';

import RiseFallView from '@/components/rise-fall-view';

export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-6xl">
        <RiseFallView />
      </div>
    </main>
  );
}