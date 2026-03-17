import { useState, useCallback, useEffect } from 'react';
import {
  Upload, FileText, Trash2, Download, RefreshCw, Plus, Loader2,
  TrendingUp, Package,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { uploadDataFile, fetchDataFiles, deleteDataFile, getFileDownloadUrl } from '@/lib/dataFiles';
import SchemaMapping, {
  FORECASTING_FIELDS,
  INVENTORY_FIELDS,
  autoMapHeaders,
  parseCSVPreview,
} from '@/components/data/SchemaMapping';

// ─── XLSX-aware file parser ───────────────────────────────────────────────────

async function parseFilePreview(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    const text = await file.text();
    return parseCSVPreview(text);
  }
  // xlsx / xls — use SheetJS
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headers = (data[0] || []).map(String);
  const rows = data.slice(1, 4).map((row) =>
    headers.map((_, i) => String(row[i] ?? ''))
  );
  return { headers, rows };
}

// ─── Upload section component ─────────────────────────────────────────────────

const UploadSection = ({
  title, description, icon: Icon, accentClass, fields, purpose,
  pendingFiles, setPendingFiles, user, onSaved,
}) => {
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(async (file) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { headers, rows } = await parseFilePreview(file);
    const mapping = autoMapHeaders(headers, fields);
    return { file, id, headers, previewRows: rows, mapping, status: 'mapping', purpose };
  }, [fields, purpose]);

  const handleFilesAdded = useCallback(async (fileList) => {
    const valid = Array.from(fileList).filter((f) =>
      f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (valid.length === 0) { toast.error('Please upload CSV or Excel files'); return; }
    const processed = await Promise.all(valid.map(processFile));
    setPendingFiles((prev) => [...prev, ...processed]);
    toast.success(`${valid.length} file(s) added to ${title}`);
  }, [processFile, setPendingFiles, title]);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false); handleFilesAdded(e.dataTransfer.files);
  };

  const handleBrowse = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.csv,.xlsx,.xls'; input.multiple = true;
    input.onchange = (e) => { if (e.target.files) handleFilesAdded(e.target.files); };
    input.click();
  };

  const handleUpdateMapping = (fileId, mapping) =>
    setPendingFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, mapping } : f));

  const handleResetMapping = (fileId) =>
    setPendingFiles((prev) => prev.map((f) => {
      if (f.id !== fileId) return f;
      return { ...f, mapping: autoMapHeaders(f.headers, fields), status: 'mapping' };
    }));

  const handleRemoveFile = (fileId) =>
    setPendingFiles((prev) => prev.filter((f) => f.id !== fileId));

  const handleProcess = async (fileId) => {
    const entry = pendingFiles.find((f) => f.id === fileId);
    if (!entry || !user) return;
    setPendingFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, status: 'processing' } : f));
    try {
      // Embed purpose in the column_mapping so it can be filtered later
      const mappingWithPurpose = { ...entry.mapping, __purpose__: purpose };
      await uploadDataFile(user.id, entry.file, mappingWithPurpose, entry.previewRows.length);
      setPendingFiles((prev) => prev.filter((f) => f.id !== fileId));
      await onSaved();
      toast.success('File uploaded!');
    } catch (err) {
      setPendingFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, status: 'mapping' } : f));
      toast.error(err.message || 'Upload failed');
    }
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Section header */}
      <div className={`px-5 py-4 border-b border-border flex items-center gap-3 ${accentClass}`}>
        <div className="h-8 w-8 rounded-lg bg-current/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-foreground-secondary">{description}</p>
        </div>
        {pendingFiles.length > 0 && (
          <button
            onClick={handleBrowse}
            className="ml-auto text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> Add more
          </button>
        )}
      </div>

      {/* Drop zone */}
      {pendingFiles.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={handleBrowse}
          className={`m-4 border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <Upload className="h-7 w-7 text-foreground-secondary mx-auto mb-2" />
          <p className="text-sm text-foreground-secondary">Drag & drop CSV or Excel files here</p>
          <p className="text-xs text-foreground-secondary mt-1">or click to browse · Multiple files supported</p>
        </div>
      )}

      {/* Schema mapping for pending files */}
      {pendingFiles.length > 0 && (
        <div className="p-4">
          <SchemaMapping
            files={pendingFiles}
            onUpdateMapping={handleUpdateMapping}
            onProcess={handleProcess}
            onResetMapping={handleResetMapping}
            onRemoveFile={handleRemoveFile}
            platformFields={fields}
          />
          {/* Add more after files exist */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={handleBrowse}
            className={`mt-3 border border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            }`}
          >
            <p className="text-xs text-foreground-secondary flex items-center justify-center gap-1">
              <Plus className="h-3 w-3" /> Drop more files here
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const DataUploadPage = () => {
  const { user } = useAuthStore();
  const [savedFiles, setSavedFiles] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [forecastFiles, setForecastFiles] = useState([]);
  const [inventoryFiles, setInventoryFiles] = useState([]);

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

  const handleDelete = async (file) => {
    try {
      await deleteDataFile(file.id, file.storage_path);
      setSavedFiles((prev) => prev.filter((f) => f.id !== file.id));
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

  const purposeLabel = (file) => {
    const p = file.column_mapping?.__purpose__;
    if (p === 'forecasting') return { label: 'Forecasting', cls: 'bg-primary/10 text-primary' };
    if (p === 'inventory') return { label: 'Inventory', cls: 'bg-success/10 text-success' };
    return { label: 'General', cls: 'bg-muted text-foreground-secondary' };
  };

  const forecastingSaved = savedFiles.filter(
    (f) => !f.column_mapping?.__purpose__ || f.column_mapping.__purpose__ === 'forecasting'
  );
  const inventorySaved = savedFiles.filter(
    (f) => f.column_mapping?.__purpose__ === 'inventory'
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Data Management</h1>
        <p className="text-sm text-foreground-secondary">
          Upload data for demand forecasting and inventory optimization separately — each section maps only the fields it needs.
        </p>
      </div>

      {/* ── Demand Forecasting section ── */}
      <UploadSection
        title="Demand Forecasting"
        description="Sales history data · XGBoost demand forecasts, trend analysis, and seasonality"
        icon={TrendingUp}
        accentClass="bg-primary/5"
        fields={FORECASTING_FIELDS}
        purpose="forecasting"
        pendingFiles={forecastFiles}
        setPendingFiles={setForecastFiles}
        user={user}
        onSaved={loadSavedFiles}
      />

      {/* ── Inventory Optimization section ── */}
      <UploadSection
        title="Inventory Optimization"
        description="Stock & demand data · Safety Stock, Reorder Point, and EOQ per SKU and warehouse"
        icon={Package}
        accentClass="bg-success/5"
        fields={INVENTORY_FIELDS}
        purpose="inventory"
        pendingFiles={inventoryFiles}
        setPendingFiles={setInventoryFiles}
        user={user}
        onSaved={loadSavedFiles}
      />

      {/* ── Saved files ── */}
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
          <button
            onClick={loadSavedFiles}
            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
            title="Refresh"
          >
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
            {savedFiles.map((file) => {
              const badge = purposeLabel(file);
              return (
                <div
                  key={file.id}
                  className="p-4 flex items-center justify-between hover:bg-background-elevated/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{file.file_name}</p>
                      <p className="text-xs text-foreground-secondary">
                        {file.row_count ? `${file.row_count.toLocaleString()} rows · ` : ''}
                        {file.file_type?.toUpperCase()} · {formatSize(file.file_size)} · {new Date(file.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span>
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
              );
            })}
          </div>
        )}
      </div>

      {/* ── Summary ── */}
      <div className="glass-card p-5 rounded-xl">
        <h3 className="text-sm font-semibold text-foreground mb-4">Data Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-xl font-bold text-primary">{forecastingSaved.length}</p>
            <p className="text-xs text-foreground-secondary mt-1">Forecasting Files</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-success">{inventorySaved.length}</p>
            <p className="text-xs text-foreground-secondary mt-1">Inventory Files</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">
              {savedFiles.reduce((s, f) => s + (f.row_count || 0), 0).toLocaleString()}
            </p>
            <p className="text-xs text-foreground-secondary mt-1">Total Rows</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-foreground-secondary">
              {formatSize(savedFiles.reduce((s, f) => s + (f.file_size || 0), 0))}
            </p>
            <p className="text-xs text-foreground-secondary mt-1">Total Size</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataUploadPage;
