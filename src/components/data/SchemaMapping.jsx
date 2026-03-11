import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Check, AlertTriangle, RotateCcw, Zap, FileText, X, Eye } from 'lucide-react';

export const DEFAULT_PLATFORM_FIELDS = [
  { key: 'product_name', label: 'Product Name', description: 'Product/SKU name', required: true },
  { key: 'sku', label: 'SKU Code', description: 'Unique product identifier', required: true },
  { key: 'date', label: 'Date', description: 'Order or record date', required: true },
  { key: 'units_sold', label: 'Units Sold', description: 'Quantity sold', required: true },
  { key: 'stock_level', label: 'Current Stock', description: 'Current inventory level', required: true },
  { key: 'warehouse', label: 'Warehouse', description: 'Warehouse or location', required: true },
  { key: 'region', label: 'Region', description: 'Sales region or warehouse', required: true },
  { key: 'unit_price', label: 'Unit Price', description: 'Unit price', required: false },
];

const SKIP_VALUE = '__skip__';

function fuzzyMatch(header, fieldKey, fieldLabel) {
  const h = header.toLowerCase().replace(/[_\-\s]+/g, '');
  const k = fieldKey.toLowerCase().replace(/[_\-\s]+/g, '');
  const l = fieldLabel.toLowerCase().replace(/[_\-\s]+/g, '');
  if (h === k || h === l) return 100;
  if (h.includes(k) || k.includes(h)) return 85;
  if (h.includes(l) || l.includes(h)) return 85;
  const aliases = {
    product_name: ['product', 'item', 'name', 'productname', 'itemname'],
    sku: ['sku', 'skucode', 'productid', 'itemid', 'code'],
    date: ['date', 'orderdate', 'saledate', 'transactiondate', 'joindate'],
    units_sold: ['units', 'quantity', 'qty', 'sold', 'unitssold', 'orderquantity'],
    stock_level: ['stock', 'inventory', 'stocklevel', 'currentstock', 'onhand'],
    warehouse: ['warehouse', 'location', 'store', 'branch', 'site'],
    region: ['region', 'area', 'territory', 'zone', 'market'],
    unit_price: ['price', 'unitprice', 'cost', 'rate', 'amount'],
  };
  const fieldAliases = aliases[fieldKey] || [];
  for (const alias of fieldAliases) {
    if (h === alias || h.includes(alias) || alias.includes(h)) return 80;
  }
  return 0;
}

export function autoMapHeaders(headers, fields) {
  const mapping = {};
  const usedHeaders = new Set();
  for (const field of fields) {
    let bestMatch = '';
    let bestScore = 0;
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      const score = fuzzyMatch(header, field.key, field.label);
      if (score > bestScore && score >= 75) { bestScore = score; bestMatch = header; }
    }
    if (bestMatch) { mapping[field.key] = bestMatch; usedHeaders.add(bestMatch); }
    else { mapping[field.key] = SKIP_VALUE; }
  }
  return mapping;
}

export function parseCSVPreview(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const splitLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += char;
    }
    result.push(current.trim());
    return result;
  };
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1, 4).map(splitLine);
  return { headers, rows };
}

const SchemaMapping = ({ files, onUpdateMapping, onProcess, onResetMapping, onRemoveFile, platformFields }) => {
  const [expandedFile, setExpandedFile] = useState(files[0]?.id || null);
  const [previewFile, setPreviewFile] = useState(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-foreground">Schema Mapping</h3>
        <p className="text-xs text-foreground-secondary">
          Map your columns to platform fields. Leave optional fields as <span className="px-1.5 py-0.5 rounded bg-muted text-foreground-secondary text-[10px] font-mono">-- Skip --</span>.
        </p>
      </div>
      {files.map((uf, idx) => {
        const isExpanded = expandedFile === uf.id;
        const requiredFields = platformFields.filter(f => f.required);
        const mappedRequired = requiredFields.filter(f => uf.mapping[f.key] && uf.mapping[f.key] !== SKIP_VALUE).length;
        const allRequiredMapped = mappedRequired === requiredFields.length;
        return (
          <div key={uf.id} className="glass-card rounded-xl border border-border overflow-hidden">
            <button onClick={() => setExpandedFile(isExpanded ? null : uf.id)} className="w-full flex items-center gap-3 p-4 hover:bg-background-elevated/30 transition-colors text-left">
              {isExpanded ? <ChevronDown className="h-4 w-4 text-foreground-secondary" /> : <ChevronRight className="h-4 w-4 text-foreground-secondary" />}
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground flex-1">{idx + 1}. {uf.file.name}</span>
              <span className="text-xs text-foreground-secondary mr-2">{(uf.file.size / 1024).toFixed(1)} KB</span>
              {uf.status === 'ready' ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success flex items-center gap-1"><Check className="h-3 w-3" /> Processed</span>
              ) : allRequiredMapped ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">Ready</span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {mappedRequired}/{requiredFields.length} mapped</span>
              )}
              <button onClick={(e) => { e.stopPropagation(); onRemoveFile(uf.id); }} className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/10 transition-colors ml-1"><X className="h-3.5 w-3.5 text-destructive" /></button>
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-4">
                    <div className="space-y-2">
                      {platformFields.map((field) => {
                        const currentValue = uf.mapping[field.key] || SKIP_VALUE;
                        const isMapped = currentValue !== SKIP_VALUE;
                        return (
                          <div key={field.key} className="flex items-start gap-4">
                            <div className="w-36 flex-shrink-0 pt-2">
                              <p className="text-sm font-medium text-foreground">{field.label}</p>
                              <p className="text-[11px] text-foreground-secondary">{field.description}</p>
                            </div>
                            <div className="flex-1">
                              <select value={currentValue} onChange={(e) => { onUpdateMapping(uf.id, { ...uf.mapping, [field.key]: e.target.value }); }}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer">
                                <option value={SKIP_VALUE}>-- Skip --</option>
                                {uf.headers.map((h) => (<option key={h} value={h}>{h}</option>))}
                              </select>
                            </div>
                            <div className="w-8 pt-2.5 flex-shrink-0">
                              {field.required ? (isMapped ? <Check className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />) : <span className="text-[10px] text-foreground-secondary">optional</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!allRequiredMapped && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                        <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                        <p className="text-xs text-warning">{requiredFields.length - mappedRequired} required field(s) still need mapping.</p>
                      </div>
                    )}
                    {uf.previewRows.length > 0 && (
                      <div>
                        <button onClick={() => setPreviewFile(previewFile === uf.id ? null : uf.id)} className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors font-medium">
                          <Eye className="h-3.5 w-3.5" />{previewFile === uf.id ? 'Hide' : 'Show'} data preview ({uf.previewRows.length} rows)
                        </button>
                        <AnimatePresence>
                          {previewFile === uf.id && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                                <table className="w-full text-xs">
                                  <thead><tr className="bg-muted/50">{uf.headers.map((h) => (<th key={h} className="px-3 py-2 text-left font-medium text-foreground-secondary whitespace-nowrap">{h}</th>))}</tr></thead>
                                  <tbody>{uf.previewRows.map((row, ri) => (<tr key={ri} className="border-t border-border">{row.map((cell, ci) => (<td key={ci} className="px-3 py-1.5 text-foreground whitespace-nowrap">{cell || '—'}</td>))}</tr>))}</tbody>
                                </table>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <button onClick={() => onProcess(uf.id)} disabled={!allRequiredMapped || uf.status === 'processing' || uf.status === 'ready'}
                        className="gradient-brand text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover-lift disabled:opacity-50 flex items-center gap-2">
                        <Zap className="h-4 w-4" />{uf.status === 'processing' ? 'Processing...' : `Process ${uf.file.name}`}
                      </button>
                      <button onClick={() => onResetMapping(uf.id)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground-secondary hover:bg-muted transition-colors flex items-center gap-2">
                        <RotateCcw className="h-3.5 w-3.5" /> Reset mapping
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};
export default SchemaMapping;
