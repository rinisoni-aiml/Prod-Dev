import { useEffect, useMemo, useState } from "react";
import { Package, Pin, BarChart2, Compass, Bot, Phone, Navigation } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";
import Badge from "@/industries/logistics/components/Badge";
import PageHeader from "@/industries/logistics/components/PageHeader";
import { getShipmentRiskView } from "@/industries/logistics/api/logisticsApi";
import {
  formatCompactCurrency,
  formatDate,
  getRiskBadgeLevel,
  getRiskColor,
  getStatusColor,
  toNumber,
} from "@/industries/logistics/utils/logistics";

// ── Simple SVG Gauge ──────────────────────────────────────────────────────────
function RiskGauge({ score, color }) {
  const pct = Math.max(0, Math.min(score, 100));
  const r = 80, cx = 100, cy = 100;
  const startAngle = Math.PI;
  const endAngle = 0;
  const sweepAngle = startAngle - (startAngle - endAngle) * (pct / 100);
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(sweepAngle);
  const y2 = cy + r * Math.sin(sweepAngle);
  const trackX2 = cx + r * Math.cos(endAngle);
  const trackY2 = cy + r * Math.sin(endAngle);

  return (
    <div className="flex flex-col items-center py-4">
      <svg viewBox="0 0 200 115" className="w-full max-w-[260px]">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="18" />
        <path d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${trackX2} ${trackY2}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round" />
        {pct > 0 && (
          <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${sweepAngle < Math.PI / 2 ? 1 : 0} 0 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="32" fontWeight="700"
          fill={color} fontFamily="Sora, sans-serif">{score.toFixed(0)}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill="#94A3B8">/100</text>
      </svg>
    </div>
  );
}

// ── Recharts horizontal bar chart ─────────────────────────────────────────────
function RiskBreakdownChart({ breakdown }) {
  const data = breakdown.map(([name, value]) => ({ name, value: parseFloat(value.toFixed(1)) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94A3B8", fontSize: 11 }}
          axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={90} tick={{ fill: "#94A3B8", fontSize: 12 }}
          axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
          formatter={(v) => [`${v}`, "Risk Score"]}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((entry, i) => (
            <Cell key={i} fill={getRiskColor(entry.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ShipmentRisk() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shipments, setShipments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [shipmentSearch, setShipmentSearch] = useState("");

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      try {
        const response = await getShipmentRiskView(null, 300);
        const payload = response?.data || {};
        const nextShipments = payload.shipments || [];
        if (!ignore) {
          setShipments(nextShipments);
          setSelected(payload.selected || null);
          if (nextShipments.length) setSelectedShipmentId(String(nextShipments[0].shipment_id));
          setLoading(false);
        }
      } catch (requestError) {
        if (!ignore) { setError(requestError?.message || "Failed to load shipment risk data."); setLoading(false); }
      }
    };
    init();
    return () => { ignore = true; };
  }, []);

  const selectedShipment = useMemo(() => selected?.shipment || {}, [selected]);
  const filteredShipments = useMemo(() => {
    const query = shipmentSearch.trim().toLowerCase();
    if (!query) return shipments;
    return shipments.filter((s) => `${s.origin_city || ""} ${s.destination_city || ""}`.toLowerCase().includes(query));
  }, [shipments, shipmentSearch]);

  const overallRisk = toNumber(selected?.risk_score);
  const routeName = `${selectedShipment?.origin_city || "Unknown"} → ${selectedShipment?.destination_city || "Unknown"}`;
  const currentCarrier = selectedShipment?.vendor_name || "No carrier assigned";
  const riskCategoryLevel = getRiskBadgeLevel(overallRisk);
  const riskCategoryText = riskCategoryLevel.toUpperCase();
  const riskColor = getRiskColor(overallRisk);
  const etaDays = (() => {
    const deadline = selectedShipment?.delivery_deadline;
    if (!deadline) return null;
    const dt = new Date(deadline);
    if (Number.isNaN(dt.getTime())) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0); dt.setHours(0, 0, 0, 0);
    return Math.round((dt.getTime() - now.getTime()) / 86400000);
  })();

  const breakdown = [
    ["Operational", toNumber(selected?.components?.operational_score)],
    ["Financial",   toNumber(selected?.components?.financial_score)],
    ["Vendor",      toNumber(selected?.components?.vendor_score)],
    ["Compliance",  toNumber(selected?.components?.compliance_score)],
  ];
  const sorted = [...breakdown].sort((a, b) => b[1] - a[1]);
  const highestComponent = sorted[0] || ["Operational", 0];
  const secondComponent  = sorted[1] || ["Vendor", 0];

  const factors = [
    {
      title: "Primary Exposure Driver",
      description: `${highestComponent[0]} contributes ${highestComponent[1].toFixed(1)} points to the total ${overallRisk.toFixed(1)} risk score (${riskCategoryText}). This is currently the dominant risk lever for this shipment.`,
      icon: <Pin className="h-4 w-4 text-red-400" />, bg: "bg-red-500/10 border-red-500/20",
    },
    {
      title: "Secondary Risk Pressure",
      description: `${secondComponent[0]} is the second-highest contributor at ${secondComponent[1].toFixed(1)} points. Coordinated action on the top two components will reduce score faster than isolated interventions.`,
      icon: <BarChart2 className="h-4 w-4 text-orange-400" />, bg: "bg-orange-500/10 border-orange-500/20",
    },
    {
      title: "Service-Level Outlook",
      description: etaDays == null
        ? `Current shipment status is ${String(selectedShipment?.shipment_status || "UNKNOWN").replaceAll("_", " ")}. Deadline data is unavailable, so SLA exposure is being monitored through live status transitions.`
        : etaDays >= 0
          ? `Delivery deadline is in ${etaDays} day(s). Keep carrier and route controls active to protect on-time commitment.`
          : `Delivery deadline is overdue by ${Math.abs(etaDays)} day(s). Escalation protocol should stay active until milestone recovery is confirmed.`,
      icon: <Compass className="h-4 w-4 text-blue-400" />, bg: "bg-blue-500/10 border-blue-500/20",
    },
  ];

  useEffect(() => {
    if (!selectedShipmentId) return;
    let ignore = false;
    const refreshSelection = async () => {
      try {
        const response = await getShipmentRiskView(selectedShipmentId, 300);
        if (!ignore) {
          const payload = response?.data || {};
          setShipments(payload.shipments || []);
          setSelected(payload.selected || null);
        }
      } catch { /* Keep current state on transient failures. */ }
    };
    refreshSelection();
    return () => { ignore = true; };
  }, [selectedShipmentId]);

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Shipment Risk" subtitle="Detailed risk breakdown for individual shipments" icon={<Package className="h-5 w-5 text-foreground-secondary" />} />

      {loading ? (
        <div className="glass-card rounded-xl p-8 text-center text-foreground-secondary text-sm">Loading shipment risk profile...</div>
      ) : error && !selectedShipment?.shipment_id ? (
        <div className="glass-card rounded-xl p-6 border border-destructive/30 text-destructive text-sm">{error}</div>
      ) : (
        <>
          {/* Search + selector */}
          <div className="flex flex-wrap gap-3">
            <input
              type="search"
              placeholder="Search by origin or destination city"
              value={shipmentSearch}
              onChange={(e) => setShipmentSearch(e.target.value)}
              className="flex-1 min-w-[180px] bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-secondary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={selectedShipmentId}
              onChange={(e) => setSelectedShipmentId(e.target.value)}
              className="flex-1 min-w-[260px] bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {filteredShipments.map((s) => (
                <option key={s.shipment_id} value={s.shipment_id}>
                  {s.origin_city || "Unknown"} → {s.destination_city || "Unknown"} | #{s.shipment_id}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2">{error}</div>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Shipment ID",
                value: `#${selectedShipment?.shipment_id}`,
                sub: <span style={{ color: getStatusColor(selectedShipment?.shipment_status) }} className="font-medium">
                  {String(selectedShipment?.shipment_status || "UNKNOWN").replaceAll("_", " ")}
                </span>,
              },
              {
                label: "Route",
                value: routeName,
                valueClass: "text-lg",
                sub: <span className="text-foreground-secondary">{currentCarrier}</span>,
              },
              {
                label: "Shipment Value",
                value: formatCompactCurrency(selectedShipment?.shipment_value),
                valueClass: "text-lg",
                sub: <span className="text-foreground-secondary">Delivery target {formatDate(selectedShipment?.delivery_deadline)}</span>,
              },
              {
                label: "Risk Category",
                value: overallRisk.toFixed(0),
                valueStyle: { color: riskColor },
                sub: <Badge text={riskCategoryText} level={riskCategoryLevel} />,
              },
            ].map((kpi) => (
              <div key={kpi.label} className="glass-card rounded-xl p-4 border border-border">
                <div className="text-xs text-foreground-secondary font-medium uppercase tracking-wide mb-2">{kpi.label}</div>
                <div className={`text-2xl font-bold text-foreground ${kpi.valueClass || ""}`} style={kpi.valueStyle}>{kpi.value}</div>
                <div className="text-xs mt-1">{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Gauge + Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card rounded-xl border border-border p-5">
              <div className="text-sm font-semibold text-foreground mb-1">Overall Risk Score</div>
              <RiskGauge score={overallRisk} color={riskColor} />
              <div className="text-center text-xs text-foreground-secondary mt-1">
                Current category: <span className="font-bold" style={{ color: riskColor }}>{riskCategoryText}</span>
              </div>
            </div>

            <div className="glass-card rounded-xl border border-border p-5">
              <div className="text-sm font-semibold text-foreground mb-0.5">Risk Breakdown</div>
              <div className="text-xs text-foreground-secondary mb-3">Component-level contribution</div>
              <RiskBreakdownChart breakdown={breakdown} />
            </div>
          </div>

          {/* Risk Factors + Mitigation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card rounded-xl border border-border p-5">
              <div className="text-sm font-semibold text-foreground mb-4">Active Risk Factors</div>
              <div className="space-y-3">
                {factors.map((factor) => (
                  <div key={factor.title} className={`flex gap-3 rounded-xl border p-4 ${factor.bg}`}>
                    <span className="flex-shrink-0 mt-0.5">{factor.icon}</span>
                    <div>
                      <div className="text-xs font-semibold text-foreground mb-1">{factor.title}</div>
                      <div className="text-xs text-foreground-secondary leading-relaxed">{factor.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-xl border border-border p-5">
              <div className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> AI Recommended Mitigation</div>
              <div className="space-y-4">
                <p className="text-xs text-foreground-secondary leading-relaxed">
                  {selected?.recommendation || "Execute reroute and backup carrier strategy to reduce operational volatility while protecting delivery SLA."}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Proposed Route",       value: routeName },
                    { label: "Est. Delay Avoidance", value: "Saves 24–48h", cls: "text-green-400" },
                    { label: "Alternative Carrier",  value: currentCarrier },
                    { label: "Financial Impact",     value: "+₹4,200 (Freight)", cls: "text-yellow-400" },
                  ].map((item) => (
                    <div key={item.label} className="bg-muted/60 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-widest text-foreground-secondary font-bold mb-1">{item.label}</div>
                      <div className={`text-xs font-semibold ${item.cls || "text-foreground"}`}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium text-foreground">
                    <span>AI Confidence Score</span>
                    <span>92%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full gradient-brand" style={{ width: "92%" }} />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="button" className="flex-1 px-4 py-2 rounded-lg text-xs font-medium border border-border text-foreground-secondary hover:bg-muted transition-colors flex items-center justify-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> Contact Carrier
                  </button>
                  <button type="button" className="flex-1 px-4 py-2 rounded-lg text-xs font-medium gradient-brand text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                    <Navigation className="h-3.5 w-3.5" /> Execute Reroute Plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
