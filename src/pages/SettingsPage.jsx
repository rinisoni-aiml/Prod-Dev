import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Bell, Key, Database, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import toast from 'react-hot-toast';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('general');
  const { profile, setProfile } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [name, setName] = useState(profile?.full_name || '');
  const [company, setCompany] = useState(profile?.company_name || '');

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
  ];

  const saveGeneral = () => {
    if (profile) {
      setProfile({ ...profile, full_name: name, company_name: company, theme_preference: theme });
    }
    toast.success('Settings saved');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-48 flex md:flex-col gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id ? 'bg-primary/10 text-primary' : 'text-foreground-secondary hover:text-foreground hover:bg-muted'
              }`}>
              <Icon className="h-4 w-4" /> <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 rounded-xl">
            {activeTab === 'general' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground mb-4">General Settings</h2>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Full Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Company</label>
                  <input value={company} onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Theme</label>
                  <select value={theme} onChange={(e) => setTheme(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>
                <button onClick={saveGeneral} className="gradient-brand text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover-lift">
                  Save Changes
                </button>
              </div>
            )}
            {activeTab === 'notifications' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground mb-4">Notification Preferences</h2>
                {['Stockout Alerts', 'Low Stock Warnings', 'Contract Expiry', 'AI Insights', 'Weekly Reports'].map((n) => (
                  <label key={n} className="flex items-center justify-between py-2">
                    <span className="text-sm text-foreground">{n}</span>
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary rounded" />
                  </label>
                ))}
              </div>
            )}
            {activeTab === 'api' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground mb-4">API Keys</h2>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Groq API Key</label>
                  <input type="password" placeholder="gsk_..." className="w-full px-4 py-2.5 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <p className="text-xs text-foreground-secondary mt-1">Provide your own Groq key for dedicated AI access</p>
                </div>
              </div>
            )}
            {activeTab === 'data' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground mb-4">Data Management</h2>
                <p className="text-sm text-foreground-secondary">Manage your uploaded data sources from the Data Management page.</p>
                <a href="/dashboard/data" className="text-sm text-primary font-medium hover:underline">Go to Data Management →</a>
              </div>
            )}
            {activeTab === 'danger' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-destructive mb-4">Danger Zone</h2>
                <div className="p-4 rounded-lg border border-destructive/30">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Delete All My Data</h3>
                  <p className="text-xs text-foreground-secondary mb-3">Removes all uploaded records and data sources.</p>
                  <button className="px-4 py-2 rounded-lg text-sm font-medium border border-destructive text-destructive hover:bg-destructive/10 transition-colors">
                    Delete All Data
                  </button>
                </div>
                <div className="p-4 rounded-lg border border-destructive/30">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Delete Account</h3>
                  <p className="text-xs text-foreground-secondary mb-3">Permanently delete your account and all associated data.</p>
                  <button className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">
                    Delete Account
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
