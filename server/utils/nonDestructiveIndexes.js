import { isDeepStrictEqual } from "node:util";

const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameOptions = (existing, wanted) =>
  ["unique", "sparse"].every((key) => Boolean(existing[key]) === Boolean(wanted[key])) &&
  ["partialFilterExpression", "expireAfterSeconds", "collation"].every((key) => isDeepStrictEqual(existing[key], wanted[key]));

// Unknown indexes remain untouched. Conflicting semantics require a reviewed,
// manual migration. Preflight the entire collection before any additive work.
export const planIndexes = (existing, definitions) => {
  const missing = [];
  const conflicts = [];
  for (const [key, options] of definitions) {
    const name = options.name || Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join("_");
    const candidates = existing.filter((index) => index.name === name || sameKey(index.key, key));
    if (candidates.some((index) => !sameKey(index.key, key) || !sameOptions(index, options))) {
      conflicts.push({ index: name, reason: "Existing index has conflicting keys or options; manual migration required." });
    } else if (!candidates.length) missing.push([key, { ...options, name }]);
  }
  return { missing, conflicts };
};

export const ensureIndexesNonDestructively = async (collection, definitions, { verifyOnly = false } = {}) => {
  let existing;
  try { existing = await collection.indexes(); }
  catch (error) { if (error.code !== 26) throw error; existing = []; }
  const plan = planIndexes(existing, definitions);
  if (plan.conflicts.length) {
    const error = new Error("Index conflict: manual migration required. No indexes or data were changed.");
    error.code = "MANUAL_INDEX_MIGRATION_REQUIRED";
    error.conflicts = plan.conflicts;
    throw error;
  }
  if (!verifyOnly) for (const [key, options] of plan.missing) await collection.createIndex(key, options);
  return { missing: plan.missing.map(([, options]) => options.name), created: verifyOnly ? 0 : plan.missing.length };
};
