import jwt from "jsonwebtoken";

const accessExpires =
  process.env.JWT_ACCESS_EXPIRES_IN ||
  process.env.JWT_ACCESS_EXPIRES ||
  "30m";

const refreshExpires =
  process.env.JWT_REFRESH_EXPIRES_IN ||
  process.env.JWT_REFRESH_EXPIRES ||
  "30d";

export const generateAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: accessExpires,
  });

export const generateRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: refreshExpires,
  });
