import { useEffect, useMemo, useState } from "react";
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
  // Semicircle: sweep from 180° to 0° (left to right)
  const r = 80;
  const cx = 100;
  const cy = 100;
  const startAngle = Math.PI;           // 180° in radians
  const endAngle = 0;                   // 0° = rightmost
  const sweepAngle = startAngle - (startAngle - endAngle) * (pct / 100);

  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(sweepAngle);
  const y2 = cy + r * Math.sin(sweepAngle);

  const trackX1 = cx + r * Math.cos(startAngle);
  const trackY1 = cy + r * Math.sin(startAngle);
  const trackX2 = cx + r * Math.cos(endAngle);
  const trackY2 = cy + r * Math.sin(endAngle);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0" }}>
      <svg viewBox="0 0 200 115" style={{ width: "100%", maxWidth: "260px" }}>
        {/* Zone backgrounds */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="18" />
        {/* Track */}
        <path d={`M ${trackX1} ${trackY1} A ${r} ${r} 0 0 1 ${trackX2} ${trackY2}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round" />
        {/* Value arc */}
        {pct > 0 && (
          <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${sweepAngle < Math.PI / 2 ? 1 : 0} 0 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
        )}
        {/* Score text */}
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
          if (nextShipments.length) {
            setSelectedShipmentId(String(nextShipments[0].shipment_id));
          }
          setLoading(false);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError?.message || "Failed to load shipment risk data.");
          setLoading(false);
        }
      }
    };

    init();

    return () => { ignore = true; };
  }, []);

  const selectedShipment = useMemo(() => selected?.shipment || {}, [selected]);
  const filteredShipments = useMemo(() => {
    const query = shipmentSearch.trim().toLowerCase();
    if (!query) return shipments;
    return shipments.filter((shipment) => {
      const haystack = `${shipment.origin_city || ""} ${shipment.destination_city || ""}`.toLowerCase();
      return haystack.includes(query);
    });
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
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    dt.setHours(0, 0, 0, 0);
    return Math.round((dt.getTime() - now.getTime()) / 86400000);
  })();

  const breakdown = [
    ["Operational", toNumber(selected?.components?.operational_score)],
    ["Financial",   toNumber(selected?.components?.financial_score)],
    ["Vendor",      toNumber(selected?.components?.vendor_score)],
    ["Compliance",  toNumber(selected?.components?.compliance_score)],
  ];

  const highestComponent = [...breakdown].sort((a, b) => b[1] - a[1])[0] || ["Operational", 0];
  const secondComponent  = [...breakdown].sort((a, b) => b[1] - a[1])[1] || ["Vendor", 0];

  const factors = [
    {
      title: "Primary Exposure Driver",
      description: `${highestComponent[0]} contributes ${highestComponent[1].toFixed(1)} points to the total ${overallRisk.toFixed(1)} risk score (${riskCategoryText}). This is currently the dominant risk lever for this shipment.`,
      icon: "📌",
      color: "rgba(239,68,68,0.16)",
    },
    {
      title: "Secondary Risk Pressure",
      description: `${secondComponent[0]} is the second-highest contributor at ${secondComponent[1].toFixed(1)} points. Coordinated action on the top two components will reduce score faster than isolated interventions.`,
      icon: "📊",
      color: "rgba(245,158,11,0.16)",
    },
    {
      title: "Service-Level Outlook",
      description:
        etaDays == null
          ? `Current shipment status is ${String(selectedShipment?.shipment_status || "UNKNOWN").replaceAll("_", " ")}. Deadline data is unavailable, so SLA exposure is being monitored through live status transitions.`
          : etaDays >= 0
            ? `Delivery deadline is in ${etaDays} day(s). Keep carrier and route controls active to protect on-time commitment and avoid avoidable cost escalation.`
            : `Delivery deadline is overdue by ${Math.abs(etaDays)} day(s). Escalation protocol should stay active until milestone recovery is confirmed.`,
      icon: "🧭",
      color: "rgba(59,130,246,0.16)",
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
      } catch {
        // Keep current state on transient failures.
      }
    };
    refreshSelection();
    return () => { ignore = true; };
  }, [selectedShipmentId]);

  return (
    <div className="logistics-root">
      <PageHeader title="Shipment Risk" subtitle="Detailed risk breakdown for individual shipments" icon="📦" />

      {loading ? (
        <div className="panel">
          <div className="panel-body">
            <div className="loading-spinner">Loading shipment risk profile...</div>
          </div>
        </div>
      ) : error && !selectedShipment ? (
        <div className="panel">
          <div className="panel-body">
            <div className="upload-error">{error}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="filter-bar" style={{ marginBottom: "16px" }}>
            <input
              type="search"
              placeholder="Search by origin or destination city"
              value={shipmentSearch}
              onChange={(e) => setShipmentSearch(e.target.value)}
            />
            <select value={selectedShipmentId} onChange={(e) => setSelectedShipmentId(e.target.value)}>
              {filteredShipments.map((shipment) => (
                <option key={shipment.shipment_id} value={shipment.shipment_id}>
                  {shipment.origin_city || "Unknown"} → {shipment.destination_city || "Unknown"} | #{shipment.shipment_id}
                </option>
              ))}
            </select>
          </div>

          {error ? <div className="upload-error" style={{ marginBottom: "16px" }}>{error}</div> : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <div className="kpi-card">
              <div className="kpi-label">Shipment ID</div>
              <div className="kpi-value">#{selectedShipment?.shipment_id}</div>
              <div className="kpi-delta neutral">
                <span style={{ color: getStatusColor(selectedShipment?.shipment_status) }}>
                  {String(selectedShipment?.shipment_status || "UNKNOWN").replaceAll("_", " ")}
                </span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Route</div>
              <div className="kpi-value" style={{ fontSize: "18px" }}>
                {selectedShipment?.origin_city || "Unknown"} → {selectedShipment?.destination_city || "Unknown"}
              </div>
              <div className="kpi-delta neutral">{selectedShipment?.vendor_name || "No carrier assigned"}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Shipment Value</div>
              <div className="kpi-value" style={{ fontSize: "18px" }}>{formatCompactCurrency(selectedShipment?.shipment_value)}</div>
              <div className="kpi-delta neutral">Delivery target {formatDate(selectedShipment?.delivery_deadline)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Risk Category</div>
              <div className="kpi-value" style={{ color: riskColor }}>{overallRisk.toFixed(0)}</div>
              <div className="kpi-delta neutral"><Badge text={riskCategoryText} level={riskCategoryLevel} /></div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 0.95fr) minmax(0, 1.2fr)", gap: "16px", marginBottom: "16px" }}>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Overall Risk Score</div>
              </div>
              <div className="panel-body">
                <RiskGauge score={overallRisk} color={riskColor} />
                <div style={{ textAlign: "center", color: "var(--text-2)", fontSize: "12px" }}>
                  Current category:{" "}
                  <span style={{ color: riskColor, fontWeight: 700 }}>{riskCategoryText}</span>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Risk Breakdown</div>
                <div className="panel-meta">Component-level contribution</div>
              </div>
              <div className="panel-body">
                <RiskBreakdownChart breakdown={breakdown} />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "16px" }}>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Active Risk Factors</div>
              </div>
              <div className="panel-body">
                {factors.map((factor) => (
                  <div key={factor.title} className="risk-factor">
                    <div className="risk-factor-icon" style={{ background: factor.color }}>{factor.icon}</div>
                    <div>
                      <div className="risk-factor-title">{factor.title}</div>
                      <div className="risk-factor-desc">{factor.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">🤖 AI Recommended Mitigation</div>
              </div>
              <div className="panel-body">
                <div className="mitigation-block">
                  <div className="mitigation-summary">
                    {selected?.recommendation || "Execute reroute and backup carrier strategy to reduce operational volatility while protecting delivery SLA."}
                  </div>
                  <div className="mitigation-grid">
                    <div>
                      <div className="mitigation-label">Proposed Route</div>
                      <div className="mitigation-value">🛣️ {routeName}</div>
                    </div>
                    <div>
                      <div className="mitigation-label">Est. Delay Avoidance</div>
                      <div className="mitigation-value good">✅ Saves 24-48h</div>
                    </div>
                    <div>
                      <div className="mitigation-label">Alternative Carrier</div>
                      <div className="mitigation-value">🚚 {currentCarrier}</div>
                    </div>
                    <div>
                      <div className="mitigation-label">Financial Impact</div>
                      <div className="mitigation-value warn">↑ +₹4,200 (Freight)</div>
                    </div>
                  </div>
                  <div className="mitigation-confidence">
                    <div className="mitigation-confidence-head">
                      <span>AI Confidence Score</span>
                      <span>92%</span>
                    </div>
                    <div className="mitigation-confidence-bar">
                      <div className="mitigation-confidence-fill" />
                    </div>
                  </div>
                  <div className="mitigation-actions">
                    <button type="button" className="mitigation-btn">📞 Contact Carrier</button>
                    <button type="button" className="primary mitigation-btn">🚀 Execute Reroute Plan</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
