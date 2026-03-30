import { useEffect, useMemo, useState } from "react";
import PlotModule from "react-plotly.js";
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

const chartConfig = {
  displayModeBar: false,
  responsive: true,
  staticPlot: false,
  doubleClick: false,
};
const Plot = PlotModule?.default ?? PlotModule;

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
          setError(
            requestError?.message || "Failed to load shipment risk data.",
          );
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      ignore = true;
    };
  }, []);

  const selectedShipment = useMemo(() => selected?.shipment || {}, [selected]);
  const riskSnapshot = useMemo(() => selected?.snapshot || {}, [selected]);
  const filteredShipments = useMemo(() => {
    const query = shipmentSearch.trim().toLowerCase();
    if (!query) {
      return shipments;
    }

    return shipments.filter((shipment) => {
      const haystack =
        `${shipment.origin_city || ""} ${shipment.destination_city || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [shipments, shipmentSearch]);

  const overallRisk = toNumber(selected?.risk_score);
  const routeName = `${selectedShipment?.origin_city || "Unknown"} → ${selectedShipment?.destination_city || "Unknown"}`;
  const currentCarrier = selectedShipment?.vendor_name || "No carrier assigned";
  const riskCategoryLevel = getRiskBadgeLevel(overallRisk);
  const riskCategoryText = riskCategoryLevel.toUpperCase();
  const etaDays = (() => {
    const deadline = selectedShipment?.delivery_deadline;
    if (!deadline) {
      return null;
    }
    const dt = new Date(deadline);
    if (Number.isNaN(dt.getTime())) {
      return null;
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    dt.setHours(0, 0, 0, 0);
    return Math.round((dt.getTime() - now.getTime()) / 86400000);
  })();

  const breakdown = [
    ["Operational", toNumber(selected?.components?.operational_score)],
    ["Financial", toNumber(selected?.components?.financial_score)],
    ["Vendor", toNumber(selected?.components?.vendor_score)],
    ["Compliance", toNumber(selected?.components?.compliance_score)],
  ];

  const highestComponent = [...breakdown].sort((a, b) => b[1] - a[1])[0] || [
    "Operational",
    0,
  ];
  const secondComponent = [...breakdown].sort((a, b) => b[1] - a[1])[1] || [
    "Vendor",
    0,
  ];

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
    if (!selectedShipmentId) {
      return;
    }

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
        // Keep current state to avoid jitter on transient request failures.
      }
    };
    refreshSelection();
    return () => {
      ignore = true;
    };
  }, [selectedShipmentId]);

  return (
    <div className="logistics-root">
      <PageHeader
        title="Shipment Risk"
        subtitle="Detailed risk breakdown for individual shipments"
        icon="📦"
      />

      {loading ? (
        <div className="panel">
          <div className="panel-body">
            <div className="loading-spinner">
              Loading shipment risk profile...
            </div>
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
              onChange={(event) => setShipmentSearch(event.target.value)}
            />
            <select
              value={selectedShipmentId}
              onChange={(event) => setSelectedShipmentId(event.target.value)}
            >
              {filteredShipments.map((shipment) => (
                <option key={shipment.shipment_id} value={shipment.shipment_id}>
                  {shipment.origin_city || "Unknown"} →{" "}
                  {shipment.destination_city || "Unknown"} | #
                  {shipment.shipment_id}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="upload-error" style={{ marginBottom: "16px" }}>
              {error}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div className="kpi-card">
              <div className="kpi-label">Shipment ID</div>
              <div className="kpi-value">#{selectedShipment?.shipment_id}</div>
              <div className="kpi-delta neutral">
                <span
                  style={{
                    color: getStatusColor(selectedShipment?.shipment_status),
                  }}
                >
                  {String(
                    selectedShipment?.shipment_status || "UNKNOWN",
                  ).replaceAll("_", " ")}
                </span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Route</div>
              <div className="kpi-value" style={{ fontSize: "18px" }}>
                {selectedShipment?.origin_city || "Unknown"} →{" "}
                {selectedShipment?.destination_city || "Unknown"}
              </div>
              <div className="kpi-delta neutral">
                {selectedShipment?.vendor_name || "No carrier assigned"}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Shipment Value</div>
              <div className="kpi-value" style={{ fontSize: "18px" }}>
                {formatCompactCurrency(selectedShipment?.shipment_value)}
              </div>
              <div className="kpi-delta neutral">
                Delivery target{" "}
                {formatDate(selectedShipment?.delivery_deadline)}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Risk Category</div>
              <div
                className="kpi-value"
                style={{ color: getRiskColor(overallRisk) }}
              >
                {overallRisk.toFixed(0)}
              </div>
              <div className="kpi-delta neutral">
                <Badge text={riskCategoryText} level={riskCategoryLevel} />
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(320px, 0.95fr) minmax(0, 1.2fr)",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Overall Risk Score</div>
              </div>
              <div className="panel-body">
                <Plot
                  data={[
                    {
                      type: "indicator",
                      mode: "gauge+number",
                      value: overallRisk,
                      number: {
                        font: {
                          size: 42,
                          color: getRiskColor(overallRisk),
                          family: "Sora, sans-serif",
                        },
                      },
                      gauge: {
                        axis: { range: [0, 100], visible: false },
                        bar: {
                          color: getRiskColor(overallRisk),
                          thickness: 0.22,
                        },
                        bgcolor: "rgba(0,0,0,0)",
                        borderwidth: 0,
                        steps: [
                          { range: [0, 35], color: "rgba(16,185,129,0.12)" },
                          { range: [35, 65], color: "rgba(245,158,11,0.12)" },
                          { range: [65, 100], color: "rgba(239,68,68,0.12)" },
                        ],
                      },
                    },
                  ]}
                  layout={{
                    autosize: true,
                    height: 260,
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    margin: { l: 10, r: 10, t: 10, b: 10 },
                    dragmode: false,
                    hovermode: "closest",
                  }}
                  style={{ width: "100%", height: "260px" }}
                  config={chartConfig}
                />
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--text-2)",
                    fontSize: "12px",
                  }}
                >
                  Current category:{" "}
                  <span
                    style={{
                      color: getRiskColor(overallRisk),
                      fontWeight: 700,
                    }}
                  >
                    {riskCategoryText}
                  </span>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Risk Breakdown</div>
                <div className="panel-meta">Component-level contribution</div>
              </div>
              <div className="panel-body">
                <Plot
                  data={[
                    {
                      type: "bar",
                      orientation: "h",
                      y: breakdown.map(([label]) => label).reverse(),
                      x: breakdown.map(([, value]) => value).reverse(),
                      marker: {
                        color: breakdown
                          .map(([, value]) => getRiskColor(value))
                          .reverse(),
                      },
                      hovertemplate: "%{y}: %{x:.1f}<extra></extra>",
                    },
                  ]}
                  layout={{
                    autosize: true,
                    height: 260,
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    margin: { l: 110, r: 20, t: 10, b: 20 },
                    font: {
                      color: "#94A3B8",
                      family: "Nunito Sans, sans-serif",
                    },
                    xaxis: {
                      range: [0, 100],
                      gridcolor: "rgba(255,255,255,0.05)",
                    },
                    yaxis: { automargin: true },
                    showlegend: false,
                    dragmode: false,
                    hovermode: "closest",
                  }}
                  style={{ width: "100%", height: "260px" }}
                  config={chartConfig}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: "16px",
            }}
          >
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Active Risk Factors</div>
              </div>
              <div className="panel-body">
                {factors.map((factor) => (
                  <div key={factor.title} className="risk-factor">
                    <div
                      className="risk-factor-icon"
                      style={{ background: factor.color }}
                    >
                      {factor.icon}
                    </div>
                    <div>
                      <div className="risk-factor-title">{factor.title}</div>
                      <div className="risk-factor-desc">
                        {factor.description}
                      </div>
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
                    {selected?.recommendation ||
                      "Execute reroute and backup carrier strategy to reduce operational volatility while protecting delivery SLA."}
                  </div>

                  <div className="mitigation-grid">
                    <div>
                      <div className="mitigation-label">Proposed Route</div>
                      <div className="mitigation-value">🛣️ {routeName}</div>
                    </div>
                    <div>
                      <div className="mitigation-label">
                        Est. Delay Avoidance
                      </div>
                      <div className="mitigation-value good">
                        ✅ Saves 24-48h
                      </div>
                    </div>
                    <div>
                      <div className="mitigation-label">
                        Alternative Carrier
                      </div>
                      <div className="mitigation-value">
                        🚚 {currentCarrier}
                      </div>
                    </div>
                    <div>
                      <div className="mitigation-label">Financial Impact</div>
                      <div className="mitigation-value warn">
                        ↑ +₹4,200 (Freight)
                      </div>
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
                    <button type="button" className="mitigation-btn">
                      📞 Contact Carrier
                    </button>
                    <button type="button" className="primary mitigation-btn">
                      🚀 Execute Reroute Plan
                    </button>
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
