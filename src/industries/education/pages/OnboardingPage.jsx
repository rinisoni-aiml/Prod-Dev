import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, CheckCircle, AlertCircle, Loader, Trash2, ArrowRight } from 'lucide-react';
import Logo from '@/components/Logo';
import toast from 'react-hot-toast';
import { dataApi } from '@/lib/api';

const OnboardingPage = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const navigate = useNavigate();

  const uploadFile = useCallback(async (file) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setUploadedFiles(prev => [...prev, {
      id,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      status: 'uploading',
      table: null,
      error: null,
    }]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await dataApi.upload(formData);
      const { message, table } = res.data;

      setUploadedFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'ready', table } : f
      ));
      toast.success(`${file.name} uploaded!`);

    } catch (err) {
      setUploadedFiles(prev => prev.map(f =>
        f.id === id ? {
          ...f,
          status: 'error',
          error: err?.response?.data?.error || 'Upload failed'
        } : f
      ));
      toast.error(`Failed to upload ${file.name}`);
    }
  }, []);

  const handleFilesAdded = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter(f =>
      f.name.endsWith('.csv') ||
      f.name.endsWith('.xlsx') ||
      f.name.endsWith('.xls')
    );
    if (files.length === 0) {
      toast.error('Please upload CSV or Excel files only');
      return;
    }
    await Promise.all(files.map(uploadFile));
  }, [uploadFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFilesAdded(e.dataTransfer.files);
  }, [handleFilesAdded]);

  const handleBrowse = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.multiple = true;
    input.onchange = (e) => {
      if (e.target.files) handleFilesAdded(e.target.files);
    };
    input.click();
  };

  const handleRemove = (id) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const allReady = uploadedFiles.length > 0 &&
    uploadedFiles.every(f => f.status === 'ready');

  const hasUploading = uploadedFiles.some(f => f.status === 'uploading');

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">

      {/* Logo */}
      <div className="mb-8">
        <Logo />
      </div>

      {/* Step indicator */}
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                s <= 3 ? 'gradient-brand' : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-foreground-secondary text-center">Step 3 of 3</p>
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="glass-card p-8 rounded-2xl w-full max-w-2xl"
      >
        <h2 className="text-2xl font-bold text-foreground mb-2">Upload your data</h2>
        <p className="text-foreground-secondary mb-6">
          Any schema works — student records, marks, attendance, fees, faculty data, etc.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={handleBrowse}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <Upload className="h-8 w-8 text-foreground-secondary mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">
            Drag & drop CSV or Excel files here
          </p>
          <p className="text-xs text-foreground-secondary mt-1">
            or click to browse · Multiple files supported
          </p>
          <p className="text-xs text-foreground-secondary/50 mt-1">
            Any column structure works
          </p>
        </div>

        {/* File list */}
        {uploadedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-background-surface"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {file.status === 'uploading' && (
                      <Loader className="h-4 w-4 text-primary animate-spin" />
                    )}
                    {file.status === 'ready' && (
                      <CheckCircle className="h-4 w-4 text-success" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-foreground-secondary">
                      {file.size}
                      {file.status === 'uploading' && ' · Uploading...'}
                      {file.status === 'ready' && ` · Saved as "${file.table}"`}
                      {file.status === 'error' && ` · ${file.error}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {file.status === 'uploading' && (
                    <span className="text-xs text-primary">Uploading</span>
                  )}
                  {file.status === 'ready' && (
                    <span className="text-xs text-success font-medium">✅ Ready</span>
                  )}
                  {file.status === 'error' && (
                    <span className="text-xs text-destructive">Failed</span>
                  )}
                  <button
                    onClick={() => handleRemove(file.id)}
                    className="h-7 w-7 rounded flex items-center justify-center hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            ))}

            {/* Success hint */}
            {allReady && (
              <p className="text-xs text-success text-center pt-1">
                ✅ All files saved to database!
              </p>
            )}

            {hasUploading && (
              <p className="text-xs text-foreground-secondary text-center pt-1">
                Please wait for all files to finish uploading...
              </p>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 border border-border py-2.5 rounded-lg font-medium text-sm text-foreground-secondary hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            disabled={hasUploading}
            className="flex-1 gradient-brand text-primary-foreground py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover-lift"
          >
            {hasUploading ? 'Uploading...' : 'Finish Setup'}
            {!hasUploading && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingPage;