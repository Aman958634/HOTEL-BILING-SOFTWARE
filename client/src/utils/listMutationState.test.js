import assert from "node:assert/strict";
import test from "node:test";
import { getListRequestState, prependListRecord, removeListRecord, replaceListRecord } from "./listMutationState.js";

const rows = [{ _id: "a", name: "Alpha" }, { _id: "b", name: "Beta" }];

test("only an initial list request shows the primary skeleton", () => {
  assert.deepEqual(getListRequestState(false), { initialLoading: true, isRefreshing: false });
  assert.deepEqual(getListRequestState(true), { initialLoading: false, isRefreshing: true });
});

test("delete removes only the confirmed record and preserves the other rows", () => {
  assert.deepEqual(removeListRecord(rows, "b"), [{ _id: "a", name: "Alpha" }]);
});

test("update replaces only the confirmed record", () => {
  assert.deepEqual(replaceListRecord(rows, { _id: "b", name: "Updated" }), [
    { _id: "a", name: "Alpha" },
    { _id: "b", name: "Updated" },
  ]);
});

test("create prepends a confirmed record without discarding the current list", () => {
  assert.deepEqual(prependListRecord(rows, { _id: "c", name: "Created" }), [
    { _id: "c", name: "Created" },
    ...rows,
  ]);
});
