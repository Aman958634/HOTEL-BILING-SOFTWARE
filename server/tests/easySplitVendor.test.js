import assert from "node:assert/strict";
import {
  assertEasySplitAvailable,
  createEasySplitVendorPayload,
  generateProviderVendorId,
  mapCashfreeVendorStatus,
  scheduleOptionFor,
} from "../services/cashfreeEasySplitService.js";
import { resolvePermissions } from "../config/rolePermissions.js";

const original = { ...process.env };
try {
  const restaurantA = "507f1f77bcf86cd799439011";
  assert.equal(generateProviderVendorId(restaurantA), generateProviderVendorId(restaurantA));
  assert.notEqual(generateProviderVendorId(restaurantA), generateProviderVendorId("507f1f77bcf86cd799439012"));
  assert.equal(scheduleOptionFor("T+2"), 2);
  assert.equal(scheduleOptionFor("weekly"), 11);

  const bankPayload = createEasySplitVendorPayload({ vendorId: generateProviderVendorId(restaurantA), restaurantName: "RestoSphere Test", email: "settlement@test.invalid", phone: "+91 9876543210", method: "BANK", settlementCycle: "T+1", accountType: "Proprietorship", pan: "ABCPV1234D", bank: { accountNumber: "026291800001191", accountHolderName: "John Doe", ifsc: "YESB0000262" } });
  assert.equal(bankPayload.schedule_option, 1);
  assert.equal(bankPayload.verify_account, true);
  assert.equal(bankPayload.bank.account_number, "026291800001191");
  assert.equal(bankPayload.upi, undefined);

  const upiPayload = createEasySplitVendorPayload({ vendorId: generateProviderVendorId(restaurantA), restaurantName: "RestoSphere Test", email: "settlement@test.invalid", phone: "9876543210", method: "UPI", settlementCycle: "MONTHLY", accountType: "Proprietorship", pan: "ABCPV1234D", upiVpa: "success@upi" });
  assert.equal(upiPayload.schedule_option, 12);
  assert.equal(upiPayload.upi.vpa, "success@upi");
  assert.equal(upiPayload.bank, undefined);
  assert.equal(mapCashfreeVendorStatus("IN_BENE_CREATION").verificationStatus, "VERIFIED");
  assert.equal(mapCashfreeVendorStatus("BANK_VALIDATION_FAILED").verificationStatus, "FAILED");
  assert.equal(mapCashfreeVendorStatus("ACTIVE").settlementStatus, "ACTIVE");
  assert.equal(resolvePermissions({ role: "cashier" }).includes("settlements.manage"), false);
  assert.equal(resolvePermissions({ role: "admin" }).includes("settlements.manage"), true);

  process.env.CASHFREE_EASY_SPLIT_ENABLED = "true";
  process.env.CASHFREE_ENV = "production";
  process.env.CASHFREE_APP_ID = "test";
  process.env.CASHFREE_SECRET_KEY = "test";
  assert.throws(() => assertEasySplitAvailable(), (error) => error?.code === "EASY_SPLIT_SANDBOX_ONLY");
  process.env.CASHFREE_ENV = "sandbox";
  assert.equal(assertEasySplitAvailable().environment, "sandbox");
  console.log("easySplitVendor.test.js passed: payloads, state mapping, and sandbox gate");
} finally {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  for (const [key, value] of Object.entries(original)) process.env[key] = value;
}
