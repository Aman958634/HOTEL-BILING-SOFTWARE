/**
 * Centralized comparison period labeling for dashboards and reports.
 * This utility provides consistent labels for period-over-period comparisons.
 */

/**
 * Get the comparison period label based on the current range and type.
 * @param {string} range - The current range (e.g., "today", "this_month", "last_month")
 * @param {string} type - The type of comparison ("dashboard" or "report")
 * @returns {string} - The comparison period label (e.g., "vs yesterday", "vs last month")
 */
export const getComparisonPeriodLabel = (range = "today", type = "dashboard") => {
  const rangeNormalized = String(range || "today").toLowerCase();

  // Dashboard uses today vs yesterday by default
  if (type === "dashboard") {
    return "vs yesterday";
  }

  // Report comparisons depend on the selected range
  const periodMap = {
    today: "vs yesterday",
    yesterday: "vs 2 days ago",
    this_week: "vs last week",
    last_week: "vs 2 weeks ago",
    this_month: "vs last month",
    last_month: "vs 2 months ago",
    this_year: "vs last year",
    custom: "vs previous period",
  };

  return periodMap[rangeNormalized] || "vs previous period";
};

/**
 * Format a percentage value to remove signs (arrow will show direction).
 * @param {number} percent - The percentage value (can be positive or negative)
 * @returns {string} - The formatted percentage without sign (e.g., "75.2%" instead of "+75.2%" or "-75.2%")
 */
export const formatPercentageAbsolute = (percent) => {
  const value = Number(percent || 0);
  if (Number.isNaN(value)) return "—";
  if (value === 0) return "0%";
  return `${Math.abs(value)}%`;
};

/**
 * Determine growth type from percentage value.
 * @param {number} percent - The percentage value
 * @returns {string} - One of: "positive", "negative", "neutral"
 */
export const getGrowthType = (percent) => {
  const value = Number(percent || 0);
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
};

/**
 * Get the arrow indicator for a percentage.
 * @param {number} percent - The percentage value
 * @returns {string} - Arrow symbol: "↑", "↓", or "—"
 */
export const getGrowthArrow = (percent) => {
  const value = Number(percent || 0);
  if (value > 0) return "↑";
  if (value < 0) return "↓";
  return "—";
};
