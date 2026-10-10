const DECIMAL = /^([+-]?)(\d+)(?:\.(\d*))?$/;

const parseScaled = (value, places) => {
  const match = DECIMAL.exec(String(value ?? 0).trim());
  if (!match) return 0;
  const [, sign, wholePart, fractionalPart = ""] = match;
  const padded = `${fractionalPart}${"0".repeat(places)}`;
  let scaled = BigInt(wholePart) * (10n ** BigInt(places)) + BigInt(padded.slice(0, places) || 0);
  if (fractionalPart.length > places && fractionalPart[places] >= "5") scaled += 1n;
  return Number(sign === "-" ? -scaled : scaled);
};

const roundedDivide = (numerator, denominator) => {
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const result = (absolute + (BigInt(denominator) / 2n)) / BigInt(denominator);
  return Number(negative ? -result : result);
};

export const toPaise = (value) => parseScaled(value, 2);
export const fromPaise = (value) => Number(value) / 100;
export const multiplyPaise = (unitPaise, quantity) => roundedDivide(BigInt(unitPaise) * BigInt(parseScaled(quantity, 3)), 1000);
export const percentageOfPaise = (amountPaise, percent) => roundedDivide(BigInt(amountPaise) * BigInt(parseScaled(percent, 2)), 10000);
