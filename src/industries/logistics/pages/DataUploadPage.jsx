import { useState, useCallback, useEffect } from 'react';
import { Upload, Trash2, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { logisticsDataApi } from '@/lib/api';
import toast from 'react-hot-toast';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const LogisticsDataUploadPage = () => {
  const [sources, setSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fetchSources = useCallback(async () => {
    try {
      const res = await logisticsDataApi.getSources();
      setSources(res.data || []);
    } catch {
      setSources([]);
    } finally {
      setLoadingSources(false);
    }
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const uploadFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter(
      (f) => f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (!files.length) { toast.error('Only CSV and Excel files are supported'); return; }

    setUploading(true);
    let successCount = 0;
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        await logisticsDataApi.upload(formData);
        successCount++;
      } catch (err) {
        toast.error(`Failed to upload ${file.name}: ${err.response?.data?.detail || err.message}`);
      }
    }
    setUploading(false);
    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully`);
      fetchSources();
    }
  }, [fetchSources]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const handleBrowse = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.multiple = true;
    input.onchange = (e) => { if (e.target.files?.length) uploadFiles(e.target.files); };
    input.click();
  };

  const handleDelete = async (id, name) => {
    try {
      await logisticsDataApi.deleteSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
      toast.success(`${name} deleted`);
    } catch {
      toast.error('Failed to delete file');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Data Upload</h1>
        <p className="text-foreground-secondary text-sm mt-1">
          Upload your logistics data files — shipments, vendors, drivers, routes and more.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={!uploading ? handleBrowse : undefined}
        className={`glass-card rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
        } ${uploading ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">Uploading files…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {dragOver ? 'Drop files here' : 'Drag & drop files or click to browse'}
              </p>
              <p className="text-xs text-foreground-secondary mt-1">
                Supports CSV, XLSX, XLS · Multiple files allowed
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="glass-card rounded-xl p-4 border border-primary/20 flex gap-3">
        <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Supported data types</p>
          <p className="text-xs text-foreground-secondary mt-1">
            Shipments, Vendors, Vendor Metrics, Drivers, Driver Incidents, Trucks,
            Routes, Financials, Cost Planning, Market Intelligence
          </p>
        </div>
      </div>

      {/* Uploaded files */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">
          Uploaded Files
          {sources.length > 0 && (
            <span className="ml-2 text-xs font-normal text-foreground-secondary">({sources.length})</span>
          )}
        </h2>

        {loadingSources ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : sources.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center border border-dashed border-border">
            <FileText className="h-8 w-8 text-foreground-secondary/40 mx-auto mb-2" />
            <p className="text-sm text-foreground-secondary">No files uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((src) => (
              <div
                key={src.id}
                className="glass-card rounded-xl p-4 flex items-center gap-4 hover:border-border/80 transition-colors"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{src.file_name}</p>
                  <p className="text-xs text-foreground-secondary">
                    {formatBytes(src.file_size)} · Uploaded {formatDate(src.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(src.id, src.file_name)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-foreground-secondary hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                  title="Delete file"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogisticsDataUploadPage;
