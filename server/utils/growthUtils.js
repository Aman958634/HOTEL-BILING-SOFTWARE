/** Consistent period-over-period growth for dashboards and reports. */
export const calculateGrowth = (current, previous) => {
  const c = Number(current || 0);
  const p = Number(previous || 0);

  if (p === 0 && c === 0) {
    return { value: 0, label: "—", type: "neutral" };
  }
  if (p === 0 && c > 0) {
    return { value: null, label: "New", type: "positive" };
  }
  if (c === p) {
    return { value: 0, label: "0%", type: "neutral" };
  }

  const pct = Number((((c - p) / p) * 100).toFixed(1));
  return {
    value: pct,
    label: `${pct > 0 ? "+" : ""}${pct}%`,
    type: pct > 0 ? "positive" : "negative",
  };
};

export const growthLabel = (current, previous) => calculateGrowth(current, previous).label;

export const growthValue = (current, previous) => calculateGrowth(current, previous).value;
