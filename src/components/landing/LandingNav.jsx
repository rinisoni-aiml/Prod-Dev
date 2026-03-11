import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuthStore } from '@/stores/authStore';

const LandingNav = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const links = [
    { label: 'Platform', href: '#capabilities' },
    { label: 'Industries', href: '#industries' },
    { label: 'How It Works', href: '#process' },
    { label: 'About', href: '#vision' },
  ];

  return (
    <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'glass-card border-b shadow-md' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Logo />
          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (<a key={link.label} href={link.href} className="text-sm font-medium text-foreground-secondary hover:text-foreground transition-colors">{link.label}</a>))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            {isAuthenticated ? (
              <button onClick={() => navigate('/dashboard')} className="gradient-brand text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover-lift">Dashboard</button>
            ) : (
              <><Link to="/login" className="text-sm font-medium text-foreground-secondary hover:text-foreground transition-colors px-4 py-2">Log In</Link>
              <Link to="/signup" className="gradient-brand text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover-lift flex items-center gap-2">Request Early Access <ArrowRight className="h-4 w-4" /></Link></>
            )}
          </div>
          <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
        </div>
      </div>
      {mobileOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="md:hidden glass-card border-t">
          <div className="px-4 py-4 space-y-3">
            {links.map((link) => (<a key={link.label} href={link.href} className="block text-sm font-medium text-foreground-secondary hover:text-foreground py-2" onClick={() => setMobileOpen(false)}>{link.label}</a>))}
            <div className="pt-3 border-t border-border flex items-center gap-3">
              <ThemeToggle /><Link to="/login" className="text-sm font-medium text-foreground-secondary">Log In</Link>
              <Link to="/signup" className="gradient-brand text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold">Get Started</Link>
            </div>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
};
export default LandingNav;
