import assert from "node:assert/strict";
import mongoose from "mongoose";
import HotelPaymentSettings from "../models/HotelPaymentSettings.js";

const restaurantId = new mongoose.Types.ObjectId();
const hotelId = new mongoose.Types.ObjectId();

await new HotelPaymentSettings({ restaurant: restaurantId, payeeName: "Legacy Restaurant", upiId: "legacy@upi" }).validate();
await new HotelPaymentSettings({ hotelId, payeeName: "Hotel Default", upiId: "hotel@upi" }).validate();
await assert.rejects(
  () => new HotelPaymentSettings({ payeeName: "Unscoped", upiId: "unscoped@upi" }).validate(),
  /restaurant/i,
);

console.log("hotelPaymentLegacyScope.test.js passed: null-hotel settings require an explicit restaurant scope.");
