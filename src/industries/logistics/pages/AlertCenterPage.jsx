import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Badge from "@/industries/logistics/components/Badge";
import PageHeader from "@/industries/logistics/components/PageHeader";
import {
  getAlertsView,
  resolveAlert,
  unresolveAlert,
} from "@/industries/logistics/api/logisticsApi";
import { useLogisticsContext } from "@/industries/logistics/context/LogisticsAppContext";
import { formatNumber, getRiskBadgeLevel } from "@/industries/logistics/utils/logistics";

export default function AlertCenter() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    payload: null,
  });
  const [activeTab, setActiveTab] = useState("critical");
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [pageInputError, setPageInputError] = useState("");
  const deferredKeyword = useDeferredValue(keyword);
  const { isAlertResolved, markAlertResolved, markAlertUnresolved } =
    useLogisticsContext();

  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      try {
        const riskSnapshots = await getAlertsView(1000);

        if (!ignore) {
          setState({
            loading: false,
            error: "",
            payload: riskSnapshots?.data || [],
          });
        }
      } catch (error) {
        if (!ignore) {
          setState({
            loading: false,
            error: error?.message || "Failed to load alerts.",
            payload: null,
          });
        }
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, []);

  const alerts = useMemo(() => {
    if (!state.payload) {
      return [];
    }

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
    const categories = new Set(
      alerts.map((alert) => String(alert.category || "Uncategorized").trim()),
    );
    return [
      "all",
      ...Array.from(categories).sort((a, b) => a.localeCompare(b)),
    ];
  }, [alerts]);

  const filteredAlerts = alerts.filter((alert) => {
    const categoryMatches =
      categoryFilter === "all" ||
      String(alert.category || "").toLowerCase() ===
        categoryFilter.toLowerCase();

    if (!categoryMatches) {
      return false;
    }

    if (!deferredKeyword.trim()) {
      return true;
    }

    const haystack =
      `${alert.title} ${alert.category} ${alert.meta} ${alert.entity_id || ""} ${alert.reason} ${alert.recommendation || ""}`.toLowerCase();
    return haystack.includes(deferredKeyword.trim().toLowerCase());
  });

  const activeAlerts = filteredAlerts.filter((alert) => !alert.resolved);
  const resolvedAlerts = filteredAlerts.filter((alert) => alert.resolved);
  const visibleAlerts =
    activeTab === "resolved"
      ? resolvedAlerts
      : activeAlerts.filter((alert) => alert.severity === activeTab);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(visibleAlerts.length / PAGE_SIZE));
  const pagedAlerts = visibleAlerts.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [activeTab, deferredKeyword, categoryFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const startRow = visibleAlerts.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const endRow = Math.min(page * PAGE_SIZE, visibleAlerts.length);

  const applyPageInput = () => {
    const raw = pageInput.trim();

    if (!raw) {
      setPageInput(String(page));
      setPageInputError("");
      return;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setPageInputError("Enter a valid page number starting from 1.");
      return;
    }

    if (parsed > totalPages) {
      setPageInputError(
        `Page ${parsed} is out of range. Maximum available page is ${totalPages}.`,
      );
      return;
    }

    setPage(parsed);
    setPageInputError("");
  };

  const tabs = [
    {
      key: "critical",
      label: "Critical",
      count: activeAlerts.filter((alert) => alert.severity === "critical")
        .length,
    },
    {
      key: "high",
      label: "High",
      count: activeAlerts.filter((alert) => alert.severity === "high").length,
    },
    {
      key: "medium",
      label: "Moderate",
      count: activeAlerts.filter((alert) => alert.severity === "medium").length,
    },
    { key: "resolved", label: "Resolved", count: resolvedAlerts.length },
  ];

  return (
    <div className="logistics-root">
      <PageHeader
        title="Alert Center"
        subtitle="Critical and high-priority risk alerts across shipments"
        icon="🚨"
      />

      {state.loading ? (
        <div className="panel">
          <div className="panel-body">
            <div className="loading-spinner">Loading active alerts...</div>
          </div>
        </div>
      ) : state.error ? (
        <div className="panel">
          <div className="panel-body">
            <div className="upload-error">{state.error}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="filter-bar" style={{ marginBottom: "16px" }}>
            <input
              type="search"
              placeholder="Filter alerts by shipment, vendor, or cause"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              style={{ maxWidth: "260px" }}
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All Categories" : option}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "16px",
              flexWrap: "wrap",
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                <span className="count">{tab.count}</span>
              </button>
            ))}
          </div>

          {visibleAlerts.length ? (
            pagedAlerts.map((alert) => (
              <div key={alert.id} className="alert-card">
                <div className="alert-card-header">
                  <div>
                    <div className="alert-title">{alert.title}</div>
                    <div className="alert-meta">
                      <span>{alert.category}</span>
                      <span>{alert.meta}</span>
                      {alert.entity_id ? <span>{alert.entity_id}</span> : null}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      className={`alert-score ${alert.severity === "medium" ? "medium" : alert.severity}`}
                    >
                      {Math.round(alert.score)}
                    </div>
                    <Badge
                      text={alert.tag}
                      level={getRiskBadgeLevel(alert.score)}
                    />
                  </div>
                </div>

                <div className="alert-why">
                  <div className="alert-why-label">
                    🤖 WHY THIS ALERT WAS GENERATED
                  </div>
                  {alert.reason}
                </div>

                <div className="alert-why" style={{ marginTop: "8px" }}>
                  <div className="alert-why-label">Recommended Action</div>
                  {alert.recommendation}
                </div>

                <div className="alert-actions">
                  <button
                    type="button"
                    onClick={() =>
                      alert.resolved
                        ? (markAlertUnresolved(alert.id),
                          unresolveAlert(alert.id).catch((err) =>
                            console.error("Failed to persist unresolve:", err),
                          ))
                        : (markAlertResolved(alert.id),
                          resolveAlert(alert.id).catch((err) =>
                            console.error("Failed to persist resolve:", err),
                          ))
                    }
                  >
                    {alert.resolved ? "Re-open Alert" : "Mark Resolved"}
                  </button>
                  <div className="alert-ts">
                    Showing {startRow}-{endRow} of {visibleAlerts.length}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="panel">
              <div className="panel-body">
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <div className="empty-state-message">
                    No alerts match the current filters.
                  </div>
                </div>
              </div>
            </div>
          )}

          {visibleAlerts.length ? (
            <div className="alert-pagination">
              <input
                className="alert-pagination-input"
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(event) => {
                  const next = event.target.value;
                  setPageInput(next);
                  if (!next.trim()) {
                    setPageInputError("");
                    return;
                  }

                  const parsed = Number.parseInt(next, 10);
                  if (!Number.isFinite(parsed) || parsed < 1) {
                    setPageInputError(
                      "Enter a valid page number starting from 1.",
                    );
                    return;
                  }

                  if (parsed > totalPages) {
                    setPageInputError(
                      `Page ${parsed} is out of range. Maximum available page is ${totalPages}.`,
                    );
                    return;
                  }

                  setPageInputError("");
                  setPage(parsed);
                }}
                onBlur={applyPageInput}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    applyPageInput();
                  }
                }}
                aria-label="Jump to page"
              />
              <span className="table-cell-meta" style={{ marginTop: 0 }}>
                / {totalPages}
              </span>
              <button
                className="alert-pagination-btn"
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <button
                className="alert-pagination-btn"
                type="button"
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          ) : null}

          {visibleAlerts.length && pageInputError ? (
            <div
              className="upload-error"
              style={{ marginTop: "8px", textAlign: "right" }}
            >
              {pageInputError}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
