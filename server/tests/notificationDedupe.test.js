import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
const user = new mongoose.Types.ObjectId();
const notifications = [];
for (const dedupeKey of [undefined, null, '', 'explicit-event-key']) {
  const row = new Notification({ user, title: 'Test', message: 'Test', dedupeKey });
  await row.validate(); notifications.push(row);
}
assert.equal(new Set(notifications.map((row) => row.dedupeKey)).size, 4);
assert.equal(notifications[3].dedupeKey, 'explicit-event-key');
for (const row of notifications) { const before = row.dedupeKey; await row.validate(); assert.equal(row.dedupeKey, before); }
console.log('notificationDedupe.test.js passed: absent/null/empty dedupe keys unique, explicit keys preserved, stable after validation.');
