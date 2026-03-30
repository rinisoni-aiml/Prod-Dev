import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle } from 'lucide-react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) { toast.error('Please fill in all fields'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;

      // session is null when email confirmation is required
      if (!data.session) {
        setAwaitingConfirmation(true);
        return;
      }

      // session exists → email confirmation is disabled, proceed directly
      setUser(data.user);

      await supabase.from('user_logins').insert({
        email,
        login_type: 'signup',
        logged_at: new Date().toISOString(),
      });

      toast.success('Account created! Let\'s set up your workspace.');
      navigate('/onboarding');
    } catch (err) {
      toast.error(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  if (awaitingConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
          <Logo className="mx-auto mb-8" />
          <div className="glass-card p-10 rounded-2xl">
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
            <p className="text-foreground-secondary mb-2">
              We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
            </p>
            <p className="text-sm text-foreground-secondary mb-8">
              Click the link to confirm your account, then come back and log in.
            </p>
            <Link to="/login"
              className="w-full gradient-brand text-primary-foreground py-2.5 rounded-lg font-semibold text-sm hover-lift inline-flex items-center justify-center gap-2">
              Go to Login <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-xs text-foreground-secondary mt-4">Didn't receive it? Check spam or wait a minute and try again.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden gradient-ai">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(6,182,212,0.3)_0%,transparent_60%)]" />
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-primary-foreground">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Logo size="lg" />
            <h2 className="text-3xl font-bold mt-8 mb-4">Get started free</h2>
            <p className="text-primary-foreground/80 text-lg max-w-md">
              Set up your AI-powered workspace in under 3 minutes.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              {['No credit card', 'Free tier', 'FMCG ready', 'AI insights'].map((pill) => (
                <span key={pill} className="px-4 py-2 rounded-full bg-primary-foreground/10 backdrop-blur text-sm font-medium animate-float" style={{ animationDelay: `${Math.random() * 3}s` }}>
                  {pill}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Create your account</h1>
          <p className="text-foreground-secondary mb-8">Start your business intelligence journey</p>

          <button className="w-full glass-card p-3 rounded-lg flex items-center justify-center gap-3 hover-lift mb-6 text-sm font-medium text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-foreground-secondary">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-secondary" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background-surface text-foreground placeholder:text-foreground-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-secondary" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background-surface text-foreground placeholder:text-foreground-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-secondary" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters"
                  className="w-full pl-10 pr-12 py-2.5 rounded-lg border border-border bg-background-surface text-foreground placeholder:text-foreground-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showPassword ? <EyeOff className="h-4 w-4 text-foreground-secondary" /> : <Eye className="h-4 w-4 text-foreground-secondary" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full gradient-brand text-primary-foreground py-2.5 rounded-lg font-semibold text-sm hover-lift disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? 'Creating account...' : <>Create Account <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <p className="text-sm text-foreground-secondary text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default SignupPage;
