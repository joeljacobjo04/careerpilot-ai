import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { asyncHandler, HttpError } from "./error.js";

export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || "7d",
  });

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Not signed in");
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, "Session expired, please sign in again");
  }
  const user = await User.findById(payload.id).select("-passwordHash");
  if (!user) throw new HttpError(401, "Account no longer exists");
  // a password reset by email signs out every older session (jwt iat is in seconds)
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
    throw new HttpError(401, "Your password was changed, please sign in again");
  }
  req.user = user;
  next();
});

// Server-side role check. Frontend route guards are not security.
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new HttpError(403, "You do not have access to this resource"));
  }
  next();
};
