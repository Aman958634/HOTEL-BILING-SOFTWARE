import dotenv from "dotenv";
import mongoose from "mongoose";
import CentralKitchen from "../models/CentralKitchen.js";
import CentralKitchenRequisition from "../models/CentralKitchenRequisition.js";
import ProductionBatch from "../models/ProductionBatch.js";
import CentralKitchenTransfer from "../models/CentralKitchenTransfer.js";
import Inventory from "../models/Inventory.js";
import StockMovement from "../models/StockMovement.js";
import Recipe from "../models/Recipe.js";

dotenv.config();
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");
await mongoose.connect(uri);
try {
  await Promise.all([CentralKitchen.syncIndexes(), CentralKitchenRequisition.syncIndexes(), ProductionBatch.syncIndexes(), CentralKitchenTransfer.syncIndexes(), Inventory.syncIndexes(), StockMovement.syncIndexes(), Recipe.syncIndexes()]);
  console.log("Central Kitchen indexes created successfully. No stock backfill is required.");
} finally {
  await mongoose.disconnect();
}
