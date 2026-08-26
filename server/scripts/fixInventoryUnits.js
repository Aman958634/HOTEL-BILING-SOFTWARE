/**
 * Migration script to fix inventory items with combined unit values (e.g., "10kg" → "kg")
 * This script separates numbers from unit fields and normalizes all inventory unit data.
 * 
 * Run with: node server/scripts/fixInventoryUnits.js
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import Inventory from "../models/Inventory.js";

dotenv.config();

async function fixInventoryUnits() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✓ Connected to MongoDB");

    const allItems = await Inventory.find({});
    console.log(`\nFound ${allItems.length} inventory items to check...\n`);

    let fixed = 0;
    let errors = 0;

    for (const item of allItems) {
      let needsUpdate = false;
      const update = {};

      // Fix unit field
      if (item.unit) {
        const unit = String(item.unit).trim();
        
        // Check if unit contains numbers (e.g., "10kg", "2.5ml")
        if (/\d/.test(unit)) {
          console.log(`  ⚠️  BEFORE: ${item.itemName} (${item.sku})`);
          console.log(`      unit: "${unit}" → extracting pure unit...`);
          
          // Extract unit part (last letters after numbers)
          const extracted = unit.replace(/^\d+\.?\d*\s*/, "").toLowerCase().trim();
          
          if (extracted) {
            update.unit = extracted;
            console.log(`      unit: "${unit}" → "${extracted}"`);
            needsUpdate = true;
          } else {
            console.log(`      ⚠️  Could not extract unit from "${unit}", keeping "kg" as default`);
            update.unit = "kg";
            needsUpdate = true;
          }
        } else {
          // Normalize to lowercase
          const normalized = unit.toLowerCase();
          if (normalized !== unit) {
            update.unit = normalized;
            needsUpdate = true;
          }
        }
      }

      // Fix baseUnit field
      if (item.baseUnit) {
        const baseUnit = String(item.baseUnit).trim();
        
        // Check if baseUnit contains numbers
        if (/\d/.test(baseUnit)) {
          console.log(`  ⚠️  BEFORE: ${item.itemName} (${item.sku})`);
          console.log(`      baseUnit: "${baseUnit}" → extracting pure unit...`);
          
          // Extract unit part (last letters after numbers)
          const extracted = baseUnit.replace(/^\d+\.?\d*\s*/, "").toLowerCase().trim();
          
          if (extracted) {
            update.baseUnit = extracted;
            console.log(`      baseUnit: "${baseUnit}" → "${extracted}"`);
            needsUpdate = true;
          } else {
            console.log(`      ⚠️  Could not extract baseUnit from "${baseUnit}", setting to unit or "kg"`);
            update.baseUnit = update.unit || item.unit || "kg";
            needsUpdate = true;
          }
        } else {
          // Normalize to lowercase
          const normalized = baseUnit.toLowerCase();
          if (normalized !== baseUnit) {
            update.baseUnit = normalized;
            needsUpdate = true;
          }
        }
      } else if (!item.baseUnit) {
        // Set default baseUnit if not present
        update.baseUnit = update.unit || item.unit || "kg";
        needsUpdate = true;
      }

      // Apply updates
      if (needsUpdate) {
        try {
          await Inventory.updateOne({ _id: item._id }, { $set: update });
          console.log(`      ✓ Updated: ${item.itemName}\n`);
          fixed++;
        } catch (err) {
          console.error(`      ✗ Error updating: ${err.message}\n`);
          errors++;
        }
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`Summary:`);
    console.log(`  Total items: ${allItems.length}`);
    console.log(`  Fixed: ${fixed}`);
    console.log(`  Errors: ${errors}`);
    console.log("=".repeat(60) + "\n");

    // Verify results
    const fixedItems = await Inventory.find({
      $or: [
        { unit: { $regex: /\d/ } },
        { baseUnit: { $regex: /\d/ } }
      ]
    });

    if (fixedItems.length > 0) {
      console.log("⚠️  WARNING: Found items still with numbers in unit fields:");
      fixedItems.forEach((item) => {
        console.log(`   ${item.itemName}: unit="${item.unit}", baseUnit="${item.baseUnit}"`);
      });
    } else {
      console.log("✓ All inventory items have valid unit fields (no numbers)");
    }

    console.log("\nMigration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

fixInventoryUnits();
