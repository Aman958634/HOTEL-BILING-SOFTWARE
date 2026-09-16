import "dotenv/config";
import connectDB from "../config/db.js";
import Order from "../models/Order.js";
import Invoice from "../models/Invoice.js";
import Table from "../models/Table.js";
import Reservation from "../models/Reservation.js";
import mongoose from "mongoose";

// Additive only: never drops or rebuilds existing production indexes.
await connectDB();
await Promise.all([
  Order.collection.createIndex({ restaurant: 1, outlet: 1, paymentStatus: 1, paidAt: -1 }, { name: "restaurant_outlet_paymentStatus_paidAt" }),
  Invoice.collection.createIndex({ order: 1, issuedAt: -1 }, { name: "order_issuedAt" }),
  Table.collection.createIndex({ restaurant: 1, outlet: 1, status: 1 }, { name: "restaurant_outlet_status" }),
  Reservation.collection.createIndex({ restaurant: 1, outlet: 1, status: 1 }, { name: "restaurant_outlet_status" }),
]);
console.log("Performance indexes ensured.");
await mongoose.disconnect();
