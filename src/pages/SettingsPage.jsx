import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Bell, Key, Database, AlertTriangle, FileText, Trash2, Download, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { supabase } from '@/lib/supabase';
import { fetchDataFiles, deleteDataFile, getFileDownloadUrl } from '@/lib/dataFiles';
import toast from 'react-hot-toast';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('general');
  const { profile, setProfile, user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.full_name || '');
  const [company, setCompany] = useState(profile?.company_name || '');
  const [savedFiles, setSavedFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
  ];

  const loadFiles = async () => {
    if (!user) return;
    setLoadingFiles(true);
    try {
      const files = await fetchDataFiles(user.id);
      setSavedFiles(files);
    } catch {
      toast.error('Failed to load files');
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'data') loadFiles();
  }, [activeTab, user]);

  const saveGeneral = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: name, company_name: company })
        .eq('id', user.id);
      if (error) throw error;
      if (profile) setProfile({ ...profile, full_name: name, company_name: company });
      setTheme(theme);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const handleDeleteFile = async (file) => {
    try {
      await deleteDataFile(file.id, file.storage_path);
      setSavedFiles(prev => prev.filter(f => f.id !== file.id));
      toast.success('File deleted');
    } catch {
      toast.error('Failed to delete file');
    }
  };

  const handleDownloadFile = async (file) => {
    try {
      const url = await getFileDownloadUrl(file.storage_path);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to get download link');
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('This will permanently delete your account and all data. Are you sure?')) return;
    toast.error('Account deletion requires backend support. Contact support.');
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">Data Sources</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={loadFiles} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors" title="Refresh">
                      <RefreshCw className="h-3.5 w-3.5 text-foreground-secondary" />
                    </button>
                    <button
                      onClick={() => navigate('/dashboard/data')}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Upload more →
                    </button>
                  </div>
                </div>

                {loadingFiles ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  </div>
                ) : savedFiles.length === 0 ? (
                  <div className="text-center py-8">
                    <Database className="h-8 w-8 text-foreground-secondary/40 mx-auto mb-2" />
                    <p className="text-sm text-foreground-secondary">No files uploaded yet.</p>
                    <button onClick={() => navigate('/dashboard/data')} className="text-sm text-primary font-medium hover:underline mt-1">
                      Go to Data Management →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background-surface hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{file.file_name}</p>
                            <p className="text-xs text-foreground-secondary">
                              {file.row_count ? `${file.row_count.toLocaleString()} rows · ` : ''}
                              {formatSize(file.file_size)} · {new Date(file.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success hidden sm:block">
                            {file.status}
                          </span>
                          <button onClick={() => handleDownloadFile(file)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors" title="Download">
                            <Download className="h-3.5 w-3.5 text-foreground-secondary" />
                          </button>
                          <button onClick={() => handleDeleteFile(file)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors" title="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-border text-xs text-foreground-secondary">
                      {savedFiles.length} file{savedFiles.length !== 1 ? 's' : ''} · {savedFiles.reduce((s, f) => s + (f.row_count || 0), 0).toLocaleString()} total rows
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'danger' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-destructive mb-4">Danger Zone</h2>
                <div className="p-4 rounded-lg border border-destructive/30">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Delete All My Data</h3>
                  <p className="text-xs text-foreground-secondary mb-3">Removes all uploaded records and data sources.</p>
                  <button
                    onClick={async () => {
                      if (!window.confirm('Delete all uploaded files? This cannot be undone.')) return;
                      try {
                        const files = await fetchDataFiles(user.id);
                        await Promise.all(files.map(f => deleteDataFile(f.id, f.storage_path)));
                        toast.success('All data deleted');
                      } catch { toast.error('Failed to delete all data'); }
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-destructive text-destructive hover:bg-destructive/10 transition-colors">
                    Delete All Data
                  </button>
                </div>
                <div className="p-4 rounded-lg border border-destructive/30">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Delete Account</h3>
                  <p className="text-xs text-foreground-secondary mb-3">Permanently delete your account and all associated data.</p>
                  <button onClick={handleDeleteAccount} className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">
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
