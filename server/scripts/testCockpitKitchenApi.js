import dotenv from "dotenv";
dotenv.config();

const base = process.env.API_URL || "http://localhost:5002/api/v1";

const loginRes = await fetch(`${base}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@test.com", password: "Admin@123" }),
});
const loginJson = await loginRes.json();
console.log("login", loginRes.status, loginJson.success, loginJson.message);

const token = loginJson.data?.accessToken;
if (!token) process.exit(1);

const cockpitRes = await fetch(`${base}/cockpit`, {
  headers: { Authorization: `Bearer ${token}` },
});
const cockpitJson = await cockpitRes.json();
console.log(
  "cockpit",
  cockpitRes.status,
  "orders",
  cockpitJson.data?.orders?.items?.length,
  "summary",
  cockpitJson.data?.orders?.summary
);

const kitchenRes = await fetch(`${base}/kitchen/tickets?limit=200`, {
  headers: { Authorization: `Bearer ${token}` },
});
const kitchenJson = await kitchenRes.json();
console.log(
  "kitchen",
  kitchenRes.status,
  "tickets",
  Array.isArray(kitchenJson.data) ? kitchenJson.data.length : kitchenJson.data
);
