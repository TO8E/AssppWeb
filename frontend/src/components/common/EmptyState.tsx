import type { ReactNode } from 'react';

export default function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return <div className="ui-empty-state">
    {icon && <div className="mb-3 text-gray-400 [&>svg]:h-8 [&>svg]:w-8">{icon}</div>}
    <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
    {description && <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>;
}
