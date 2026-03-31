import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, CheckCircle } from 'lucide-react';
import Badge from "@/industries/logistics/components/Badge";
import PageHeader from "@/industries/logistics/components/PageHeader";
import {
  getAlertsView,
  resolveAlert,
  unresolveAlert,
} from "@/industries/logistics/api/logisticsApi";
import { useLogisticsContext } from "@/industries/logistics/context/LogisticsAppContext";
import { getRiskBadgeLevel } from "@/industries/logistics/utils/logistics";

const TAB_STYLES = {
  critical: { active: 'bg-red-500/20 text-red-400 border-red-500/40', count: 'bg-red-500/30 text-red-300' },
  high:     { active: 'bg-orange-500/20 text-orange-400 border-orange-500/40', count: 'bg-orange-500/30 text-orange-300' },
  medium:   { active: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', count: 'bg-yellow-500/30 text-yellow-300' },
  resolved: { active: 'bg-green-500/20 text-green-400 border-green-500/40', count: 'bg-green-500/30 text-green-300' },
};

const SCORE_COLORS = {
  critical: 'text-red-400 bg-red-500/10',
  high:     'text-orange-400 bg-orange-500/10',
  medium:   'text-yellow-400 bg-yellow-500/10',
};

export default function AlertCenter() {
  const [state, setState] = useState({ loading: true, error: "", payload: null });
  const [activeTab, setActiveTab] = useState("critical");
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [pageInputError, setPageInputError] = useState("");
  const deferredKeyword = useDeferredValue(keyword);
  const { isAlertResolved, markAlertResolved, markAlertUnresolved } = useLogisticsContext();

  useEffect(() => {
    let ignore = false;
    const loadData = async () => {
      try {
        const riskSnapshots = await getAlertsView(1000);
        if (!ignore) setState({ loading: false, error: "", payload: riskSnapshots?.data || [] });
      } catch (error) {
        if (!ignore) setState({ loading: false, error: error?.message || "Failed to load alerts.", payload: null });
      }
    };
    loadData();
    return () => { ignore = true; };
  }, []);

  const alerts = useMemo(() => {
    if (!state.payload) return [];
    return state.payload.map((alert) => ({
      ...alert,
      severity: alert.alert_severity,
      score: Number(alert.risk_score || 0),
      reason: alert.explanation,
      tag: `${String(alert.risk_level || "").toUpperCase()} risk`,
      meta: alert.entity_type || "entity",
      resolved: isAlertResolved(alert.id),
    }));
  }, [state.payload, isAlertResolved]);

  const categoryOptions = useMemo(() => {
    const categories = new Set(alerts.map((a) => String(a.category || "Uncategorized").trim()));
    return ["all", ...Array.from(categories).sort((a, b) => a.localeCompare(b))];
  }, [alerts]);

  const filteredAlerts = alerts.filter((alert) => {
    const catMatch = categoryFilter === "all" || String(alert.category || "").toLowerCase() === categoryFilter.toLowerCase();
    if (!catMatch) return false;
    if (!deferredKeyword.trim()) return true;
    const haystack = `${alert.title} ${alert.category} ${alert.meta} ${alert.entity_id || ""} ${alert.reason} ${alert.recommendation || ""}`.toLowerCase();
    return haystack.includes(deferredKeyword.trim().toLowerCase());
  });

  const activeAlerts = filteredAlerts.filter((a) => !a.resolved);
  const resolvedAlerts = filteredAlerts.filter((a) => a.resolved);
  const visibleAlerts = activeTab === "resolved"
    ? resolvedAlerts
    : activeAlerts.filter((a) => a.severity === activeTab);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(visibleAlerts.length / PAGE_SIZE));
  const pagedAlerts = visibleAlerts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [activeTab, deferredKeyword, categoryFilter]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPageInput(String(page)); }, [page]);

  const startRow = visibleAlerts.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const endRow = Math.min(page * PAGE_SIZE, visibleAlerts.length);

  const applyPageInput = () => {
    const raw = pageInput.trim();
    if (!raw) { setPageInput(String(page)); setPageInputError(""); return; }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) { setPageInputError("Enter a valid page number starting from 1."); return; }
    if (parsed > totalPages) { setPageInputError(`Page ${parsed} is out of range. Maximum available page is ${totalPages}.`); return; }
    setPage(parsed); setPageInputError("");
  };

  const tabs = [
    { key: "critical", label: "Critical",  count: activeAlerts.filter((a) => a.severity === "critical").length },
    { key: "high",     label: "High",      count: activeAlerts.filter((a) => a.severity === "high").length },
    { key: "medium",   label: "Moderate",  count: activeAlerts.filter((a) => a.severity === "medium").length },
    { key: "resolved", label: "Resolved",  count: resolvedAlerts.length },
  ];

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Alert Center" subtitle="Critical and high-priority risk alerts across shipments" icon={<AlertTriangle className="h-5 w-5 text-destructive" />} />

      {state.loading ? (
        <div className="glass-card rounded-xl p-8 text-center text-foreground-secondary text-sm">Loading active alerts...</div>
      ) : state.error ? (
        <div className="glass-card rounded-xl p-6 border border-destructive/30 text-destructive text-sm">{state.error}</div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <input
              type="search"
              placeholder="Filter alerts by shipment, vendor, or cause"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="flex-1 min-w-[200px] bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-secondary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[240px]"
            >
              {categoryOptions.map((opt) => (
                <option key={opt} value={opt}>{opt === "all" ? "All Categories" : opt}</option>
              ))}
            </select>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const styles = TAB_STYLES[tab.key] || TAB_STYLES.resolved;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${isActive ? styles.active + ' border' : 'border-border text-foreground-secondary hover:text-foreground hover:bg-muted'}`}
                >
                  {tab.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${isActive ? styles.count : 'bg-muted text-foreground-secondary'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Alert cards */}
          {visibleAlerts.length ? (
            <div className="space-y-3">
              {pagedAlerts.map((alert) => {
                const scoreCls = SCORE_COLORS[alert.severity] || 'text-foreground bg-muted';
                return (
                  <div key={alert.id} className="glass-card rounded-xl border border-border p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">{alert.title}</div>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-foreground-secondary">
                          {alert.category && <span>{alert.category}</span>}
                          {alert.meta && <span>· {alert.meta}</span>}
                          {alert.entity_id && <span>· {alert.entity_id}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className={`text-2xl font-bold px-3 py-1 rounded-lg ${scoreCls}`}>
                          {Math.round(alert.score)}
                        </span>
                        <Badge text={alert.tag} level={getRiskBadgeLevel(alert.score)} />
                      </div>
                    </div>

                    <div className="bg-muted/60 rounded-lg p-3 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-foreground-secondary flex items-center gap-1"><Bot className="h-3 w-3" /> Why this alert was generated</div>
                      <p className="text-xs text-foreground leading-relaxed">{alert.reason}</p>
                    </div>

                    <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-foreground-secondary">Recommended Action</div>
                      <p className="text-xs text-foreground leading-relaxed">{alert.recommendation}</p>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          alert.resolved
                            ? (markAlertUnresolved(alert.id), unresolveAlert(alert.id).catch((e) => console.error(e)))
                            : (markAlertResolved(alert.id), resolveAlert(alert.id).catch((e) => console.error(e)))
                        }
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors ${alert.resolved ? 'border-border text-foreground-secondary hover:bg-muted' : 'border-primary/40 text-primary hover:bg-primary/10'}`}
                      >
                        {alert.resolved ? "Re-open Alert" : "Mark Resolved"}
                      </button>
                      <span className="text-xs text-foreground-secondary">Showing {startRow}–{endRow} of {visibleAlerts.length}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card rounded-xl p-12 text-center border border-border">
              <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
              <div className="text-sm text-foreground-secondary">No alerts match the current filters.</div>
            </div>
          )}

          {/* Pagination */}
          {visibleAlerts.length > 0 && (
            <div className="flex items-center gap-3 justify-end">
              {pageInputError && <span className="text-xs text-destructive">{pageInputError}</span>}
              <div className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                <span>Page</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPageInput(next);
                    if (!next.trim()) { setPageInputError(""); return; }
                    const parsed = Number.parseInt(next, 10);
                    if (!Number.isFinite(parsed) || parsed < 1) { setPageInputError("Enter a valid page number starting from 1."); return; }
                    if (parsed > totalPages) { setPageInputError(`Max page is ${totalPages}.`); return; }
                    setPageInputError(""); setPage(parsed);
                  }}
                  onBlur={applyPageInput}
                  onKeyDown={(e) => { if (e.key === "Enter") applyPageInput(); }}
                  className="w-14 bg-muted border border-border rounded px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span>/ {totalPages}</span>
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground-secondary hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground-secondary hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
