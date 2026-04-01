import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Check, AlertTriangle, RotateCcw, Zap, FileText, X, Eye, Sparkles, Info } from 'lucide-react';
import { chatWithGroq } from '@/lib/groq';
import toast from 'react-hot-toast';

// ─── Field definitions ────────────────────────────────────────────────────────
// Only date + units_sold are truly required for forecasting to run.
// Everything else improves quality but doesn't block processing.

export const DEFAULT_PLATFORM_FIELDS = [
  {
    key: 'date',
    label: 'Date / Time',
    description: 'Transaction or order date',
    impact: 'Required for all forecasting. Without a time column, no analysis can run.',
    example: '2024-01-15, 15/01/2024, Jan 15 2024',
    required: true,
  },
  {
    key: 'units_sold',
    label: 'Units Sold / Quantity',
    description: 'Number of units sold or ordered',
    impact: 'The core metric we forecast. Without this, demand forecasting cannot compute.',
    example: '120, 450, 1200',
    required: true,
  },
  {
    key: 'product_name',
    label: 'Product Name',
    description: 'Name or description of the product / SKU',
    impact: 'Enables per-product forecasts and top SKU rankings. Without it, only aggregate totals are shown.',
    example: 'Wheat Flour 5kg, Sunflower Oil',
    required: false,
    recommended: true,
  },
  {
    key: 'sku',
    label: 'SKU / Product ID',
    description: 'Unique product code or identifier',
    impact: 'Used to group data precisely by product. Works alongside Product Name.',
    example: 'WF-5KG, SO-1L-001',
    required: false,
    recommended: true,
  },
  {
    key: 'stock_level',
    label: 'Stock Level / Inventory',
    description: 'Current on-hand inventory quantity',
    impact: 'Powers stockout risk detection and days-of-supply alerts. Missing = no inventory warnings.',
    example: '350, 0, 1200',
    required: false,
  },
  {
    key: 'warehouse',
    label: 'Warehouse / Location',
    description: 'Warehouse, store or distribution centre name',
    impact: 'Enables location-level breakdown and warehouse-specific alerts.',
    example: 'Mumbai-West, Delhi-North',
    required: false,
  },
  {
    key: 'region',
    label: 'Region / Territory',
    description: 'Sales region or geographic zone',
    impact: 'Enables regional demand analysis. Useful for multi-territory operations.',
    example: 'North, South, West',
    required: false,
  },
  {
    key: 'unit_price',
    label: 'Unit Price / Revenue',
    description: 'Price per unit or transaction value',
    impact: 'Enables revenue forecasting alongside demand volumes.',
    example: '45.00, 120.50',
    required: false,
  },
];

// ─── Purpose-specific field sets ──────────────────────────────────────────────

export const FORECASTING_FIELDS = [
  {
    key: 'date',
    label: 'Date / Time',
    description: 'Transaction or order date',
    impact: 'Required. Without a date column no time-series analysis can run.',
    example: '2024-01-15, 15/01/2024',
    required: true,
  },
  {
    key: 'units_sold',
    label: 'Units Sold / Quantity',
    description: 'Number of units sold or ordered',
    impact: 'The core demand metric. Required to run any forecast.',
    example: '120, 450, 1200',
    required: true,
  },
  {
    key: 'sku',
    label: 'SKU / Product ID',
    description: 'Unique product code or identifier',
    impact: 'Enables per-SKU forecasts and top-product rankings.',
    example: 'WF-5KG, SO-1L-001',
    required: false,
    recommended: true,
  },
  {
    key: 'product_name',
    label: 'Product Name',
    description: 'Name or description of the product',
    impact: 'Labels charts and tables with readable product names.',
    example: 'Wheat Flour 5kg, Sunflower Oil',
    required: false,
    recommended: true,
  },
  {
    key: 'region',
    label: 'Region / Territory',
    description: 'Sales region or geographic zone',
    impact: 'Enables regional demand breakdown.',
    example: 'North, South, West',
    required: false,
  },
  {
    key: 'unit_price',
    label: 'Unit Price / Revenue',
    description: 'Price per unit or transaction value',
    impact: 'Enables revenue forecasting alongside volume.',
    example: '45.00, 120.50',
    required: false,
  },
];

export const INVENTORY_FIELDS = [
  {
    key: 'date',
    label: 'Date / Time',
    description: 'Transaction or stock record date',
    impact: 'Required. Used to calculate average daily demand.',
    example: '2024-01-15, 15/01/2024',
    required: true,
  },
  {
    key: 'units_sold',
    label: 'Units Sold / Quantity',
    description: 'Units sold, consumed, or dispatched',
    impact: 'Required. Drives Safety Stock, ROP, and EOQ calculations.',
    example: '120, 450, 1200',
    required: true,
  },
  {
    key: 'sku',
    label: 'SKU / Product ID',
    description: 'Unique product code or identifier',
    impact: 'Enables per-SKU optimization results.',
    example: 'WF-5KG, SO-1L-001',
    required: false,
    recommended: true,
  },
  {
    key: 'product_name',
    label: 'Product Name',
    description: 'Name or description of the product',
    impact: 'Labels inventory tables with readable product names.',
    example: 'Wheat Flour 5kg, Sunflower Oil',
    required: false,
    recommended: true,
  },
  {
    key: 'stock_level',
    label: 'Stock Level / Inventory',
    description: 'Current on-hand inventory quantity',
    impact: 'Powers stockout risk, days-of-supply, and reorder alerts.',
    example: '350, 0, 1200',
    required: false,
    recommended: true,
  },
  {
    key: 'warehouse',
    label: 'Warehouse / Location',
    description: 'Warehouse, store or distribution centre name',
    impact: 'Enables per-warehouse breakdown and location-level alerts.',
    example: 'Mumbai-West, Delhi-North',
    required: false,
  },
];

const SKIP_VALUE = '__skip__';

// ─── Fuzzy auto-mapping ───────────────────────────────────────────────────────

const ALIASES = {
  date: [
    'date', 'orderdate', 'saledate', 'transactiondate', 'invoice_date', 'order_date',
    'sale_date', 'period', 'month', 'week', 'timestamp', 'created_at', 'recorded_at',
    'delivery_date', 'dispatch_date', 'shipped_date', 'posting_date', 'entry_date',
    'doc_date', 'document_date', 'bill_date', 'billing_date', 'po_date', 'podate',
  ],
  units_sold: [
    'units', 'quantity', 'qty', 'sold', 'unitssold', 'orderquantity', 'sales_qty',
    'demand', 'volume', 'sales_volume', 'qty_sold', 'count', 'order_qty', 'dispatch_qty',
    'transfer_qty', 'shipment_qty', 'issued_qty', 'consumed_qty', 'sales_quantity',
    'order_quantity', 'dispatch_quantity', 'sold_qty', 'actual_qty', 'actual_sales',
  ],
  product_name: [
    'product', 'item', 'name', 'productname', 'itemname', 'description', 'product_desc',
    'item_name', 'goods', 'material', 'material_description', 'mat_desc', 'article',
    'article_description', 'item_description', 'product_description', 'commodity',
    'product_title', 'item_title', 'good_name',
  ],
  sku: [
    'sku', 'skucode', 'productid', 'itemid', 'code', 'product_code', 'item_code',
    'article', 'article_no', 'barcode', 'part_no', 'material_no', 'material_code',
    'mat_no', 'mat_code', 'item_no', 'product_no', 'part_number', 'part_code',
    'ean', 'upc', 'stock_code', 'catalog_no', 'ref_no', 'reference',
  ],
  stock_level: [
    'stock', 'inventory', 'stocklevel', 'currentstock', 'onhand', 'closing_stock',
    'balance', 'stock_on_hand', 'available', 'on_hand', 'opening_stock', 'qty_on_hand',
    'stock_balance', 'available_qty', 'physical_stock', 'unrestricted_stock',
    'net_stock', 'book_stock', 'warehouse_stock', 'ending_stock', 'end_stock',
  ],
  warehouse: [
    'warehouse', 'location', 'store', 'branch', 'site', 'depot', 'dc', 'centre',
    'facility', 'plant', 'storage_location', 'sloc', 'plant_code', 'distribution_centre',
    'fulfillment_centre', 'hub', 'node',
  ],
  region: [
    'region', 'area', 'territory', 'zone', 'market', 'geography', 'state', 'city',
    'district', 'cluster', 'beat', 'route', 'sales_area', 'sales_territory',
  ],
  unit_price: [
    'price', 'unitprice', 'cost', 'rate', 'value', 'mrp', 'selling_price', 'sp',
    'revenue', 'net_price', 'list_price', 'sale_price', 'unit_cost', 'per_unit_price',
  ],
};

function fuzzyMatch(header, fieldKey) {
  const h = header.toLowerCase().replace(/[_\-\s\.]+/g, '');
  const fieldAliases = ALIASES[fieldKey] || [];
  for (const alias of fieldAliases) {
    const a = alias.replace(/[_\-\s\.]+/g, '');
    if (h === a) return 100;
    if (h.includes(a) || a.includes(h)) return 80;
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
      const score = fuzzyMatch(header, field.key);
      if (score > bestScore && score >= 70) { bestScore = score; bestMatch = header; }
    }
    if (bestMatch) { mapping[field.key] = bestMatch; usedHeaders.add(bestMatch); }
    else { mapping[field.key] = SKIP_VALUE; }
  }
  return mapping;
}

export function parseCSVPreview(text) {
  const lines = text.split('\n').filter((l) => l.trim());
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

// ─── AI mapping via Groq ──────────────────────────────────────────────────────

async function aiAutoMap(headers, previewRows, fields) {
  const sampleData = previewRows.slice(0, 2).map((row) =>
    headers.reduce((obj, h, i) => { obj[h] = row[i]; return obj; }, {})
  );

  const fieldDescriptions = fields.map((f) => `"${f.key}": ${f.label} — ${f.description}`).join('\n');

  const prompt = `You are a data schema mapping assistant. Given these CSV column headers and sample rows, map each column to the most appropriate platform field.

CSV Headers: ${JSON.stringify(headers)}
Sample rows: ${JSON.stringify(sampleData)}

Platform fields to map to:
${fieldDescriptions}

Return ONLY a valid JSON object where:
- keys are platform field keys (e.g. "date", "units_sold", "product_name", etc.)
- values are the CSV column header that best matches, or "__skip__" if no good match
- every platform field key must appear in the output

Example output format:
{"date": "Order Date", "units_sold": "Qty", "product_name": "Item Name", "sku": "__skip__", "stock_level": "Stock", "warehouse": "__skip__", "region": "__skip__", "unit_price": "Price"}`;

  const response = await chatWithGroq(
    [{ role: 'user', content: prompt }],
    'You are a precise data mapping assistant. Return only valid JSON, no explanation.'
  );

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON');
  const parsed = JSON.parse(jsonMatch[0]);

  // Validate — only keep keys that are valid platform fields and values that exist in headers or are SKIP_VALUE
  const validated = {};
  for (const field of fields) {
    const val = parsed[field.key];
    if (val === SKIP_VALUE || headers.includes(val)) {
      validated[field.key] = val || SKIP_VALUE;
    } else {
      validated[field.key] = SKIP_VALUE;
    }
  }
  return validated;
}

// ─── Component ────────────────────────────────────────────────────────────────

const SchemaMapping = ({ files, onUpdateMapping, onProcess, onResetMapping, onRemoveFile, platformFields }) => {
  const [expandedFile, setExpandedFile] = useState(files[0]?.id || null);
  const [previewFile, setPreviewFile] = useState(null);
  const [aiMappingLoading, setAiMappingLoading] = useState({});
  const [expandedField, setExpandedField] = useState(null);

  const handleAiMap = async (fileId, headers, previewRows) => {
    setAiMappingLoading((prev) => ({ ...prev, [fileId]: true }));
    try {
      const mapping = await aiAutoMap(headers, previewRows, platformFields);
      onUpdateMapping(fileId, mapping);
      toast.success('AI mapped your columns!');
    } catch (err) {
      toast.error('AI mapping failed — map manually');
      console.error(err);
    } finally {
      setAiMappingLoading((prev) => ({ ...prev, [fileId]: false }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 mb-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-foreground mb-1">Schema Mapping</p>
          <p className="text-xs text-foreground-secondary">
            Tell us which columns contain which data. Only <span className="font-semibold text-foreground">Date</span> and <span className="font-semibold text-foreground">Units Sold</span> are required to run forecasting.
            All other fields improve the analysis but are optional — leave them as <span className="font-mono bg-muted px-1 rounded text-[10px]">-- Skip --</span> if not available.
          </p>
        </div>
      </div>

      {files.map((uf, idx) => {
        const isExpanded = expandedFile === uf.id;
        const requiredFields = platformFields.filter((f) => f.required);
        const mappedRequired = requiredFields.filter((f) => uf.mapping[f.key] && uf.mapping[f.key] !== SKIP_VALUE).length;
        const allRequiredMapped = mappedRequired === requiredFields.length;
        const totalMapped = platformFields.filter((f) => uf.mapping[f.key] && uf.mapping[f.key] !== SKIP_VALUE).length;

        return (
          <div key={uf.id} className="glass-card rounded-xl border border-border overflow-hidden">
            {/* Header row */}
            <button
              onClick={() => setExpandedFile(isExpanded ? null : uf.id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-background-elevated/30 transition-colors text-left"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-foreground-secondary" /> : <ChevronRight className="h-4 w-4 text-foreground-secondary" />}
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground flex-1">{idx + 1}. {uf.file.name}</span>
              <span className="text-xs text-foreground-secondary mr-2">{(uf.file.size / 1024).toFixed(1)} KB · {totalMapped}/{platformFields.length} mapped</span>
              {uf.status === 'ready' ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success flex items-center gap-1">
                  <Check className="h-3 w-3" /> Processed
                </span>
              ) : allRequiredMapped ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">Ready to process</span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Map required fields
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveFile(uf.id); }}
                className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/10 transition-colors ml-1"
              >
                <X className="h-3.5 w-3.5 text-destructive" />
              </button>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4">
                    {/* AI map button */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAiMap(uf.id, uf.headers, uf.previewRows)}
                        disabled={aiMappingLoading[uf.id]}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/30 text-sm font-medium text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {aiMappingLoading[uf.id] ? 'AI mapping...' : 'Auto-map with AI'}
                      </button>
                      <button
                        onClick={() => onResetMapping(uf.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-foreground-secondary hover:bg-muted transition-colors"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                      </button>
                      <span className="text-xs text-foreground-secondary ml-auto">
                        {uf.headers.length} columns detected in file
                      </span>
                    </div>

                    {/* Field mapping rows */}
                    <div className="space-y-1">
                      {/* Required fields first */}
                      {[...platformFields.filter(f => f.required), ...platformFields.filter(f => !f.required)].map((field) => {
                        const currentValue = uf.mapping[field.key] || SKIP_VALUE;
                        const isMapped = currentValue !== SKIP_VALUE;
                        const isInfoOpen = expandedField === `${uf.id}-${field.key}`;

                        return (
                          <div key={field.key} className={`rounded-lg border transition-colors ${
                            field.required
                              ? isMapped ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'
                              : isMapped ? 'border-primary/20 bg-primary/5' : 'border-border'
                          }`}>
                            <div className="flex items-center gap-3 p-3">
                              {/* Status icon */}
                              <div className="w-5 flex-shrink-0">
                                {isMapped
                                  ? <Check className={`h-4 w-4 ${field.required ? 'text-success' : 'text-primary'}`} />
                                  : field.required
                                    ? <AlertTriangle className="h-4 w-4 text-warning" />
                                    : <div className="h-4 w-4 rounded-full border border-border" />
                                }
                              </div>

                              {/* Label + badges */}
                              <div className="w-40 flex-shrink-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-medium text-foreground">{field.label}</span>
                                  {field.required && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive">required</span>
                                  )}
                                  {field.recommended && !field.required && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">recommended</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-foreground-secondary mt-0.5">{field.description}</p>
                              </div>

                              {/* Dropdown */}
                              <div className="flex-1">
                                <select
                                  value={currentValue}
                                  onChange={(e) => onUpdateMapping(uf.id, { ...uf.mapping, [field.key]: e.target.value })}
                                  className="w-full px-3 py-2 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                                >
                                  <option value={SKIP_VALUE}>-- Skip this field --</option>
                                  {uf.headers.map((h) => (
                                    <option key={h} value={h}>{h}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Info toggle */}
                              <button
                                onClick={() => setExpandedField(isInfoOpen ? null : `${uf.id}-${field.key}`)}
                                className="h-7 w-7 rounded flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0"
                              >
                                <Info className={`h-3.5 w-3.5 ${isInfoOpen ? 'text-primary' : 'text-foreground-secondary'}`} />
                              </button>
                            </div>

                            {/* Expandable impact info */}
                            <AnimatePresence>
                              {isInfoOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-3 pl-12 space-y-1">
                                    <p className="text-xs text-foreground-secondary">
                                      <span className="font-semibold text-foreground">Impact: </span>{field.impact}
                                    </p>
                                    <p className="text-xs text-foreground-secondary">
                                      <span className="font-semibold text-foreground">Example values: </span>
                                      <span className="font-mono">{field.example}</span>
                                    </p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>

                    {/* Warning if required fields missing — soft warning, not a hard block */}
                    {!allRequiredMapped && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                        <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-warning">
                            {requiredFields.filter(f => !(uf.mapping[f.key] && uf.mapping[f.key] !== SKIP_VALUE)).map(f => f.label).join(' and ')} not mapped
                          </p>
                          <p className="text-xs text-foreground-secondary mt-0.5">
                            These are needed for forecasting. You can still save the file, but forecasting will not run until they are mapped.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Data preview */}
                    {uf.previewRows.length > 0 && (
                      <div>
                        <button
                          onClick={() => setPreviewFile(previewFile === uf.id ? null : uf.id)}
                          className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {previewFile === uf.id ? 'Hide' : 'Show'} data preview ({uf.previewRows.length} rows)
                        </button>
                        <AnimatePresence>
                          {previewFile === uf.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-muted/50">
                                      {uf.headers.map((h) => (
                                        <th key={h} className="px-3 py-2 text-left font-medium text-foreground-secondary whitespace-nowrap">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {uf.previewRows.map((row, ri) => (
                                      <tr key={ri} className="border-t border-border">
                                        {row.map((cell, ci) => (
                                          <td key={ci} className="px-3 py-1.5 text-foreground whitespace-nowrap">{cell || '—'}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Process button — always enabled once at least 1 field mapped */}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => onProcess(uf.id)}
                        disabled={uf.status === 'processing' || uf.status === 'ready'}
                        className="gradient-brand text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover-lift disabled:opacity-50 flex items-center gap-2"
                      >
                        <Zap className="h-4 w-4" />
                        {uf.status === 'processing' ? 'Processing...' : `Save & Process`}
                      </button>
                      {!allRequiredMapped && uf.status !== 'processing' && uf.status !== 'ready' && (
                        <p className="text-xs text-warning">Forecasting will be limited without Date and Units Sold</p>
                      )}
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
