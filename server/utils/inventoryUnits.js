const UNIT_GROUPS = {
  mass: { g: 1, kg: 1000 },
  volume: { ml: 1, l: 1000, litre: 1000 },
  count: { piece: 1, packet: 1, box: 1, bottle: 1 },
};

const normalizeUnit = (unit) => {
  if (!unit) return "";
  const normalized = String(unit || "").trim().toLowerCase();
  // Prevent processing of combined values like "10kg"
  if (/^\d/.test(normalized)) {
    throw new Error(`Invalid unit format: "${unit}". Unit should not contain numbers. Store quantity separately.`);
  }
  return normalized;
};

export const convertQuantity = (quantity, fromUnit, toUnit) => {
  const amount = Number(quantity);
  if (!Number.isFinite(amount) || amount < 0) return null;
  
  try {
    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);
    
    if (!from || !to) return null;
    if (from === to) return amount;

    const group = Object.values(UNIT_GROUPS).find((units) => units[from] && units[to]);
    if (!group) return null;
    return amount * group[from] / group[to];
  } catch (error) {
    // Return null for invalid unit formats instead of throwing
    console.error("Unit conversion error:", error.message, { quantity, fromUnit, toUnit });
    return null;
  }
};

export const isSupportedUnit = (unit) => {
  try {
    const normalized = normalizeUnit(unit);
    return Object.values(UNIT_GROUPS).some((group) => normalized in group);
  } catch {
    return false;
  }
};

export const supportedUnits = () => Object.values(UNIT_GROUPS).flatMap((group) => Object.keys(group));
