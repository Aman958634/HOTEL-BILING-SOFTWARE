import ApiError from "./ApiError.js";

const DAY = 86_400_000;
const zoneParts = (date, timeZone) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
const offsetAt = (instant, timeZone) => { const part = zoneParts(instant, timeZone); return Date.UTC(part.year, part.month - 1, part.day, part.hour, part.minute, part.second) - instant.getTime(); };
const localToUtc = (parts, timeZone) => { const guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0); let instant = new Date(guess - offsetAt(new Date(guess), timeZone)); instant = new Date(guess - offsetAt(instant, timeZone)); return instant; };
const addLocalDays = (parts, days) => { const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days)); return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: 0, minute: 0, second: 0 }; };
const dateParts = (value, name) => { const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!match) throw new ApiError(422, `${name} must use YYYY-MM-DD`); const result = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: 0, minute: 0, second: 0 }; const check = new Date(Date.UTC(result.year, result.month - 1, result.day)); if (check.getUTCFullYear() !== result.year || check.getUTCMonth() + 1 !== result.month || check.getUTCDate() !== result.day) throw new ApiError(422, `${name} is invalid`); return result; };

export const resolveBusinessRange = ({ range = "last_30_days", startDate, endDate, timeZone = "Asia/Kolkata" } = {}) => {
  const now = new Date(); const today = zoneParts(now, timeZone); const dayStart = { ...today, hour: 0, minute: 0, second: 0 };
  let startParts; let endParts; let granularity = "day"; const aliases = { "7d": "last_7_days", "30d": "last_30_days", year: "this_year" }; const key = aliases[String(range || "last_30_days").toLowerCase()] || String(range || "last_30_days").toLowerCase();
  if (key === "custom") { startParts = dateParts(startDate, "startDate"); endParts = addLocalDays(dateParts(endDate, "endDate"), 1); }
  else if (key === "today") { startParts = dayStart; endParts = addLocalDays(dayStart, 1); granularity = "hour"; }
  else if (key === "yesterday") { endParts = dayStart; startParts = addLocalDays(dayStart, -1); granularity = "hour"; }
  else if (key === "last_7_days") { startParts = addLocalDays(dayStart, -6); endParts = addLocalDays(dayStart, 1); }
  else if (key === "last_30_days") { startParts = addLocalDays(dayStart, -29); endParts = addLocalDays(dayStart, 1); }
  else if (key === "this_week") { const localDay = new Date(Date.UTC(today.year, today.month - 1, today.day)); startParts = addLocalDays(dayStart, -((localDay.getUTCDay() + 6) % 7)); endParts = addLocalDays(dayStart, 1); }
  else if (key === "last_week") { const localDay = new Date(Date.UTC(today.year, today.month - 1, today.day)); endParts = addLocalDays(dayStart, -((localDay.getUTCDay() + 6) % 7)); startParts = addLocalDays(endParts, -7); }
  else if (key === "this_month") { startParts = { year: today.year, month: today.month, day: 1, hour: 0, minute: 0, second: 0 }; endParts = addLocalDays(dayStart, 1); }
  else if (key === "last_month") { const first = new Date(Date.UTC(today.year, today.month - 1, 1)); const prior = new Date(Date.UTC(today.year, today.month - 2, 1)); startParts = { year: prior.getUTCFullYear(), month: prior.getUTCMonth() + 1, day: 1, hour: 0, minute: 0, second: 0 }; endParts = { year: first.getUTCFullYear(), month: first.getUTCMonth() + 1, day: 1, hour: 0, minute: 0, second: 0 }; }
  else if (key === "this_year") { startParts = { year: today.year, month: 1, day: 1, hour: 0, minute: 0, second: 0 }; endParts = addLocalDays(dayStart, 1); granularity = "month"; }
  else throw new ApiError(422, "Invalid business intelligence range");
  const start = localToUtc(startParts, timeZone); const end = localToUtc(endParts, timeZone); const days = Math.ceil((end - start) / DAY); if (days < 1 || days > 366) throw new ApiError(422, "Date range must be between 1 and 366 business days"); if (days > 90) granularity = "week"; if (days > 180) granularity = "month";
  return { range: key, start, end, previousStart: new Date(start.getTime() - (end.getTime() - start.getTime())), previousEnd: start, days, granularity, timeZone };
};
