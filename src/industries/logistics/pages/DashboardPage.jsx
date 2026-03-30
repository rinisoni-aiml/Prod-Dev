import { useEffect, useState } from "react";
import { getDashboardView } from "../api/logisticsApi";
import { formatNumber, formatPercent } from "../utils/logistics";

const riskColorByLevel = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

export default function DashboardPage() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    payload: null,
  });

  useEffect(() => {
    let ignore = false;

    const loadView = async () => {
      try {
        const response = await getDashboardView();
        if (!ignore) {
          setState({
            loading: false,
            error: "",
            payload: {
              data: response?.data || {},
              generatedAt: response?.generated_at || "",
            },
          });
        }
      } catch (error) {
        if (!ignore) {
          setState({
            loading: false,
            error: error?.message || "Failed to load dashboard data.",
            payload: null,
          });
        }
      }
    };

    loadView();

    return () => {
      ignore = true;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            📊 Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of shipments, risk trends, and insights
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            📊 Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of shipments, risk trends, and insights
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="text-destructive">{state.error}</div>
        </div>
      </div>
    );
  }

  const dashboard = state.payload?.data || {};
  const kpis = dashboard.kpis || {};
  const routes = dashboard.route_heatmap || [];
  const timeline = dashboard.compliance_timeline || [];
  const insights = dashboard.insights || [];
  const companyRisk = Number(kpis.company_risk_index || 0);
  const companyLevel = String(kpis.company_risk_level || "low").toLowerCase();
  const companyColor = riskColorByLevel[companyLevel] || "#10B981";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          📊 Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Overview of shipments, risk trends, and insights
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">📦 Active Shipments</div>
          <div className="text-2xl font-bold text-foreground">{formatNumber(kpis.active_shipments)}</div>
          <div className="text-xs text-muted-foreground mt-1">Total shipments currently moving</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">⚠️ Average Risk</div>
          <div className="text-2xl font-bold text-destructive">{formatPercent(kpis.high_risk_shipments, 1)}</div>
          <div className="text-xs text-muted-foreground mt-1">Average risk score</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">📋 Compliance Alerts</div>
          <div className="text-2xl font-bold text-yellow-500">{formatPercent(kpis.compliance_alerts, 1)}</div>
          <div className="text-xs text-muted-foreground mt-1">Average compliance risk</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">🏢 Vendor Risk</div>
          <div className="text-2xl font-bold text-orange-500">{formatPercent(kpis.vendor_risk_alerts, 1)}</div>
          <div className="text-xs text-muted-foreground mt-1">Average vendor risk</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">⚡ Company Risk Index</div>
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="text-sm font-bold" style={{ color: companyColor }}>
                {String(companyLevel).toUpperCase()}
              </div>
            </div>
            <div
              className="ml-auto w-14 h-14 rounded-full border-3 flex items-center justify-center text-lg font-bold"
              style={{
                borderColor: companyColor,
                color: companyColor,
                boxShadow: `0 0 14px ${companyColor}33`,
              }}
            >
              {formatPercent(companyRisk, 0)}
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Overall company risk</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2 bg-card border border-border rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Route Risk Heatmap</h2>
            <p className="text-sm text-muted-foreground">Most exposed corridors by average risk</p>
          </div>
          {routes.length ? (
            <div className="space-y-3">
              {routes.map((route) => {
                const width = Math.max(8, Math.min(Number(route.risk_score || 0), 100));
                const level = String(route.risk_level || "low").toLowerCase();
                const color = riskColorByLevel[level] || "#10B981";
                return (
                  <div key={route.id || route.name} className="grid grid-cols-[190px_1fr_80px] gap-3 items-center py-2 border-b border-border/40">
                    <div className="text-sm text-muted-foreground">{route.name}</div>
                    <div className="bg-muted/30 h-2 rounded-full overflow-hidden">
                      <div style={{ width: `${width}%`, height: "100%", background: color }} />
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color }}>{formatPercent(route.risk_score, 1)}</div>
                      <div className="text-xs text-muted-foreground">{formatNumber(route.total_shipments)} loads</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No route intelligence available yet.
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">🤖 AI Insights</h2>
            <p className="text-sm text-muted-foreground">Live business insights</p>
          </div>
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <div key={`${insight.title}-${index}`} className="flex gap-3">
                <div className="text-2xl">{insight.icon || "🤖"}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{insight.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{insight.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Compliance Timeline</h2>
          <p className="text-sm text-muted-foreground">Priority renewals, sorted by least days left</p>
        </div>
        {timeline.length ? (
          <div className="space-y-3">
            {timeline.map((item) => (
              <div key={item.id} className="flex items-center gap-4 py-3 border-b border-border/40">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: riskColorByLevel[item.level === "critical" ? "high" : item.level] || "#10B981",
                  }}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{item.type}</div>
                  <div className="text-xs text-muted-foreground">{item.subject}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-foreground">{item.days}d</div>
                  <div className={`text-xs px-2 py-1 rounded ${
                    item.level === "critical" ? "bg-destructive/20 text-destructive" :
                    item.level === "high" ? "bg-orange-500/20 text-orange-500" :
                    "bg-yellow-500/20 text-yellow-500"
                  }`}>
                    {item.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No expiring documents inside current watch window.
          </div>
        )}
      </div>
    </div>
  );
}
