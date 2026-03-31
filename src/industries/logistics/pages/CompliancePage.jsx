import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Truck, XCircle, AlertTriangle, User } from 'lucide-react';
import { logisticsApi } from '@/industries/logistics/api/logisticsApi';
import { formatDate, getExpiryState } from '@/industries/logistics/utils/logistics';

const PAGE_SIZE = 30;

function ExpiryCell({ document }) {
  if (!document) return <span className="text-foreground-secondary">--</span>;
  const fallback = getExpiryState(document.days);
  const level = document.level || fallback.level;
  const label = document.label || fallback.label;
  const colors = {
    critical: 'text-red-400',
    high: 'text-orange-400',
    medium: 'text-yellow-400',
    low: 'text-green-400',
  };
  return (
    <div>
      <div className="text-sm text-foreground">{formatDate(document.date)}</div>
      <div className={`text-[11px] font-semibold mt-0.5 ${colors[level] || 'text-foreground-secondary'}`}>{label}</div>
    </div>
  );
}

function SeverityBadge({ level }) {
  const cfg = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg[level] || cfg.low}`}>
      {(level || 'low').toUpperCase()}
    </span>
  );
}

function KPICard({ label, value, icon, color }) {
  const colors = {
    red: 'text-red-400',
    orange: 'text-orange-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
  };
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

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState('trucks');
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [truckTypeFilter, setTruckTypeFilter] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['logistics-compliance'],
    queryFn: () => logisticsApi.getComplianceView(),
    select: (res) => res?.data || {},
    staleTime: 60_000,
  });

  const trucks = data?.trucks || [];
  const drivers = data?.drivers || [];
  const kpis = data?.kpis || {};

  const truckTypes = useMemo(() => {
    const unique = new Set(trucks.map((t) => String(t.type || '').trim()).filter(Boolean));
    return Array.from(unique).sort();
  }, [trucks]);

  const activeRows = activeTab === 'trucks' ? trucks : drivers;

  const filteredRows = useMemo(() => {
    return activeRows.filter((row) => {
      const sev = String(row.alert_severity || '').toLowerCase();
      const status = String(row.status || '').toLowerCase().replaceAll('_', ' ');
      const riskMatch = riskFilter === 'all' || sev === riskFilter;
      const statusMatch = statusFilter === 'all' || (statusFilter === 'maintenance' ? status.includes('maintenance') : status === statusFilter);
      const typeMatch = activeTab !== 'trucks' || truckTypeFilter === 'all' || String(row.type || '').toLowerCase() === truckTypeFilter;
      const q = searchTerm.trim().toLowerCase();
      const haystack = activeTab === 'trucks'
        ? `${row.asset || ''} ${row.type || ''} ${row.status || ''} ${row.id || ''}`
        : `${row.name || ''} ${row.license_number || ''} ${row.status || ''} ${row.id || ''}`;
      const keywordMatch = !q || haystack.toLowerCase().includes(q);
      return riskMatch && statusMatch && typeMatch && keywordMatch;
    });
  }, [activeRows, riskFilter, statusFilter, truckTypeFilter, searchTerm, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredRows, page]);
  const startRow = filteredRows.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const endRow = Math.min(page * PAGE_SIZE, filteredRows.length);

  useEffect(() => { setPage(1); }, [activeTab, riskFilter, statusFilter, truckTypeFilter, searchTerm]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Truck className="h-6 w-6 text-primary" /> Assets &amp; Drivers Compliance</h1>
          <p className="text-sm text-foreground-secondary mt-1">Track license, insurance, and fitness expiry dates</p>
        </div>
        <div className="glass-card rounded-xl p-8 text-center border border-border">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-foreground-secondary text-sm">Loading compliance registers...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Truck className="h-6 w-6 text-primary" /> Assets &amp; Drivers Compliance</h1>
        </div>
        <div className="glass-card rounded-xl p-8 text-center border border-destructive/30">
          <p className="text-destructive text-sm">{error?.message || 'Failed to load compliance data.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Truck className="h-6 w-6 text-primary" /> Assets &amp; Drivers Compliance</h1>
        <p className="text-sm text-foreground-secondary mt-1">Track license, insurance, and fitness expiry dates</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Critical Expiries" value={kpis.critical_expiries ?? 0} icon={<XCircle className="h-4 w-4" />} color="red" />
        <KPICard label="High Risk Assets" value={kpis.high_risk_assets ?? 0} icon={<AlertTriangle className="h-4 w-4" />} color="orange" />
        <KPICard label="Fleet Tracked" value={kpis.fleet_tracked ?? 0} icon={<Truck className="h-4 w-4" />} color="blue" />
        <KPICard label="Drivers Tracked" value={kpis.drivers_tracked ?? 0} icon={<User className="h-4 w-4" />} color="green" />
      </div>

      {/* Compliance Register */}
      <div className="glass-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Compliance Register</h2>
          <p className="text-xs text-foreground-secondary mt-0.5">Fleet and driver expiry tracking</p>
        </div>
        <div className="p-5 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {[{ id: 'trucks', label: 'Truck Fleet', count: trucks.length }, { id: 'drivers', label: 'Driver Compliance', count: drivers.length }].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === tab.id ? 'gradient-brand text-white shadow-sm' : 'bg-muted text-foreground-secondary hover:text-foreground'}`}>
                {tab.label}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20' : 'bg-background'}`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <input type="search" placeholder={activeTab === 'trucks' ? 'Search truck, type, or status...' : 'Search driver, license, or status...'}
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-48 h-9 px-3 rounded-lg bg-muted border border-border text-sm text-foreground placeholder-foreground-secondary focus:outline-none focus:ring-1 focus:ring-primary" />
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}
              className="h-9 px-3 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
            {activeTab === 'trucks' && (
              <select value={truckTypeFilter} onChange={(e) => setTruckTypeFilter(e.target.value)}
                className="h-9 px-3 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="all">All Truck Types</option>
                {truckTypes.map((type) => <option key={type} value={type.toLowerCase()}>{type}</option>)}
              </select>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-border">
            {activeTab === 'trucks' ? (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['Truck', 'Type', 'Status', 'Insurance', 'Fitness', 'Registration', 'Risk', 'Action'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground-secondary uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedRows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{row.asset}</td>
                      <td className="px-4 py-3 text-foreground-secondary">{row.type}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: row.status === 'ACTIVE' ? 'var(--color-success, #10b981)' : row.status === 'MAINTENANCE' ? '#f97316' : '#64748b' }}>
                        {String(row.status || '').replaceAll('_', ' ')}
                      </td>
                      <td className="px-4 py-3"><ExpiryCell document={row.documents?.insurance} /></td>
                      <td className="px-4 py-3"><ExpiryCell document={row.documents?.fitness} /></td>
                      <td className="px-4 py-3"><ExpiryCell document={row.documents?.registration} /></td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <SeverityBadge level={row.alert_severity} />
                          <div className="text-[11px] text-foreground-secondary">Score {Math.round(Number(row.risk_score || 0))}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium">Renew Policy</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['Driver', 'Status', 'License No.', 'License Expiry', 'Incidents', 'Risk', 'Action'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground-secondary uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedRows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: row.status === 'ACTIVE' ? 'var(--color-success, #10b981)' : '#64748b' }}>
                        {String(row.status || '').replaceAll('_', ' ')}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground-secondary">{row.license_number || '--'}</td>
                      <td className="px-4 py-3"><ExpiryCell document={row.documents?.license} /></td>
                      <td className="px-4 py-3 text-foreground">{row.incidents ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <SeverityBadge level={row.alert_severity} />
                          <div className="text-[11px] text-foreground-secondary">Score {Math.round(Number(row.risk_score || 0))}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium">Renew License</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {filteredRows.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-foreground-secondary text-sm">No compliance records match the current filters.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {filteredRows.length > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
              <span className="text-xs text-foreground-secondary">
                Showing {startRow}–{endRow} of {filteredRows.length}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs rounded-lg bg-muted border border-border text-foreground-secondary disabled:opacity-40 hover:bg-muted/70 transition-colors">
                  Previous
                </button>
                <span className="px-3 py-1.5 text-xs text-foreground-secondary">
                  {page} / {totalPages}
                </span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs rounded-lg bg-muted border border-border text-foreground-secondary disabled:opacity-40 hover:bg-muted/70 transition-colors">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
