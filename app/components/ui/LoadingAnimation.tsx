interface LoadingAnimationProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function LoadingAnimation({ size = 'md', className = '' }: LoadingAnimationProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24'
  };

  return (
    <div className="animate-pulse">
      <div className={`${sizeClasses[size]} gradient-icon rounded-full ${className}`}></div>
    </div>
  );
}