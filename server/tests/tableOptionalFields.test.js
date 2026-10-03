import test from "node:test";
import assert from "node:assert/strict";
import Table from "../models/Table.js";

test("a table validates with only its required table number and Non AC section", async () => {
  const table = new Table({ tableNumber: "T-optional", section: "Non AC" });
  await table.validate();
  assert.equal(table.capacity, undefined);
  assert.equal(table.floor, undefined);
  assert.equal(table.shape, undefined);
  assert.equal(table.section, "Non AC");
});

test("existing optional table fields remain valid and shape normalization is preserved", async () => {
  const table = new Table({ tableNumber: "T-existing", section: "Main Hall", capacity: 4, floor: "Ground Floor", shape: "round", description: "Window table" });
  await table.validate();
  assert.equal(table.capacity, 4);
  assert.equal(table.floor, "Ground Floor");
  assert.equal(table.shape, "ROUND");
});

test("a supplied non-positive capacity remains invalid", async () => {
  const table = new Table({ tableNumber: "T-invalid", section: "Main Hall", capacity: 0 });
  await assert.rejects(table.validate(), /capacity/i);
});

test("an existing table can clear optional capacity, floor, and shape", async () => {
  const table = new Table({ tableNumber: "T-clear", section: "AC Hall", capacity: 6, floor: "First Floor", shape: "SQUARE" });
  Object.assign(table, { capacity: undefined, floor: undefined, shape: undefined });
  await table.validate();
  assert.equal(table.capacity, undefined);
  assert.equal(table.floor, undefined);
  assert.equal(table.shape, undefined);
});
