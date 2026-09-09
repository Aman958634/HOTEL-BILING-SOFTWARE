import assert from "node:assert/strict";
import mongoose from "mongoose";
import { requireSafeTestDatabase } from "./testDatabase.js";
import RestaurantSettlementProfile from "../models/RestaurantSettlementProfile.js";

const REQUIRED_URI = "mongodb://127.0.0.1:27027/restosphere_cashfree_test?replicaSet=rsCashfreeTest";
assert.equal(String(process.env.TEST_MONGO_URI || "").trim(), REQUIRED_URI, "Easy Split database test must use the isolated Cashfree test database");
const { uri } = requireSafeTestDatabase();
const restaurantA = new mongoose.Types.ObjectId();
const restaurantB = new mongoose.Types.ObjectId();

try {
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  await RestaurantSettlementProfile.deleteMany({ restaurant: { $in: [restaurantA, restaurantB] } });
  await RestaurantSettlementProfile.create([
    { restaurant: restaurantA, provider: "CASHFREE", providerVendorId: `RESTO_TEST_${restaurantA.toString().slice(-8)}`, payoutMethod: "BANK", vendorStatus: "IN_BENE_CREATION", providerStatus: "IN_BENE_CREATION", bankVerificationStatus: "VERIFIED", settlementStatus: "PENDING", maskedAccountNumber: "••••1191", ifscSafeValue: "YESB0000262" },
    { restaurant: restaurantB, provider: "CASHFREE", providerVendorId: `RESTO_TEST_${restaurantB.toString().slice(-8)}`, payoutMethod: "UPI", vendorStatus: "IN_BANK_VALIDATION", providerStatus: "IN_BANK_VALIDATION", bankVerificationStatus: "PENDING", settlementStatus: "PENDING", maskedUpiVpa: "su••••@upi" },
  ]);
  const aProfile = await RestaurantSettlementProfile.findOne({ restaurant: restaurantA, provider: "CASHFREE" }).lean();
  const bProfile = await RestaurantSettlementProfile.findOne({ restaurant: restaurantB, provider: "CASHFREE" }).lean();
  assert.equal(aProfile.maskedAccountNumber, "••••1191");
  assert.equal(aProfile.accountNumber, undefined);
  assert.equal(bProfile.maskedUpiVpa, "su••••@upi");
  assert.notEqual(String(aProfile.restaurant), String(bProfile.restaurant));
  assert.equal(await RestaurantSettlementProfile.countDocuments({ restaurant: restaurantA }), 1);
  console.log("easySplitVendorDb.test.js passed: isolated DB, tenant scope, and masked payout data");
} finally {
  if (mongoose.connection.readyState === 1) {
    await RestaurantSettlementProfile.deleteMany({ restaurant: { $in: [restaurantA, restaurantB] } });
    await mongoose.disconnect();
  }
}
