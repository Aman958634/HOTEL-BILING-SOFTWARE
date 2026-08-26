const UNIT_GROUPS = {
  mass: { g: 1, kg: 1000 },
  volume: { ml: 1, l: 1000, litre: 1000 },
  count: { piece: 1, packet: 1, box: 1, bottle: 1 },
};

const normalizeUnit = (unit) => String(unit || "").trim().toLowerCase();

export const convertQuantity = (quantity, fromUnit, toUnit) => {
  const amount = Number(quantity);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return amount;

  const group = Object.values(UNIT_GROUPS).find((units) => units[from] && units[to]);
  if (!group) return null;
  return amount * group[from] / group[to];
};

export const isSupportedUnit = (unit) => Object.values(UNIT_GROUPS).some((group) => normalizeUnit(unit) in group);
export const supportedUnits = () => Object.values(UNIT_GROUPS).flatMap((group) => Object.keys(group));
