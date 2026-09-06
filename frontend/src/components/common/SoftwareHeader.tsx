import type { ReactNode } from 'react';
import AppIcon from './AppIcon';
import type { Software } from '../../types';

export default function SoftwareHeader({ app, children, level = 2 }: { app: Pick<Software, 'name' | 'artworkUrl' | 'artistName'>; children?: ReactNode; level?: 1 | 2 }) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return <div className="flex min-w-0 items-start gap-4">
    <AppIcon url={app.artworkUrl} name={app.name} size="lg" />
    <div className="min-w-0 flex-1">
      <Heading className="text-xl font-semibold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-2xl">{app.name}</Heading>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{app.artistName}</p>
      {children && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-500 dark:text-gray-400">{children}</div>}
    </div>
  </div>;
}
