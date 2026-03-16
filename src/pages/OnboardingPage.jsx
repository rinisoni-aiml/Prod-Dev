import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Upload, AlertCircle } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { uploadDataFile } from '@/lib/dataFiles';
import toast from 'react-hot-toast';
import SchemaMapping, { DEFAULT_PLATFORM_FIELDS, autoMapHeaders, parseCSVPreview } from '@/components/data/SchemaMapping';

const OnboardingPage = () => {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [uploadMode, setUploadMode] = useState('upload');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();
  const { user, setProfile } = useAuthStore();

  const roles = ['Founder/CEO', 'Operations Head', 'Supply Chain Manager', 'Data Analyst', 'Other'];

  const industries = [
    { icon: '🏭', name: 'FMCG', desc: 'Demand forecasting & inventory intelligence' },
    { icon: '🎓', name: 'Education', desc: 'Student analytics & retention' },
    { icon: '🏥', name: 'Healthcare', desc: 'Patient risk & ops analysis' },
    { icon: '🏠', name: 'Real Estate', desc: 'Lead scoring & deal intelligence' },
    { icon: '🚚', name: 'Logistics', desc: 'Delivery & efficiency insights' },
    { icon: '💳', name: 'FinTech', desc: 'Credit risk & anomaly detection' },
  ];

  const handleStep1 = () => {
    if (!fullName || !companyName || !userRole) { toast.error('Please fill in all fields'); return; }
    setStep(2);
  };

  const handleStep2 = () => {
    if (!industry) { toast.error('Please select an industry'); return; }
    setStep(3);
  };

  const processFile = useCallback(async (file) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const text = await file.text();
    const { headers, rows } = parseCSVPreview(text);
    const mapping = autoMapHeaders(headers, DEFAULT_PLATFORM_FIELDS);
    return { file, id, headers, previewRows: rows, mapping, status: 'mapping' };
  }, []);

  const handleFilesAdded = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter(f =>
      f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (files.length === 0) { toast.error('Please upload CSV or Excel files'); return; }
    const processed = await Promise.all(files.map(processFile));
    setUploadedFiles(prev => [...prev, ...processed]);
  }, [processFile]);

  const handleUpdateMapping = (fileId, mapping) => {
    setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, mapping } : f));
  };

  const handleProcessFile = async (fileId) => {
    setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing' } : f));
    await new Promise(r => setTimeout(r, 1500));
    setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'ready' } : f));
    toast.success('File processed!');
  };

  const handleResetMapping = (fileId) => {
    setUploadedFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      return { ...f, mapping: autoMapHeaders(f.headers, DEFAULT_PLATFORM_FIELDS), status: 'mapping' };
    }));
  };

  const handleRemoveFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleFinish = async () => {
    if (uploadMode === 'upload') {
      const allReady = uploadedFiles.length > 0 && uploadedFiles.every(f => f.status === 'ready');
      if (!allReady) { toast.error('Please process all uploaded files first'); return; }
    }
    setProcessing(true);
    try {
      // Save profile to DB
      const profileData = {
        id: user.id,
        full_name: fullName,
        company_name: companyName,
        industry: industry.toLowerCase(),
        role: userRole,
        onboarding_completed: true,
      };
      const { error: profileError } = await supabase.from('profiles').upsert(profileData);
      if (profileError) throw profileError;

      // Update company_name in the login log
      await supabase
        .from('user_logins')
        .update({ company_name: companyName })
        .eq('email', user.email)
        .is('company_name', null);

      // Upload processed files to Supabase Storage
      if (uploadMode === 'upload' && uploadedFiles.length > 0) {
        await Promise.all(
          uploadedFiles
            .filter(f => f.status === 'ready')
            .map(f => uploadDataFile(user.id, f.file, f.mapping, f.previewRows.length))
        );
      }

      setProfile(profileData);
      toast.success('Your workspace is ready!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Setup failed');
    } finally {
      setProcessing(false);
    }
  };

  const allFilesReady = uploadedFiles.length > 0 && uploadedFiles.every(f => f.status === 'ready');

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-8"><Logo /></div>

      <div className="w-full max-w-md mb-8">
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? 'gradient-brand' : 'bg-muted'}`} />
          ))}
        </div>
        <p className="text-xs text-foreground-secondary text-center">Step {step} of 3</p>
      </div>

      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="glass-card p-8 rounded-2xl max-w-lg mx-auto">
              <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to PulseIQ 👋</h2>
              <p className="text-foreground-secondary mb-6">Let's set up your workspace in 3 quick steps.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Full Name</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe"
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background-surface text-foreground placeholder:text-foreground-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Company Name</label>
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corp"
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background-surface text-foreground placeholder:text-foreground-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Your Role</label>
                  <select value={userRole} onChange={(e) => setUserRole(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm">
                    <option value="">Select role...</option>
                    {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleStep1}
                className="w-full gradient-brand text-primary-foreground py-2.5 rounded-lg font-semibold text-sm hover-lift mt-6 flex items-center justify-center gap-2">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="glass-card p-8 rounded-2xl max-w-lg mx-auto">
              <h2 className="text-2xl font-bold text-foreground mb-2">Which industry are you in?</h2>
              <p className="text-foreground-secondary mb-6">PulseIQ adapts its intelligence to your domain.</p>
              <div className="grid grid-cols-2 gap-3">
                {industries.map(({ icon, name, desc }) => (
                  <button key={name}
                    onClick={() => setIndustry(name.toLowerCase())}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      industry === name.toLowerCase()
                        ? 'border-primary shadow-[var(--shadow-glow-primary)] bg-primary/5'
                        : 'border-border hover:border-primary/30 glass-card'
                    }`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <h3 className="font-semibold text-foreground text-sm mt-2">{name}</h3>
                    <p className="text-xs text-foreground-secondary mt-1">{desc}</p>
                    <span className="text-xs text-success font-medium mt-2 block">✅ Available</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="flex-1 border border-border py-2.5 rounded-lg font-medium text-sm text-foreground hover-lift flex items-center justify-center gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={handleStep2} className="flex-1 gradient-brand text-primary-foreground py-2.5 rounded-lg font-semibold text-sm hover-lift flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="glass-card p-8 rounded-2xl">
              <h2 className="text-2xl font-bold text-foreground mb-2">Upload your data</h2>
              <p className="text-foreground-secondary mb-6">We support CSV and Excel files. Multiple files supported.</p>

              <div className="flex gap-2 mb-6">
                <button onClick={() => setUploadMode('upload')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${uploadMode === 'upload' ? 'gradient-brand text-primary-foreground' : 'bg-muted text-foreground-secondary'}`}>
                  Upload Data
                </button>
                <button onClick={() => setUploadMode('sample')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${uploadMode === 'sample' ? 'gradient-brand text-primary-foreground' : 'bg-muted text-foreground-secondary'}`}>
                  Use Sample Data
                </button>
              </div>

              {uploadMode === 'upload' ? (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleFilesAdded(e.dataTransfer.files); }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.csv,.xlsx,.xls';
                      input.multiple = true;
                      input.onchange = (ev) => { if (ev.target.files) handleFilesAdded(ev.target.files); };
                      input.click();
                    }}
                    className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <Upload className="h-8 w-8 text-foreground-secondary mx-auto mb-2" />
                    <p className="text-sm text-foreground-secondary">Drag & drop CSV or Excel files here</p>
                    <p className="text-xs text-foreground-secondary mt-1">or click to browse · Multiple files supported</p>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <SchemaMapping
                      files={uploadedFiles}
                      onUpdateMapping={handleUpdateMapping}
                      onProcess={handleProcessFile}
                      onResetMapping={handleResetMapping}
                      onRemoveFile={handleRemoveFile}
                      platformFields={DEFAULT_PLATFORM_FIELDS}
                    />
                  )}
                </div>
              ) : (
                <div className="glass-card p-6 rounded-xl text-center border border-primary/20">
                  <AlertCircle className="h-8 w-8 text-primary mx-auto mb-3" />
                  <p className="text-sm text-foreground mb-2">We'll load a curated {industry.toUpperCase()} sample dataset</p>
                  <p className="text-xs text-foreground-secondary">247 SKUs · 5 warehouses · 30 days of data</p>
                </div>
              )}

              {processing && (
                <div className="mt-4 space-y-2">
                  {['📊 Saving your profile...', '☁️ Uploading files...', '✅ Workspace ready!'].map((msg, i) => (
                    <motion.p key={msg} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.5 }}
                      className="text-sm text-foreground-secondary">{msg}</motion.p>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(2)} className="flex-1 border border-border py-2.5 rounded-lg font-medium text-sm text-foreground hover-lift flex items-center justify-center gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={handleFinish}
                  disabled={processing || (uploadMode === 'upload' && !allFilesReady)}
                  className="flex-1 gradient-brand text-primary-foreground py-2.5 rounded-lg font-semibold text-sm hover-lift disabled:opacity-50 flex items-center justify-center gap-2">
                  {processing ? 'Setting up...' : uploadMode === 'upload' ? <>Finish Setup <ArrowRight className="h-4 w-4" /></> : <>Load Sample Data <ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OnboardingPage;
