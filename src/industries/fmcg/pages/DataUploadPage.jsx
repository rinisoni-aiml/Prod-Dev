import { useState, useCallback, useEffect } from 'react';
import {
  Upload, FileText, Trash2, Download, RefreshCw, Plus, Loader2,
  TrendingUp, Package, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useFmcgStore } from '@/stores/fmcgStore';
import { forecastApi, inventoryApi, dataApi } from '@/lib/api';
import { uploadDataFile, fetchDataFiles, deleteDataFile, getFileDownloadUrl } from '@/lib/dataFiles';
import SchemaMapping, {
  FORECASTING_FIELDS,
  INVENTORY_FIELDS,
  autoMapHeaders,
  parseCSVPreview,
} from '@/components/data/SchemaMapping';

// ─── Sample filenames that trigger duplicate detection ────────────────────────
const SAMPLE_FILENAMES = new Set([
  'fmcg_sales_BIG.csv',
  'fmcg_inventory_BIG.csv',
  'fmcg_po_BIG.csv',
  'fmcg_products_BIG.csv',
  'fmcg_wh_BIG.csv',
]);

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

// ─── Duplicate file detection modal ──────────────────────────────────────────

const DuplicateSampleModal = ({ fileName, onUseSample, onUploadAnyway, onClose }) => (
  <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
    <div className="glass-card p-6 rounded-2xl max-w-sm w-full mx-4 shadow-xl">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertTriangle className="h-5 w-5 text-warning" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">File matches sample data</p>
          <p className="text-xs text-foreground-secondary mt-1">
            <span className="font-medium text-foreground">{fileName}</span> already exists as
            sample data. Loading sample results is instant — no reprocessing needed.
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-5">
        <button
          onClick={onUseSample}
          className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Use Sample Data
        </button>
        <button
          onClick={onUploadAnyway}
          className="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          Upload Anyway
        </button>
      </div>
      <button
        onClick={onClose}
        className="mt-2 w-full px-3 py-1.5 rounded-lg text-xs text-foreground-secondary hover:bg-muted transition-colors"
      >
        Cancel
      </button>
    </div>
  </div>
);

// ─── Upload section component ─────────────────────────────────────────────────

const UploadSection = ({
  title, description, icon: Icon, accentClass, fields, purpose,
  pendingFiles, setPendingFiles, user, onSaved, onLoadSample,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState(null); // { file }

  const processFile = useCallback(async (file) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { headers, rows } = await parseFilePreview(file);
    const mapping = autoMapHeaders(headers, fields);
    return { file, id, headers, previewRows: rows, mapping, status: 'mapping', purpose };
  }, [fields, purpose]);

  const addFiles = useCallback(async (files) => {
    const processed = await Promise.all(files.map(processFile));
    setPendingFiles((prev) => [...prev, ...processed]);
    toast.success(`${files.length} file(s) added to ${title}`);
  }, [processFile, setPendingFiles, title]);

  const handleFilesAdded = useCallback(async (fileList) => {
    const valid = Array.from(fileList).filter((f) =>
      f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (valid.length === 0) { toast.error('Please upload CSV or Excel files'); return; }

    // Check each file for a sample filename match — prompt on first match found
    const sampleMatch = valid.find((f) => SAMPLE_FILENAMES.has(f.name));
    if (sampleMatch) {
      setDuplicatePrompt({ file: sampleMatch, remaining: valid.filter((f) => f !== sampleMatch) });
      return;
    }

    await addFiles(valid);
  }, [addFiles]);

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
      const mappingWithPurpose = { ...entry.mapping, __purpose__: purpose };
      const saved = await uploadDataFile(user.id, entry.file, mappingWithPurpose, entry.previewRows.length);
      setPendingFiles((prev) => prev.filter((f) => f.id !== fileId));
      await onSaved(saved?.id, purpose);
    } catch (err) {
      setPendingFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, status: 'mapping' } : f));
      toast.error(err.message || 'Upload failed');
    }
  };

  // Duplicate modal handlers
  const handleUseSample = useCallback(async () => {
    const prompt = duplicatePrompt;
    setDuplicatePrompt(null);
    await onLoadSample();
    // If there were other (non-sample) files in the batch, add them normally
    if (prompt?.remaining?.length) {
      const nonSample = prompt.remaining.filter((f) => !SAMPLE_FILENAMES.has(f.name));
      if (nonSample.length) await addFiles(nonSample);
    }
  }, [duplicatePrompt, onLoadSample, addFiles]);

  const handleUploadAnyway = useCallback(async () => {
    const prompt = duplicatePrompt;
    setDuplicatePrompt(null);
    const allFiles = [prompt.file, ...(prompt.remaining || [])];
    await addFiles(allFiles);
  }, [duplicatePrompt, addFiles]);

  return (
    <>
      {duplicatePrompt && (
        <DuplicateSampleModal
          fileName={duplicatePrompt.file.name}
          onUseSample={handleUseSample}
          onUploadAnyway={handleUploadAnyway}
          onClose={() => setDuplicatePrompt(null)}
        />
      )}

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
    </>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const DataUploadPage = () => {
  const { user } = useAuthStore();
  const { setForecastResults, setInventoryResults } = useFmcgStore();
  const queryClient = useQueryClient();
  const [savedFiles, setSavedFiles] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [forecastFiles, setForecastFiles] = useState([]);
  const [inventoryFiles, setInventoryFiles] = useState([]);
  const [autoRun, setAutoRun] = useState(null); // { message, step, done }

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

  const triggerAutoRun = useCallback(async (fileId, purpose) => {
    if (!fileId) return;
    try {
      if (purpose === 'forecasting') {
        setAutoRun({ message: 'Running demand forecast on your data…', step: 'forecast', done: false });
        const response = await forecastApi.runForecast(fileId, 30);
        const { skus, results } = response.data;
        setForecastResults({
          allResults: results,
          skuList: skus,
          horizon: 30,
          selectedFileId: fileId,
          modelType: results?.['All Products']?.model || null,
        });
        queryClient.invalidateQueries({ queryKey: ['dashboard-demand-trend'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-top-skus'] });
        setAutoRun({ message: 'Forecast ready! Your dashboard has been updated.', step: 'forecast', done: true });
      } else if (purpose === 'inventory') {
        setAutoRun({ message: 'Running inventory optimization on your data…', step: 'inventory', done: false });
        const response = await inventoryApi.runOptimization({ file_id: fileId });
        setInventoryResults(response.data);
        queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-inventory-snapshot'] });
        setAutoRun({ message: 'Inventory optimization ready! Your dashboard has been updated.', step: 'inventory', done: true });
      }
      setTimeout(() => setAutoRun(null), 3000);
    } catch {
      setAutoRun(null);
      toast.error('Auto-analysis failed — you can run it manually from the Forecasting or Inventory pages.');
    }
  }, [setForecastResults, setInventoryResults, queryClient]);

  const handleFileSaved = useCallback(async (savedFileId, purpose) => {
    await loadSavedFiles();
    toast.success('File uploaded!');
    triggerAutoRun(savedFileId, purpose);
  }, [loadSavedFiles, triggerAutoRun]);

  // Called when user picks "Use Sample Data" from the duplicate modal
  const handleLoadSample = useCallback(async () => {
    setAutoRun({ message: 'Loading sample data…', step: 'sample', done: false });
    try {
      await dataApi.loadSampleData();
      await loadSavedFiles();
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-demand-trend'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-inventory-snapshot'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-top-skus'] });
      setAutoRun({ message: 'Sample data loaded!', step: 'sample', done: true });
      setTimeout(() => setAutoRun(null), 3000);
    } catch {
      setAutoRun(null);
      toast.error('Failed to load sample data');
    }
  }, [loadSavedFiles, queryClient]);

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

      {/* ── Auto-run processing overlay ── */}
      {autoRun && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="glass-card p-8 rounded-2xl text-center max-w-sm w-full mx-4 shadow-xl">
            {autoRun.done ? (
              <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-4" />
            ) : (
              <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
            )}
            <p className="text-base font-semibold text-foreground">{autoRun.message}</p>
            {!autoRun.done && (
              <p className="text-sm text-foreground-secondary mt-2">
                Hang tight — we're analysing your data with AI
              </p>
            )}
          </div>
        </div>
      )}

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
        onSaved={handleFileSaved}
        onLoadSample={handleLoadSample}
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
        onSaved={handleFileSaved}
        onLoadSample={handleLoadSample}
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
                        {file.file_name?.split('.').pop().toUpperCase()} · {formatSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString()}
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
