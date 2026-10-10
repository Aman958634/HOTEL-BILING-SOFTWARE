/**
 * Monetary values are stored and compared as integer paise. Convert to a
 * decimal number only at API/model boundaries that currently use Number.
 */
const DECIMAL = /^([+-]?)(\d+)(?:\.(\d*))?$/;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const parseScaled = (value, places) => {
  const input = String(value ?? 0).trim();
  const match = DECIMAL.exec(input);
  if (!match) throw new TypeError("Amount must be a finite decimal value");
  const [, sign, wholePart, fractionalPart = ""] = match;
  const factor = 10n ** BigInt(places);
  const padded = `${fractionalPart}${"0".repeat(places)}`;
  let scaled = BigInt(wholePart) * factor + BigInt(padded.slice(0, places) || "0");
  if (fractionalPart.length > places && fractionalPart[places] >= "5") scaled += 1n;
  if (sign === "-") scaled = -scaled;
  if (scaled > MAX_SAFE || scaled < -MAX_SAFE) throw new RangeError("Amount is too large");
  return Number(scaled);
};

const roundedDivide = (numerator, denominator) => {
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const divisor = BigInt(denominator);
  const result = (absolute + (divisor / 2n)) / divisor;
  const signed = negative ? -result : result;
  if (signed > MAX_SAFE || signed < -MAX_SAFE) throw new RangeError("Amount is too large");
  return Number(signed);
};

export const toPaise = (value, { allowNegative = true } = {}) => {
  const paise = parseScaled(value, 2);
  if (!allowNegative && paise < 0) throw new RangeError("Amount cannot be negative");
  return paise;
};
export const fromPaise = (value) => Number(value) / 100;
export const clampPaise = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Math.min(Math.max(value, min), max);
export const multiplyPaise = (unitPaise, quantity) => roundedDivide(BigInt(unitPaise) * BigInt(parseScaled(quantity, 3)), 1000);
export const percentageOfPaise = (amountPaise, percent) => roundedDivide(BigInt(amountPaise) * BigInt(parseScaled(percent, 2)), 10000);
export const paiseToGatewayAmount = (value) => toPaise(value, { allowNegative: false });
export const gatewayAmountToMoney = (paise) => fromPaise(Number(paise));
