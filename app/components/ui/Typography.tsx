// Simple cn utility function since we're having path resolution issues
function cn(...classes: (string | undefined | boolean)[]) {
  return classes.filter(Boolean).join(' ');
}
import { HTMLAttributes } from 'react';

// Define heading styles
const headingStyles = {
  h1: 'text-2xl font-bold text-black',
  h2: 'text-xl font-semibold text-black',
  h3: 'text-lg font-medium text-black',
} as const;

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

export function Heading({
  as: Tag = 'h1',
  className,
  ...props
}: HeadingProps) {
  return (
    <Tag
      className={cn(headingStyles[Tag], className)}
      {...props}
    />
  );
}

// Text component for paragraphs and other text elements
interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  as?: 'p' | 'span' | 'div';
  variant?: 'base' | 'small' | 'subdued' | 'danger' | 'gradient';
  className?: string;
}

export function Text({
  as: Tag = 'p',
  variant = 'base',
  className,
  ...props
}: TextProps) {
  const variants = {
    base: 'text-base text-gray-900',
    small: 'text-sm text-gray-900',
    subdued: 'text-sm text-gray-600',
    danger: 'text-sm text-red-600 hover:text-red-800',
    gradient: 'text-sm gradient-text',
  } as const;

  return (
    <Tag
      className={cn(variants[variant], className)}
      {...props}
    />
  );
}

// Helper text component for form helper/error messages
export function HelperText({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-gray-600 mt-1', className)}
      {...props}
    />
  );
}

// Link component for hyperlinks
export function Link({
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn('gradient-text hover:gradient-text transition-colors', className)}
      {...props}
    />
  );
}