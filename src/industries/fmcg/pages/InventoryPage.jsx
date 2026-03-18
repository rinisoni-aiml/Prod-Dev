import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Warehouse, Loader2, ChevronDown, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { inventoryApi } from '@/lib/api';
import { fetchDataFiles } from '@/lib/dataFiles';
import { useFmcgStore } from '@/stores/fmcgStore';
import toast from 'react-hot-toast';

const SNAPSHOT_COLORS = {
  Optimal: 'hsl(160, 84%, 39%)',
  'Low Stock': 'hsl(38, 92%, 50%)',
  Stockout: 'hsl(0, 84%, 60%)',
  Overstock: 'hsl(217, 91%, 60%)',
};

const STATUS_STYLE = {
  stockout:  { label: 'Stockout',   cls: 'bg-destructive/10 text-destructive' },
  order_now: { label: 'Order Now',  cls: 'bg-warning/10 text-warning' },
  watch:     { label: 'Watch',      cls: 'bg-primary/10 text-primary' },
  overstock: { label: 'Overstock',  cls: 'bg-muted text-foreground-secondary' },
  ok:        { label: 'OK',         cls: 'bg-success/10 text-success' },
};

const InventoryPage = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const enabled = !!user;

  const { data: overview } = useQuery({
    queryKey: ['inventory-overview'],
    queryFn: () => inventoryApi.getOverview().then((r) => r.data),
    enabled,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['inventory-warehouses'],
    queryFn: () => inventoryApi.getWarehouses().then((r) => r.data),
    enabled,
  });

  const { data: reorderQueue = [] } = useQuery({
    queryKey: ['inventory-reorder'],
    queryFn: () => inventoryApi.getReorderQueue().then((r) => r.data),
    enabled,
  });

  const { data: abcAnalysis = [] } = useQuery({
    queryKey: ['inventory-abc'],
    queryFn: () => inventoryApi.getABCAnalysis().then((r) => r.data),
    enabled,
  });

  const tabs = [
    { id: 'overview',     label: 'Overview' },
    { id: 'warehouses',   label: 'Warehouse View' },
    { id: 'reorder',      label: 'Reorder Queue' },
    { id: 'abc',          label: 'ABC Analysis' },
    { id: 'optimization', label: 'Optimization' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-sm text-foreground-secondary">Real-time inventory intelligence</p>
        </div>
      </div>

      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === id
                ? 'gradient-brand text-primary-foreground shadow-sm'
                : 'text-foreground-secondary hover:text-foreground'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview'     && <OverviewTab overview={overview} />}
      {activeTab === 'warehouses'   && <WarehouseTab warehouses={warehouses} />}
      {activeTab === 'reorder'      && <ReorderTab reorderQueue={reorderQueue} />}
      {activeTab === 'abc'          && <ABCTab abcAnalysis={abcAnalysis} />}
      {activeTab === 'optimization' && <OptimizationTab user={user} />}
    </div>
  );
};

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewTab({ overview }) {
  const statusCards = [
    { label: 'Optimal Stock', value: overview?.optimal   ?? 0, color: 'text-success',     bg: 'bg-success/10' },
    { label: 'Low Stock',     value: overview?.low_stock ?? 0, color: 'text-warning',     bg: 'bg-warning/10' },
    { label: 'Stockout',      value: overview?.stockout  ?? 0, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Overstock',     value: overview?.overstock ?? 0, color: 'text-primary',     bg: 'bg-primary/10' },
  ];

  const healthScore = overview?.health_score ?? 0;
  const healthData  = [{ name: 'Health', value: healthScore, fill: 'hsl(217, 91%, 60%)' }];

  const snapshotData = [
    { name: 'Optimal',   value: overview?.optimal   ?? 0 },
    { name: 'Low Stock', value: overview?.low_stock ?? 0 },
    { name: 'Stockout',  value: overview?.stockout  ?? 0 },
    { name: 'Overstock', value: overview?.overstock ?? 0 },
  ].map((s) => ({ ...s, color: SNAPSHOT_COLORS[s.name] }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statusCards.map((card, i) => (
          <motion.div key={card.label}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-5 rounded-xl hover-lift">
            <p className="text-xs text-foreground-secondary mb-2">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-xl">
          <h3 className="text-sm font-semibold text-foreground mb-4">Inventory Health Score</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={healthData} startAngle={180} endAngle={0}>
              <RadialBar dataKey="value" cornerRadius={10} fill="hsl(217, 91%, 60%)"
                background={{ fill: 'hsl(var(--muted))' }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <p className="text-center text-3xl font-bold text-foreground -mt-16">
            {healthScore}<span className="text-lg text-foreground-secondary">/100</span>
          </p>
        </div>
        <div className="glass-card p-5 rounded-xl">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribution by Status</h3>
          {snapshotData.some((s) => s.value > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={snapshotData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={80} paddingAngle={3}>
                  {snapshotData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-sm text-foreground-secondary">No inventory data yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Warehouse view ───────────────────────────────────────────────────────────

function WarehouseTab({ warehouses }) {
  if (warehouses.length === 0) {
    return (
      <div className="glass-card p-12 rounded-xl text-center">
        <Warehouse className="h-10 w-10 text-foreground-secondary mx-auto mb-4" />
        <p className="text-lg font-semibold text-foreground mb-2">No warehouses yet</p>
        <p className="text-sm text-foreground-secondary">Warehouses will appear here once you upload inventory data.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-elevated/50">
              {['Warehouse', 'Total SKUs', 'Stockouts', 'Fill Rate', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {warehouses.map((wh) => (
              <tr key={wh.id} className="border-b border-border hover:bg-background-elevated/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-foreground-secondary" /> {wh.name}
                </td>
                <td className="px-4 py-3 text-foreground-secondary">{wh.total_skus}</td>
                <td className="px-4 py-3">
                  <span className={wh.stockouts > 5 ? 'text-destructive font-medium' : 'text-foreground-secondary'}>
                    {wh.stockouts}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${wh.fill_rate > 80 ? 'bg-success' : wh.fill_rate > 65 ? 'bg-warning' : 'bg-destructive'}`}
                        style={{ width: `${wh.fill_rate}%` }} />
                    </div>
                    <span className="text-xs text-foreground-secondary">{wh.fill_rate}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    wh.status === 'good' ? 'bg-success/10 text-success'
                      : wh.status === 'warning' ? 'bg-warning/10 text-warning'
                      : 'bg-destructive/10 text-destructive'
                  }`}>{wh.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Reorder queue ────────────────────────────────────────────────────────────

function ReorderTab({ reorderQueue }) {
  if (reorderQueue.length === 0) {
    return (
      <div className="glass-card p-12 rounded-xl text-center">
        <p className="text-lg font-semibold text-foreground mb-2">Reorder queue is empty</p>
        <p className="text-sm text-foreground-secondary">Items needing reorder will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-elevated/50">
              {['SKU', 'Product', 'Stock', 'Daily Avg', 'Days Left', 'Urgency', 'Warehouse', 'Action'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reorderQueue.map((item) => (
              <tr key={item.sku} className="border-b border-border hover:bg-background-elevated/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-foreground-secondary">{item.sku}</td>
                <td className="px-4 py-3 font-medium text-foreground">{item.product}</td>
                <td className="px-4 py-3 text-foreground-secondary">{item.current_stock}</td>
                <td className="px-4 py-3 text-foreground-secondary">{item.daily_avg}/day</td>
                <td className="px-4 py-3">
                  <span className={item.days_left < 3 ? 'text-destructive font-bold' : 'text-foreground-secondary'}>
                    {Number(item.days_left).toFixed(1)}d
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.urgency === 'critical' ? 'bg-destructive/10 text-destructive'
                      : item.urgency === 'high' ? 'bg-warning/10 text-warning'
                      : 'bg-primary/10 text-primary'
                  }`}>{item.urgency}</span>
                </td>
                <td className="px-4 py-3 text-foreground-secondary">{item.warehouse}</td>
                <td className="px-4 py-3">
                  <button className="px-3 py-1 rounded-lg text-xs font-medium gradient-brand text-primary-foreground hover-lift">
                    Create PO
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ABC Analysis ─────────────────────────────────────────────────────────────

function ABCTab({ abcAnalysis }) {
  const colors = ['hsl(217, 91%, 60%)', 'hsl(187, 96%, 42%)', 'hsl(var(--muted-foreground))'];

  if (abcAnalysis.length === 0) {
    return (
      <div className="glass-card p-12 rounded-xl text-center">
        <p className="text-lg font-semibold text-foreground mb-2">No ABC data yet</p>
        <p className="text-sm text-foreground-secondary">Upload inventory data with SKU revenue info to run ABC analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        {abcAnalysis.map((cat) => (
          <div key={cat.category} className="glass-card p-5 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-foreground">Category {cat.category}</span>
              <span className="text-xs text-foreground-secondary">{cat.description}</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{cat.count} SKUs</p>
            <p className="text-sm text-foreground-secondary">{cat.revenue_pct}% of revenue</p>
          </div>
        ))}
      </div>
      <div className="glass-card p-5 rounded-xl">
        <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Distribution by Category</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={abcAnalysis}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="category" stroke="hsl(var(--foreground-secondary))" tick={{ fontSize: 12 }} />
            <YAxis stroke="hsl(var(--foreground-secondary))" tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
            <Bar dataKey="revenue_pct" radius={[6, 6, 0, 0]}>
              {abcAnalysis.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Optimization tab ─────────────────────────────────────────────────────────

function OptimizationTab({ user }) {
  const { inventoryResults, setInventoryResults } = useFmcgStore();
  const queryClient = useQueryClient();

  const [dataFiles, setDataFiles] = useState(null);  // null = not loaded yet
  const [fileId, setFileId] = useState('');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(inventoryResults || null);
  const [expandedWarehouses, setExpandedWarehouses] = useState({});

  // Form state
  const [leadTime, setLeadTime] = useState(7);
  const [serviceLevel, setServiceLevel] = useState(0.95);
  const [orderCost, setOrderCost] = useState('');
  const [holdingCostPct, setHoldingCostPct] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Load files lazily when tab is opened
  const ensureFilesLoaded = async () => {
    if (dataFiles !== null) return;
    setLoadingFiles(true);
    try {
      const files = await fetchDataFiles(user.id);
      const filtered = files.filter(
        (f) => !f.column_mapping?.__purpose__ || f.column_mapping.__purpose__ === 'inventory'
      );
      setDataFiles(filtered);
      if (filtered.length > 0) setFileId(filtered[0].id);
    } catch {
      setDataFiles([]);
      toast.error('Failed to load data files');
    } finally {
      setLoadingFiles(false);
    }
  };

  // On mount: restore from Zustand (localStorage) or fetch from DB
  useEffect(() => {
    ensureFilesLoaded();
    if (inventoryResults) {
      setResult(inventoryResults);
      // Pre-fill params from stored result if available
      if (inventoryResults.params) {
        setLeadTime(inventoryResults.params.lead_time_days ?? 7);
        setServiceLevel(inventoryResults.params.service_level ?? 0.95);
      }
      return;
    }
    // No local state — try fetching from DB (cross-device persistence)
    setLoadingPrev(true);
    inventoryApi.getLatestOptimization()
      .then((resp) => {
        if (resp.data) {
          setResult(resp.data);
          setInventoryResults(resp.data);
          if (resp.data.params) {
            setLeadTime(resp.data.params.lead_time_days ?? 7);
            setServiceLevel(resp.data.params.service_level ?? 0.95);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPrev(false));
  }, []);

  const handleRun = async () => {
    if (!fileId) { toast.error('Select a data file first'); return; }
    setRunning(true);
    setExpandedWarehouses({});
    try {
      const resp = await inventoryApi.runOptimization({
        file_id: fileId,
        lead_time_days: leadTime,
        service_level: serviceLevel,
        order_cost: parseFloat(orderCost) || 0,
        holding_cost_pct: parseFloat(holdingCostPct) / 100 || 0,
      });
      setResult(resp.data);
      setInventoryResults(resp.data);
      // Invalidate dashboard and inventory queries so they reflect new data
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-inventory-snapshot'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-overview'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-reorder'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Optimization failed');
    } finally {
      setRunning(false);
    }
  };

  const toggleWarehouse = (name) =>
    setExpandedWarehouses((prev) => ({ ...prev, [name]: !prev[name] }));

  const filteredSKUs = result?.by_sku?.filter(
    (s) => statusFilter === 'all' || s.status === statusFilter
  ) ?? [];

  const SUMMARY_CARDS = result ? [
    { label: 'Stockout',  value: result.summary.stockout,  color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Order Now', value: result.summary.order_now, color: 'text-warning',     bg: 'bg-warning/10' },
    { label: 'Watch',     value: result.summary.watch,     color: 'text-primary',     bg: 'bg-primary/10' },
    { label: 'OK',        value: result.summary.ok,        color: 'text-success',     bg: 'bg-success/10' },
  ] : [];

  if (loadingFiles || loadingPrev) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
        {loadingPrev && <p className="text-sm text-foreground-secondary">Restoring previous analysis…</p>}
      </div>
    );
  }

  if (dataFiles?.length === 0) {
    return (
      <div className="glass-card p-12 rounded-xl text-center">
        <AlertTriangle className="h-10 w-10 text-foreground-secondary mx-auto mb-4" />
        <p className="text-lg font-semibold text-foreground mb-2">No data uploaded yet</p>
        <p className="text-sm text-foreground-secondary">Upload a CSV with demand + stock level data to run optimization.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Input panel ──────────────────────────────────────────────────────── */}
      <div className="glass-card p-5 rounded-xl">
        <h3 className="text-sm font-semibold text-foreground mb-4">Optimization Parameters</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">

          {/* File */}
          <div className="xl:col-span-2">
            <label className="text-xs font-medium text-foreground-secondary block mb-1">Data File</label>
            <select value={fileId} onChange={(e) => setFileId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 truncate">
              {(dataFiles || []).map((f) => <option key={f.id} value={f.id}>{f.file_name}</option>)}
            </select>
          </div>

          {/* Lead time */}
          <div>
            <label className="text-xs font-medium text-foreground-secondary block mb-1">Lead Time (days)</label>
            <input type="number" min={1} max={90} value={leadTime}
              onChange={(e) => setLeadTime(parseInt(e.target.value) || 7)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          {/* Service level */}
          <div>
            <label className="text-xs font-medium text-foreground-secondary block mb-1">Service Level</label>
            <select value={serviceLevel} onChange={(e) => setServiceLevel(parseFloat(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value={0.90}>90% (Z=1.28)</option>
              <option value={0.95}>95% (Z=1.65)</option>
              <option value={0.99}>99% (Z=2.33)</option>
            </select>
          </div>

          {/* Order cost (optional) */}
          <div>
            <label className="text-xs font-medium text-foreground-secondary block mb-1">Order Cost $ <span className="text-foreground-secondary/60">(optional)</span></label>
            <input type="number" min={0} placeholder="e.g. 100" value={orderCost}
              onChange={(e) => setOrderCost(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          {/* Holding cost */}
          <div>
            <label className="text-xs font-medium text-foreground-secondary block mb-1">Holding Cost % <span className="text-foreground-secondary/60">(optional)</span></label>
            <input type="number" min={0} max={100} placeholder="e.g. 25" value={holdingCostPct}
              onChange={(e) => setHoldingCostPct(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button onClick={handleRun} disabled={running || !fileId}
            className="gradient-brand text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover-lift disabled:opacity-50 flex items-center gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {running ? 'Optimizing…' : result ? 'Re-run Analysis' : 'Run Optimization'}
          </button>
          {result && !result.has_stock_data && (
            <p className="text-xs text-warning flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              No stock_level column found — current stock assumed 0 for all SKUs
            </p>
          )}
          {result && (
            <p className="text-xs text-foreground-secondary">
              Lead time {result.params.lead_time_days}d · Service {(result.params.service_level * 100).toFixed(0)}% · Z={result.params.z_score}
            </p>
          )}
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────────────────────────── */}
      {result && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SUMMARY_CARDS.map((c, i) => (
            <motion.div key={c.label}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={`glass-card p-4 rounded-xl cursor-pointer border-2 transition-colors ${
                statusFilter === c.label.toLowerCase().replace(' ', '_')
                  ? 'border-primary'
                  : 'border-transparent'
              }`}
              onClick={() => setStatusFilter(
                statusFilter === c.label.toLowerCase().replace(' ', '_')
                  ? 'all'
                  : c.label.toLowerCase().replace(' ', '_')
              )}
            >
              <p className="text-xs text-foreground-secondary mb-1">{c.label}</p>
              <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-foreground-secondary mt-1">SKUs</p>
            </motion.div>
          ))}
        </div>
      )}

      {result && (
        <div className="glass-card p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground-secondary">Total units to order across all SKUs</p>
            <p className="text-2xl font-bold text-foreground">
              {result.summary.total_suggested_units.toLocaleString()} units
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-foreground-secondary">SKUs analysed</p>
            <p className="text-2xl font-bold text-foreground">{result.summary.total_skus}</p>
          </div>
        </div>
      )}

      {/* ── Per-SKU table ────────────────────────────────────────────────────── */}
      {result && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Per-SKU Optimization
              {statusFilter !== 'all' && (
                <span className="ml-2 text-xs font-normal text-primary">
                  Filtered: {STATUS_STYLE[statusFilter]?.label}
                  <button onClick={() => setStatusFilter('all')} className="ml-1 text-foreground-secondary hover:text-foreground">×</button>
                </span>
              )}
            </h3>
            <p className="text-xs text-foreground-secondary">{filteredSKUs.length} SKUs shown · Click a status card above to filter</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-elevated/50">
                  {['SKU', 'Avg/Day', 'Current Stock', 'Safety Stock', 'Reorder Point', 'EOQ', 'Max Stock', 'Days Left', 'Status', 'Order Qty'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground-secondary whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSKUs.map((row) => {
                  const st = STATUS_STYLE[row.status] ?? STATUS_STYLE.ok;
                  return (
                    <tr key={row.sku}
                      className="border-b border-border hover:bg-background-elevated/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground max-w-[160px] truncate">{row.sku}</td>
                      <td className="px-4 py-3 text-foreground-secondary">{row.avg_daily_demand}</td>
                      <td className="px-4 py-3 text-foreground-secondary">{row.current_stock.toLocaleString()}</td>
                      <td className="px-4 py-3 text-foreground-secondary">{row.safety_stock.toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{row.reorder_point.toLocaleString()}</td>
                      <td className="px-4 py-3 text-foreground-secondary">{row.eoq.toLocaleString()}</td>
                      <td className="px-4 py-3 text-foreground-secondary">{row.max_stock.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={row.days_remaining < 7 ? 'text-destructive font-bold' : row.days_remaining < 14 ? 'text-warning font-medium' : 'text-foreground-secondary'}>
                          {row.days_remaining >= 999 ? '∞' : `${row.days_remaining}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {row.suggested_order_qty > 0 ? (
                          <span className="font-semibold text-foreground">{row.suggested_order_qty.toLocaleString()}</span>
                        ) : (
                          <span className="text-foreground-secondary">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredSKUs.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-foreground-secondary">
                      No SKUs match the current filter
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-border text-xs text-foreground-secondary">
            Safety Stock = Z × σ(demand) × √(lead_time) · ROP = avg_demand × lead_time + safety_stock · EOQ = √(2 × avg_demand × order_cost / holding_cost)
          </div>
        </div>
      )}

      {/* ── Per-warehouse breakdown ──────────────────────────────────────────── */}
      {result?.has_warehouse_data && result.by_warehouse.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Per-Warehouse Breakdown</h3>
          {result.by_warehouse.map((wh) => {
            const isOpen = !!expandedWarehouses[wh.warehouse];
            const urgent = wh.skus.filter((s) => s.status === 'stockout' || s.status === 'order_now');
            const watching = wh.skus.filter((s) => s.status === 'watch');

            return (
              <div key={wh.warehouse} className="glass-card rounded-xl overflow-hidden">
                {/* Warehouse header row */}
                <button
                  onClick={() => toggleWarehouse(wh.warehouse)}
                  className="w-full p-4 flex items-center justify-between hover:bg-background-elevated/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Warehouse className="h-4 w-4 text-foreground-secondary" />
                    <span className="font-semibold text-foreground">{wh.warehouse}</span>
                    <div className="flex items-center gap-2">
                      {wh.summary.stockout > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                          {wh.summary.stockout} stockout
                        </span>
                      )}
                      {wh.summary.order_now > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
                          {wh.summary.order_now} order now
                        </span>
                      )}
                      {wh.summary.watch > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {wh.summary.watch} watch
                        </span>
                      )}
                      {(wh.summary.stockout + wh.summary.order_now + wh.summary.watch) === 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">All OK</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-foreground-secondary">
                      {wh.summary.total_skus} SKUs · {wh.summary.total_suggested_units.toLocaleString()} units to order
                    </span>
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 text-foreground-secondary" />
                      : <ChevronRight className="h-4 w-4 text-foreground-secondary" />}
                  </div>
                </button>

                {/* Expanded SKU table for this warehouse */}
                {isOpen && (
                  <div className="border-t border-border">
                    {urgent.length === 0 && watching.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-foreground-secondary text-center">
                        All SKUs at this warehouse are within optimal stock levels.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-background-elevated/50">
                              {['SKU', 'Avg/Day', 'Current Stock', 'Safety Stock', 'Reorder Point', 'Days Left', 'Status', 'Order Qty'].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground-secondary whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[...urgent, ...watching].map((row) => {
                              const st = STATUS_STYLE[row.status] ?? STATUS_STYLE.ok;
                              return (
                                <tr key={row.sku} className="border-b border-border hover:bg-background-elevated/30 transition-colors">
                                  <td className="px-4 py-3 font-medium text-foreground max-w-[160px] truncate">{row.sku}</td>
                                  <td className="px-4 py-3 text-foreground-secondary">{row.avg_daily_demand}</td>
                                  <td className="px-4 py-3 text-foreground-secondary">{row.current_stock.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-foreground-secondary">{row.safety_stock.toLocaleString()}</td>
                                  <td className="px-4 py-3 font-medium text-foreground">{row.reorder_point.toLocaleString()}</td>
                                  <td className="px-4 py-3">
                                    <span className={row.days_remaining < 7 ? 'text-destructive font-bold' : row.days_remaining < 14 ? 'text-warning font-medium' : 'text-foreground-secondary'}>
                                      {row.days_remaining >= 999 ? '∞' : `${row.days_remaining}d`}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                                  </td>
                                  <td className="px-4 py-3 font-semibold text-foreground">
                                    {row.suggested_order_qty > 0 ? row.suggested_order_qty.toLocaleString() : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Running state placeholder */}
      {running && (
        <div className="glass-card p-12 rounded-xl flex items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
          <p className="text-sm text-foreground-secondary">Computing Safety Stock, ROP, and EOQ for all SKUs…</p>
        </div>
      )}
    </div>
  );
}

export default InventoryPage;
