import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Clock, AlertTriangle, DollarSign, Shield, Bot, Package } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { logisticsApi } from '@/industries/logistics/api/logisticsApi';
import { formatCompactCurrency, formatPercent } from '@/industries/logistics/utils/logistics';

function getRiskColor(score) {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#f97316';
  if (score >= 30) return '#eab308';
  return '#10b981';
}

function getRiskLevel(score) {
  if (score >= 75) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  if (score >= 30) return 'LOW';
  return 'MINIMAL';
}

const STATUS_COLORS = ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#7c3aed', '#06b6d4'];

function KPICard({ label, value, icon, color }) {
  const colors = { blue: 'text-blue-400', red: 'text-red-400', orange: 'text-orange-400', purple: 'text-purple-400' };
  return (
    <div className="glass-card rounded-xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-foreground-secondary font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${colors[color] || 'text-foreground'}`}>{value ?? '--'}</div>
    </div>
  );
}

function SeverityBadge({ score }) {
  const level = getRiskLevel(score);
  const cfg = { HIGH: 'bg-red-500/20 text-red-400 border-red-500/30', MEDIUM: 'bg-orange-500/20 text-orange-400 border-orange-500/30', LOW: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', MINIMAL: 'bg-green-500/20 text-green-400 border-green-500/30' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg[level]}`}>{level}</span>;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color || p.fill || '#94a3b8' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function VendorIntelPage() {
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');

  const { data: baseData, isLoading, isError, error } = useQuery({
    queryKey: ['logistics-vendor-intel'],
    queryFn: () => logisticsApi.getVendorIntelView(),
    select: (res) => res?.data || {},
    staleTime: 60_000,
  });

  const { data: selectedData, isLoading: selectedLoading } = useQuery({
    queryKey: ['logistics-vendor-intel', selectedVendorId],
    queryFn: () => logisticsApi.getVendorIntelView(selectedVendorId),
    select: (res) => res?.data || {},
    enabled: !!selectedVendorId,
    staleTime: 60_000,
  });

  const allVendors = baseData?.vendors || [];

  useEffect(() => {
    if (allVendors.length && !selectedVendorId) {
      setSelectedVendorId(String(allVendors[0].vendor_id));
    }
  }, [allVendors, selectedVendorId]);

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return allVendors;
    return allVendors.filter((v) => `${v.vendor_id} ${v.vendor_name}`.toLowerCase().includes(q));
  }, [allVendors, vendorSearch]);

  // Auto-select first filtered vendor when search changes
  useEffect(() => {
    if (vendorSearch && filteredVendors.length) {
      const nextId = String(filteredVendors[0].vendor_id);
      if (nextId !== selectedVendorId) setSelectedVendorId(nextId);
    }
  }, [vendorSearch, filteredVendors]);

  const payload = selectedData || baseData || {};
  const selected = payload?.selected || {};
  const selectedVendor = selected?.vendor || {};
  const vendorKpis = selected?.kpis || {};
  const statusMix = selected?.status_mix || [];
  const latestRiskRows = selected?.latest_risk_rows || [];
  const flags = selected?.flags || [];

  const onTime = Number(vendorKpis.on_time_pct || 0);
  const avgRisk = Number(vendorKpis.avg_risk || 0);
  const totalShipments = Number(vendorKpis.total_shipments || 0);
  const exposedValue = Number(vendorKpis.financial_exposure || 0);

  const statusMixRows = statusMix
    .map((r) => ({ name: String(r?.status || 'UNKNOWN').replaceAll('_', ' '), value: Number(r?.count || 0) }))
    .filter((r) => r.value > 0);

  const riskRows = latestRiskRows.filter((r) => r?.shipment_id != null && r.shipment_id !== '');

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" /> Vendor Intelligence</h1>
          <p className="text-sm text-foreground-secondary mt-1">Vendor performance metrics and on-time delivery trends</p>
        </div>
        <div className="glass-card rounded-xl p-8 text-center border border-border">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-foreground-secondary text-sm">Loading vendor intelligence...</p>
        </div>
      </div>
    );
  }

  if (isError || !selectedVendor?.vendor_id) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" /> Vendor Intelligence</h1>
        </div>
        <div className="glass-card rounded-xl p-8 text-center border border-border">
          <p className="text-foreground-secondary text-sm">{error?.message || 'No vendors available. Upload vendor data to get started.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">🏢 Vendor Intelligence</h1>
        <p className="text-sm text-foreground-secondary mt-1">Vendor performance metrics and on-time delivery trends</p>
      </div>

      {/* Vendor selector card */}
      <div className="glass-card rounded-xl border border-border p-5">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="h-12 w-12 rounded-full gradient-brand flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0">
            {String(selectedVendor.vendor_name || 'V').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-foreground truncate">{selectedVendor.vendor_name || '--'}</div>
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-foreground-secondary">
              <span>ID: {selectedVendor.vendor_id}</span>
              <span>Status: {selectedVendor.vendor_status || 'ACTIVE'}</span>
              <span>Tracked loads: {totalShipments}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 min-w-56">
            <input type="search" placeholder="Type vendor id or name..." value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
              className="h-9 px-3 rounded-lg bg-muted border border-border text-sm text-foreground placeholder-foreground-secondary focus:outline-none focus:ring-1 focus:ring-primary" />
            <select value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)}
              className="h-9 px-3 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              {filteredVendors.length ? (
                filteredVendors.map((v) => (
                  <option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}</option>
                ))
              ) : (
                <option value={selectedVendorId} disabled>No matching vendors</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity ${selectedLoading ? 'opacity-50' : ''}`}>
        <KPICard label="On-Time Delivery" value={formatPercent(onTime)} icon={<Clock className="h-4 w-4" />} color="blue" />
        <KPICard label="Average Risk" value={avgRisk.toFixed(1)} icon={<AlertTriangle className="h-4 w-4" />} color="red" />
        <KPICard label="Financial Exposure" value={formatCompactCurrency(exposedValue)} icon={<DollarSign className="h-4 w-4" />} color="orange" />
        <KPICard label="Risk Category" value={getRiskLevel(avgRisk)} icon={<Shield className="h-4 w-4" />} color="purple" />
      </div>

      {/* Charts row */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-opacity ${selectedLoading ? 'opacity-50' : ''}`}>
        {/* Shipment status mix */}
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Shipment Status Mix</h2>
            <p className="text-xs text-foreground-secondary mt-0.5">Current load distribution for this vendor</p>
          </div>
          <div className="p-5">
            {statusMixRows.length === 0 ? (
              <div className="py-8 text-center text-foreground-secondary text-sm">No shipment data for this vendor.</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={statusMixRows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={3}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {statusMixRows.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent risk scores */}
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Recent Risk Scores</h2>
            <p className="text-xs text-foreground-secondary mt-0.5">Latest shipment-level risk rows</p>
          </div>
          <div className="p-5">
            {riskRows.length === 0 ? (
              <div className="py-8 text-center text-foreground-secondary text-sm">No recent risk scores for this vendor.</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={riskRows.slice(0, 15)} margin={{ left: 0, right: 10, top: 4, bottom: 30 }}>
                  <XAxis dataKey="shipment_id" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} angle={-20} textAnchor="end" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="overall_risk_score" name="Risk Score" radius={[4, 4, 0, 0]}>
                    {riskRows.slice(0, 15).map((r, i) => (
                      <Cell key={i} fill={getRiskColor(r.overall_risk_score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* AI Analysis + Active Flags */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-opacity ${selectedLoading ? 'opacity-50' : ''}`}>
        {/* AI risk analysis */}
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> AI Risk Analysis</h2>
          </div>
          <div className="p-5">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-primary">Vendor Summary</span>
              </div>
              <p className="text-sm text-foreground-secondary leading-relaxed">{selected.insight_text || 'No AI analysis available.'}</p>
            </div>
          </div>
        </div>

        {/* Active flags */}
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Active Flags</h2>
            <p className="text-xs text-foreground-secondary mt-0.5">Recent loads requiring attention</p>
          </div>
          <div className="p-5">
            {flags.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-foreground-secondary text-sm">{selected.recommendation || 'No delayed or high-risk shipments are currently assigned to this vendor.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {flags.map((shipment) => (
                  <div key={shipment.shipment_id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                      style={{ background: `${getRiskColor(shipment.overall_risk_score)}22` }}>
                      <Package className="h-4 w-4 text-foreground-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        Shipment #{shipment.shipment_id} · {shipment.origin_city} → {shipment.destination_city}
                      </div>
                      <div className="text-xs text-foreground-secondary mt-0.5">
                        Status {String(shipment.shipment_status || 'UNKNOWN').replaceAll('_', ' ')} · {formatCompactCurrency(shipment.financial_exposure || shipment.shipment_value)}
                      </div>
                    </div>
                    <SeverityBadge score={shipment.overall_risk_score} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
