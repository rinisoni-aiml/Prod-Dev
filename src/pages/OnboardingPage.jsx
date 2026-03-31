import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Upload, AlertCircle, Factory, GraduationCap, Activity, Building2, Truck, CreditCard, Lock, Plug, Mail, CheckCircle, CloudUpload } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { uploadDataFile } from '@/lib/dataFiles';
import { dataApi, logisticsDataApi } from '@/lib/api';
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
    { icon: Factory, name: 'FMCG', desc: 'Demand forecasting & inventory intelligence', live: true },
    { icon: GraduationCap, name: 'Education', desc: 'Student analytics & retention', live: false },
    { icon: Activity, name: 'Healthcare', desc: 'Patient risk & ops analysis', live: false },
    { icon: Building2, name: 'Real Estate', desc: 'Lead scoring & deal intelligence', live: false },
    { icon: Truck, name: 'Logistics', desc: 'Delivery & efficiency insights', live: true },
    { icon: CreditCard, name: 'FinTech', desc: 'Credit risk & anomaly detection', live: false },
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

  const handleProcessFile = (fileId) => {
    setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'ready' } : f));
    toast.success('File ready!');
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

      if (uploadMode === 'upload' && uploadedFiles.length > 0) {
        // Upload user-provided files to Supabase Storage
        await Promise.all(
          uploadedFiles
            .filter(f => f.status === 'ready')
            .map(f => uploadDataFile(user.id, f.file, f.mapping, f.previewRows.length))
        );
      } else if (uploadMode === 'sample') {
        // Route to the correct industry's sample-data loader
        if (industry === 'logistics') {
          await logisticsDataApi.loadSampleData();
        } else {
          await dataApi.loadSampleData();
        }
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
                {industries.map(({ icon: Icon, name, desc, live }) => (
                  <button key={name}
                    onClick={() => live && setIndustry(name.toLowerCase())}
                    disabled={!live}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      !live
                        ? 'border-border opacity-50 cursor-not-allowed glass-card'
                        : industry === name.toLowerCase()
                          ? 'border-primary shadow-[var(--shadow-glow-primary)] bg-primary/5'
                          : 'border-border hover:border-primary/30 glass-card'
                    }`}
                  >
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${live ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Icon className={`h-5 w-5 ${live ? 'text-primary' : 'text-foreground-secondary'}`} />
                    </div>
                    <h3 className="font-semibold text-foreground text-sm mt-2">{name}</h3>
                    <p className="text-xs text-foreground-secondary mt-1">{desc}</p>
                    {live ? (
                      <span className="text-xs text-success font-semibold mt-2 block">LIVE NOW</span>
                    ) : (
                      <span className="text-xs text-foreground-secondary font-medium mt-2 flex items-center gap-1"><Lock className="h-3 w-3" /> Coming Soon</span>
                    )}
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
              <h2 className="text-2xl font-bold text-foreground mb-2">Connect your data</h2>
              <p className="text-foreground-secondary mb-6">Choose how you'd like to bring your data into PulseIQ.</p>

              {/* Data source cards */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  {
                    key: 'upload',
                    icon: CloudUpload,
                    label: 'Upload Files',
                    desc: 'CSV or Excel files from your computer',
                    live: true,
                  },
                  {
                    key: 'sample',
                    icon: AlertCircle,
                    label: 'Use Sample Data',
                    desc: 'Explore with a pre-loaded demo dataset',
                    live: true,
                  },
                  {
                    key: 'erp',
                    icon: Plug,
                    label: 'Connect ERP / CRM',
                    desc: 'Sync directly from SAP, Salesforce, HubSpot & more via API',
                    live: false,
                  },
                  {
                    key: 'gmail',
                    icon: Mail,
                    label: 'Connect Gmail',
                    desc: 'Pull insights from emails, threads, and attachments automatically',
                    live: false,
                  },
                ].map(({ key, icon: Icon, label, desc, live }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => live && setUploadMode(key)}
                    disabled={!live}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      !live
                        ? 'border-border opacity-50 cursor-not-allowed glass-card'
                        : uploadMode === key
                          ? 'border-primary shadow-[var(--shadow-glow-primary)] bg-primary/5'
                          : 'border-border hover:border-primary/30 glass-card cursor-pointer'
                    }`}
                  >
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${live ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Icon className={`h-5 w-5 ${live ? 'text-primary' : 'text-foreground-secondary'}`} />
                    </div>
                    <div className="text-sm font-semibold text-foreground">{label}</div>
                    <div className="text-xs text-foreground-secondary mt-1 leading-relaxed">{desc}</div>
                    {live ? (
                      uploadMode === key && (
                        <div className="flex items-center gap-1 mt-2">
                          <CheckCircle className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs text-primary font-semibold">Selected</span>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-1 mt-2">
                        <Lock className="h-3 w-3 text-foreground-secondary" />
                        <span className="text-xs text-foreground-secondary font-medium">Coming Soon</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Active mode panel */}
              {uploadMode === 'upload' && (
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
              )}

              {uploadMode === 'sample' && (
                <div className="glass-card p-6 rounded-xl text-center border border-primary/20">
                  <AlertCircle className="h-8 w-8 text-primary mx-auto mb-3" />
                  <p className="text-sm text-foreground mb-2">We'll load a curated {industry.toUpperCase()} sample dataset</p>
                  <p className="text-xs text-foreground-secondary">247 SKUs · 5 warehouses · 30 days of data</p>
                </div>
              )}

              {processing && (
                <div className="mt-4 space-y-2">
                  {(uploadMode === 'sample'
                    ? [
                        { icon: <CloudUpload className="h-4 w-4" />, text: 'Saving your profile...' },
                        { icon: <Upload className="h-4 w-4" />, text: 'Loading sample dataset...' },
                        { icon: <CheckCircle className="h-4 w-4 text-success" />, text: 'Workspace ready! Running analysis...' },
                      ]
                    : [
                        { icon: <CloudUpload className="h-4 w-4" />, text: 'Saving your profile...' },
                        { icon: <Upload className="h-4 w-4" />, text: 'Uploading files...' },
                        { icon: <CheckCircle className="h-4 w-4 text-success" />, text: 'Workspace ready!' },
                      ]
                  ).map(({ icon, text }, i) => (
                    <motion.div key={text} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.5 }}
                      className="flex items-center gap-2 text-sm text-foreground-secondary">
                      {icon}{text}
                    </motion.div>
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
