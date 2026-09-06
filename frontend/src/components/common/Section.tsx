import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export default function Section({ className = '', ...props }: ComponentPropsWithoutRef<'section'>) {
  return <section className={`ui-section ${className}`} {...props} />;
}

export function InfoRow({ label, children, mono = false, title }: { label: ReactNode; children: ReactNode; mono?: boolean; title?: string }) {
  return <div className="ui-info-row"><dt>{label}</dt><dd title={title} className={mono ? 'font-mono' : undefined}>{children}</dd></div>;
}
