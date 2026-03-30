import clsx from "clsx";

/**
 * Badge Component
 * Displays a colored badge with text
 *
 * @param {string} text - Badge text
 * @param {string} level - Badge level: "critical" | "high" | "medium" | "low" | "info" | "purple"
 */
export default function Badge({ text, level = "info" }) {
  const levelClass = `badge-${level.toLowerCase()}`;

  return <span className={clsx("badge", levelClass)}>{text}</span>;
}
