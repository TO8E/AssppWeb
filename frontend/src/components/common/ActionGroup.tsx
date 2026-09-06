import type { HTMLAttributes } from 'react';

export default function ActionGroup({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-action-row ${className}`.trim()} {...props} />;
}
