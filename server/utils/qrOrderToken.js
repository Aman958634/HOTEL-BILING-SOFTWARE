import crypto from "crypto";
import ApiError from "./ApiError.js";

const secret = () => process.env.QR_ORDER_SECRET || process.env.JWT_ACCESS_SECRET || "";

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

export const createQrOrderToken = ({ tableId, restaurantId }) => {
  const signingSecret = secret();
  if (!signingSecret) throw new ApiError(500, "QR ordering is not configured");

  const payload = encode({ tableId: String(tableId), restaurantId: String(restaurantId), v: 1 });
  const signature = crypto.createHmac("sha256", signingSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
};

export const verifyQrOrderToken = (token) => {
  const signingSecret = secret();
  const [payload, signature] = String(token || "").split(".");
  if (!signingSecret || !payload || !signature) throw new ApiError(403, "A valid QR table token is required");

  const expected = crypto.createHmac("sha256", signingSecret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new ApiError(403, "QR table token is invalid");
  }

  try {
    const context = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!context.tableId || !context.restaurantId || context.v !== 1) throw new Error("Invalid context");
    return context;
  } catch (_error) {
    throw new ApiError(403, "QR table token is invalid");
  }
};
