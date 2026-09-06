import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-solid' | 'plain';

export function buttonClass(variant: ButtonVariant = 'secondary', className = '') {
  return `ui-button ui-button--${variant} ${className}`.trim();
}

export default function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
