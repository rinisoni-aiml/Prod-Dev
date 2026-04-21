import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Loader, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { educationDataApi } from '@/lib/api';
import Logo from '@/components/Logo';

const UploadPage = () => {
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
      const res = await educationDataApi.upload(formData);
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
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-6">
        <Logo size="sm" />
        {allReady && (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-brand text-white text-sm font-medium hover-lift"
          >
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl space-y-6"
        >
          {/* Title */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground">Upload Your School Data</h1>
            <p className="text-foreground-secondary mt-2">
              Upload your Excel or CSV files — student records, marks, attendance, fees, faculty data
            </p>
          </div>

          {/* Upload box */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={handleBrowse}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
              dragOver
                ? 'border-primary bg-primary/5 scale-[1.02]'
                : 'border-border hover:border-primary/50 hover:bg-primary/2'
            }`}
          >
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="text-base font-medium text-foreground">
              Drag & drop your files here
            </p>
            <p className="text-sm text-foreground-secondary mt-1">
              or click to browse
            </p>
            <p className="text-xs text-foreground-secondary/60 mt-3">
              Supports CSV, XLSX, XLS · Multiple files · Any column structure
            </p>
          </div>

          {/* File list */}
          {uploadedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} added
                </h3>
                <button
                  onClick={handleBrowse}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  + Add more
                </button>
              </div>

              <div className="divide-y divide-border">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {file.status === 'uploading' && (
                          <Loader className="h-5 w-5 text-primary animate-spin" />
                        )}
                        {file.status === 'ready' && (
                          <CheckCircle className="h-5 w-5 text-success" />
                        )}
                        {file.status === 'error' && (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{file.name}</p>
                        <p className="text-xs text-foreground-secondary">
                          {file.size}
                          {file.status === 'uploading' && ' · Uploading to database...'}
                          {file.status === 'ready' && ` · Saved as "${file.table}"`}
                          {file.status === 'error' && ` · ${file.error}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {file.status === 'uploading' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          Uploading
                        </span>
                      )}
                      {file.status === 'ready' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                          ✅ Ready
                        </span>
                      )}
                      {file.status === 'error' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                          Failed
                        </span>
                      )}
                      <button
                        onClick={() => handleRemove(file.id)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Go to dashboard button */}
              {allReady && (
                <div className="p-4 border-t border-border bg-success/5 flex items-center justify-between">
                  <p className="text-sm text-success font-medium">
                    ✅ All files uploaded successfully!
                  </p>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-brand text-white text-sm font-medium hover-lift"
                  >
                    Go to Dashboard <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {hasUploading && (
                <div className="p-4 border-t border-border bg-primary/5">
                  <p className="text-xs text-foreground-secondary text-center">
                    Please wait while files are being uploaded...
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Skip button */}
          {uploadedFiles.length === 0 && (
            <div className="text-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-sm text-foreground-secondary hover:text-foreground underline"
              >
                Skip for now → Go to Dashboard
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default UploadPage;