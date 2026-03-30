import clsx from "clsx";

/**
 * KPI Card Component
 * Displays a metric with label, value, delta, and optional icon
 *
 * @param {string} label - Card label (uppercase)
 * @param {string|number} value - Main value to display
 * @param {string} delta - Change indicator (e.g., "+5%", "10 more")
 * @param {string} deltaDir - Direction: "up" | "dn" | "neutral"
 * @param {string} icon - Optional emoji icon
 * @param {string} color - Card accent color: "blue" | "red" | "yellow" | "orange" | "green" | "purple" | "cyan"
 * @param {string} valueColor - Optional value text color
 */
export default function KPICard({
  label,
  value,
  delta = "",
  deltaDir = "neutral",
  icon = "",
  color = "blue",
  valueColor = "",
}) {
  // Delta arrow based on direction
  const arrow = deltaDir === "up" ? "↑" : deltaDir === "dn" ? "↓" : "→";

  return (
    <div className={clsx("kpi-card", color)}>
      <div className="kpi-label">
        {icon && <span style={{ fontSize: "14px", opacity: 0.7 }}>{icon}</span>}
        {label}
      </div>
      <div className={clsx("kpi-value", valueColor)}>{value}</div>
      {delta && (
        <div className={clsx("kpi-delta", deltaDir)}>
          {arrow} {delta}
        </div>
      )}
    </div>
  );
}
