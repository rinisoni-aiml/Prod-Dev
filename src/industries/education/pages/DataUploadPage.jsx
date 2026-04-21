import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Trash2, Eye, RefreshCw, Plus, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { dataApi } from '@/lib/api';

const DataUploadPage = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [existingSources, setExistingSources] = useState([
    { id: '1', file_name: 'sales_data_q1.csv', file_type: 'csv', row_count: 2847, status: 'ready', created_at: '2025-03-01T10:00:00Z' },
    { id: '2', file_name: 'inventory_snapshot.xlsx', file_type: 'xlsx', row_count: 1234, status: 'ready', created_at: '2025-03-05T14:30:00Z' },
  ]);

  const uploadFile = useCallback(async (file) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // add to list immediately with uploading status
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

      // mark as ready
      setUploadedFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'ready', table } : f
      ));

      // also add to existing sources list
      setExistingSources(prev => [...prev, {
        id,
        file_name: file.name,
        file_type: file.name.split('.').pop(),
        row_count: null,
        status: 'ready',
        created_at: new Date().toISOString(),
        table,
      }]);

      toast.success(message || `${file.name} uploaded successfully!`);

    } catch (err) {
      setUploadedFiles(prev => prev.map(f =>
        f.id === id ? {
          ...f,
          status: 'error',
          error: err?.response?.data?.error || 'Upload failed'
        } : f
      ));
      toast.error(`Failed to upload ${file.name} — is your Python server running?`);
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
    // upload all files in parallel
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

  const handleRemoveUploaded = (id) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleDeleteSource = (id) => {
    setExistingSources(prev => prev.filter(s => s.id !== id));
    toast.success('Source removed');
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Data Management</h1>
        <p className="text-sm text-foreground-secondary">
          Upload any school data files — student records, marks, attendance, fees, any schema works
        </p>
      </div>

      {/* Upload box */}
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-sm font-semibold text-foreground mb-4">Upload New Data</h3>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={handleBrowse}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <Upload className="h-8 w-8 text-foreground-secondary mx-auto mb-3" />
          <p className="text-sm text-foreground-secondary">
            Drag & drop CSV or Excel files here
          </p>
          <p className="text-xs text-foreground-secondary mt-1">
            or click to browse · Multiple files supported
          </p>
          <p className="text-xs text-foreground-secondary/50 mt-2">
            Any column structure works — student data, marks sheets, attendance, fees, etc.
          </p>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleBrowse}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium"
            >
              <Plus className="h-3.5 w-3.5" /> Add more files
            </button>
          </div>
        )}
      </div>

      {/* Currently uploading files */}
      {uploadedFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl"
        >
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Upload Progress ({uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="p-4 flex items-center justify-between hover:bg-background-elevated/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
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
                      {file.status === 'ready' && ` · Saved as table "${file.table}" · Ready to query`}
                      {file.status === 'error' && ` · Error: ${file.error}`}
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
                      Ready
                    </span>
                  )}
                  {file.status === 'error' && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                      Failed
                    </span>
                  )}
                  <button
                    onClick={() => handleRemoveUploaded(file.id)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* hint when at least one file is ready */}
          {uploadedFiles.some(f => f.status === 'ready') && (
            <div className="p-4 border-t border-border bg-primary/5 rounded-b-xl">
              <p className="text-xs text-foreground-secondary text-center">
                ✅ File is saved in the database. Click the <strong>AI Chat</strong> button and ask anything about your data!
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Existing sources */}
      <div className="glass-card rounded-xl">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Uploaded Data Sources</h3>
        </div>
        <div className="divide-y divide-border">
          {existingSources.map((source) => (
            <div
              key={source.id}
              className="p-4 flex items-center justify-between hover:bg-background-elevated/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{source.file_name}</p>
                  <p className="text-xs text-foreground-secondary">
                    {source.row_count ? `${source.row_count.toLocaleString()} rows · ` : ''}
                    {source.file_type.toUpperCase()} · Uploaded {new Date(source.created_at).toLocaleDateString()}
                    {source.table && ` · Table: "${source.table}"`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                  {source.status}
                </span>
                <button
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                  title="Preview"
                >
                  <Eye className="h-4 w-4 text-foreground-secondary" />
                </button>
                <button
                  onClick={handleBrowse}
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                  title="Re-upload"
                >
                  <RefreshCw className="h-4 w-4 text-foreground-secondary" />
                </button>
                <button
                  onClick={() => handleDeleteSource(source.id)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Health */}
      <div className="glass-card p-5 rounded-xl">
        <h3 className="text-sm font-semibold text-foreground mb-4">Data Health</h3>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { label: 'Completeness', value: '94.2%', color: 'text-success' },
            { label: 'Missing Values', value: '237', color: 'text-warning' },
            { label: 'Date Range', value: '30 days', color: 'text-primary' },
            { label: 'Duplicates', value: '12', color: 'text-foreground-secondary' },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-foreground-secondary mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default DataUploadPage;