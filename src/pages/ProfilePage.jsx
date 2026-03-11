import { motion } from 'framer-motion';
import { User, Shield, Clock, BarChart3 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const ProfilePage = () => {
  const { profile } = useAuthStore();

  const stats = [
    { label: 'Forecasts Run', value: 24, icon: BarChart3 },
    { label: 'Alerts Resolved', value: 47, icon: Shield },
    { label: 'Files Uploaded', value: 3, icon: Clock },
    { label: 'AI Queries', value: 156, icon: User },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 rounded-xl">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl gradient-brand flex items-center justify-center text-primary-foreground text-2xl font-bold">
            {profile?.full_name?.[0] || 'U'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{profile?.full_name || 'User'}</h1>
            <p className="text-sm text-foreground-secondary">{profile?.company_name || 'Company'}</p>
            <div className="flex gap-2 mt-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{profile?.role || 'admin'}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">{profile?.industry || 'fmcg'}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">{profile?.plan || 'free'} plan</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-card p-4 rounded-xl text-center">
            <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-foreground-secondary">{label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ProfilePage;
