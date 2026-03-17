import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Trash2, Download, RefreshCw, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { uploadDataFile, fetchDataFiles, deleteDataFile, getFileDownloadUrl } from '@/lib/dataFiles';
import SchemaMapping, { DEFAULT_PLATFORM_FIELDS, autoMapHeaders, parseCSVPreview } from '@/components/data/SchemaMapping';

const DataUploadPage = () => {
  const { user } = useAuthStore();
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [savedFiles, setSavedFiles] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const loadSavedFiles = useCallback(async () => {
    if (!user) return;
    try {
      const files = await fetchDataFiles(user.id);
      setSavedFiles(files);
    } catch {
      toast.error('Failed to load data sources');
    } finally {
      setLoadingSaved(false);
    }
  }, [user]);

  useEffect(() => { loadSavedFiles(); }, [loadSavedFiles]);

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
    toast.success(`${files.length} file(s) added`);
  }, [processFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false); handleFilesAdded(e.dataTransfer.files);
  }, [handleFilesAdded]);

  const handleBrowse = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.csv,.xlsx,.xls'; input.multiple = true;
    input.onchange = (e) => { if (e.target.files) handleFilesAdded(e.target.files); };
    input.click();
  };

  const handleUpdateMapping = (fileId, mapping) => {
    setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, mapping } : f));
  };

  const handleProcess = async (fileId) => {
    const fileEntry = uploadedFiles.find(f => f.id === fileId);
    if (!fileEntry || !user) return;

    setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing' } : f));
    try {
      await uploadDataFile(user.id, fileEntry.file, fileEntry.mapping, fileEntry.previewRows.length);
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      await loadSavedFiles();
      toast.success('File uploaded and saved!');
    } catch (err) {
      setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'mapping' } : f));
      toast.error(err.message || 'Upload failed');
    }
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

  const handleDelete = async (file) => {
    try {
      await deleteDataFile(file.id, file.storage_path);
      setSavedFiles(prev => prev.filter(f => f.id !== file.id));
      toast.success('File deleted');
    } catch {
      toast.error('Failed to delete file');
    }
  };

  const handleDownload = async (file) => {
    try {
      const url = await getFileDownloadUrl(file.storage_path);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to get download link');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Uploaded Data Sources
            {savedFiles.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {savedFiles.length}
              </span>
            )}
          </h3>
          <button onClick={loadSavedFiles} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors" title="Refresh">
            <RefreshCw className="h-3.5 w-3.5 text-foreground-secondary" />
          </button>
        </div>

        {loadingSaved ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        ) : savedFiles.length === 0 ? (
          <div className="p-8 text-center text-sm text-foreground-secondary">
            No data sources yet. Upload your first file above.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {savedFiles.map((file) => (
              <div key={file.id} className="p-4 flex items-center justify-between hover:bg-background-elevated/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{file.file_name}</p>
                    <p className="text-xs text-foreground-secondary">
                      {file.row_count ? `${file.row_count.toLocaleString()} rows · ` : ''}
                      {file.file_type?.toUpperCase()} · {formatSize(file.file_size)} · Uploaded {new Date(file.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">{file.status}</span>
                  <button
                    onClick={() => handleDownload(file)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                    title="Download"
                  >
                    <Download className="h-4 w-4 text-foreground-secondary" />
                  </button>
                  <button
                    onClick={() => handleDelete(file)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card p-5 rounded-xl">
        <h3 className="text-sm font-semibold text-foreground mb-4">Data Summary</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xl font-bold text-primary">{savedFiles.length}</p>
            <p className="text-xs text-foreground-secondary mt-1">Total Files</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-success">
              {savedFiles.reduce((sum, f) => sum + (f.row_count || 0), 0).toLocaleString()}
            </p>
            <p className="text-xs text-foreground-secondary mt-1">Total Rows</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-foreground-secondary">
              {formatSize(savedFiles.reduce((sum, f) => sum + (f.file_size || 0), 0))}
            </p>
            <p className="text-xs text-foreground-secondary mt-1">Total Size</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataUploadPage;
