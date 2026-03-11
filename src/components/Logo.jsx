import { Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

const Logo = ({ size = 'md' }) => {
  const sizeClasses = { sm: 'text-lg', md: 'text-xl', lg: 'text-2xl' };
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <div className="relative">
        <Activity className={`${size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-7 w-7' : 'h-6 w-6'} text-primary`} />
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
      </div>
      <span className={`font-bold tracking-tight ${sizeClasses[size]}`}>
        <span className="text-foreground">Pulse</span>
        <span className="gradient-text-brand">IQ</span>
      </span>
    </Link>
  );
};
export default Logo;
