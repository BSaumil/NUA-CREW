import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';
const cls = (v: Variant) => `nua-button${v === 'primary' ? '' : ` nua-button--${v}`}`;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };
export function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  return <button {...rest} className={`${cls(variant)} ${className ?? ''}`.trim()} />;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  children: ReactNode;
};
export function ButtonLink({ variant = 'primary', className, ...rest }: LinkProps) {
  // eslint-disable-next-line jsx-a11y/anchor-has-content -- children are required by the prop type
  return <a {...rest} className={`${cls(variant)} ${className ?? ''}`.trim()} />;
}
