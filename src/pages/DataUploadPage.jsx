import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Trash2, Eye, RefreshCw, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import SchemaMapping, { DEFAULT_PLATFORM_FIELDS, autoMapHeaders, parseCSVPreview } from '@/components/data/SchemaMapping';

const DataUploadPage = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  const existingSources = [
    { id: '1', file_name: 'sales_data_q1.csv', file_type: 'csv', row_count: 2847, status: 'ready', created_at: '2025-03-01T10:00:00Z' },
    { id: '2', file_name: 'inventory_snapshot.xlsx', file_type: 'xlsx', row_count: 1234, status: 'ready', created_at: '2025-03-05T14:30:00Z' },
  ];

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
    if (files.length === 0) {
      toast.error('Please upload CSV or Excel files');
      return;
    }
    const processed = await Promise.all(files.map(processFile));
    setUploadedFiles(prev => [...prev, ...processed]);
    toast.success(`${files.length} file(s) added`);
  }, [processFile]);

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
      const files = e.target.files;
      if (files) handleFilesAdded(files);
    };
    input.click();
  };

  const handleUpdateMapping = (fileId, mapping) => {
    setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, mapping } : f));
  };

  const handleProcess = async (fileId) => {
    setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing' } : f));
    await new Promise(r => setTimeout(r, 2000));
    setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'ready' } : f));
    toast.success('Data imported successfully!');
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

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Data Management</h1>
        <p className="text-sm text-foreground-secondary">Upload, map, and monitor your data sources</p>
      </div>

      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-sm font-semibold text-foreground mb-4">Upload New Data</h3>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={handleBrowse}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <Upload className="h-8 w-8 text-foreground-secondary mx-auto mb-3" />
          <p className="text-sm text-foreground-secondary">Drag & drop CSV or Excel files here</p>
          <p className="text-xs text-foreground-secondary mt-1">or click to browse · Multiple files supported</p>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mt-2 flex justify-end">
            <button onClick={handleBrowse} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium">
              <Plus className="h-3.5 w-3.5" /> Add more files
            </button>
          </div>
        )}
      </div>

      {uploadedFiles.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <SchemaMapping
            files={uploadedFiles}
            onUpdateMapping={handleUpdateMapping}
            onProcess={handleProcess}
            onResetMapping={handleResetMapping}
            onRemoveFile={handleRemoveFile}
            platformFields={DEFAULT_PLATFORM_FIELDS}
          />
        </motion.div>
      )}

      <div className="glass-card rounded-xl">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Uploaded Data Sources</h3>
        </div>
        <div className="divide-y divide-border">
          {existingSources.map((source) => (
            <div key={source.id} className="p-4 flex items-center justify-between hover:bg-background-elevated/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{source.file_name}</p>
                  <p className="text-xs text-foreground-secondary">
                    {source.row_count.toLocaleString()} rows · {source.file_type.toUpperCase()} · Uploaded {new Date(source.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">{source.status}</span>
                <button className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors" title="Preview">
                  <Eye className="h-4 w-4 text-foreground-secondary" />
                </button>
                <button className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors" title="Re-upload">
                  <RefreshCw className="h-4 w-4 text-foreground-secondary" />
                </button>
                <button className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors" title="Delete">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
