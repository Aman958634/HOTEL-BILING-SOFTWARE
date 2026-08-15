/** Format growth for StatCard — accepts number, string label, or growth object from API. */
export const formatGrowthTrend = (trend) => {
  if (trend && typeof trend === "object" && trend.label) {
    return {
      label: trend.label,
      type: trend.type || "neutral",
    };
  }

  if (typeof trend === "string") {
    if (trend === "New") return { label: "New", type: "positive" };
    if (trend === "—" || trend === "-") return { label: "—", type: "neutral" };
    const numeric = Number(String(trend).replace("%", ""));
    if (!Number.isNaN(numeric)) {
      return {
        label: String(trend).includes("%") ? trend : `${numeric > 0 ? "+" : ""}${numeric}%`,
        type: numeric > 0 ? "positive" : numeric < 0 ? "negative" : "neutral",
      };
    }
    return { label: trend, type: "neutral" };
  }

  const value = Number(trend || 0);
  if (value === 0) return { label: "0%", type: "neutral" };
  return {
    label: `${value > 0 ? "+" : ""}${value}%`,
    type: value > 0 ? "positive" : "negative",
  };
};
