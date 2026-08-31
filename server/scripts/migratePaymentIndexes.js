import "dotenv/config";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import {
  hasExactIndexKey,
  hasRequiredPaymentUniqueIndexes,
  indexMatchesDefinition,
  paymentUniqueIndexDefinitions,
} from "../utils/paymentIndexDefinitions.js";

const mongoUri = String(process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
if (!mongoUri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

const duplicateGroupCount = async (definition) => {
  const groupId = Object.fromEntries(Object.keys(definition.key).map((field) => [field, `$${field}`]));
  const pipeline = [
    ...(definition.options.partialFilterExpression ? [{ $match: definition.options.partialFilterExpression }] : []),
    { $group: { _id: groupId, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "groups" },
  ];
  const [result] = await Payment.collection.aggregate(pipeline).toArray();
  return Number(result?.groups || 0);
};

const legacyUniqueOrderIndexes = (indexes) =>
  indexes.filter((index) => index.unique === true && hasExactIndexKey(index, { orderId: 1 }));

await mongoose.connect(mongoUri, { autoIndex: false, autoCreate: false });
try {
  // Every potentially conflicting value is checked before any index is
  // removed. Only aggregate group counts are logged; no payment data changes.
  for (const definition of paymentUniqueIndexDefinitions) {
    const conflicts = await duplicateGroupCount(definition);
    if (conflicts) {
      throw new Error(`Cannot create ${definition.name}: ${conflicts} real duplicate identifier group(s) require manual review`);
    }
  }

  let indexes = await Payment.collection.indexes();
  for (const legacyIndex of legacyUniqueOrderIndexes(indexes)) {
    await Payment.collection.dropIndex(legacyIndex.name);
    console.log(`Removed obsolete unique order index: ${legacyIndex.name}`);
  }

  indexes = await Payment.collection.indexes();
  for (const definition of paymentUniqueIndexDefinitions) {
    const correct = indexes.find((index) => indexMatchesDefinition(index, definition));
    if (correct) {
      console.log(`Payment index valid: ${definition.name}`);
      continue;
    }

    const conflictingDefinitions = indexes.filter((index) => hasExactIndexKey(index, definition.key));
    for (const index of conflictingDefinitions) {
      await Payment.collection.dropIndex(index.name);
      console.log(`Replaced incompatible payment index: ${index.name}`);
    }

    await Payment.collection.createIndex(definition.key, { ...definition.options, name: definition.name });
    console.log(`Created payment index: ${definition.name}`);
    indexes = await Payment.collection.indexes();
  }

  const finalIndexes = await Payment.collection.indexes();
  if (!hasRequiredPaymentUniqueIndexes(finalIndexes)) {
    throw new Error("Payment index migration completed without the required unique index definitions");
  }
  console.log("Payment unique index migration complete.");
} finally {
  await mongoose.disconnect();
}
