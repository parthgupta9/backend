export const ORDER_STATUSES = ["PENDING", "PAID", "FULFILLED", "CANCELLED"];
export const SOCIETIES = ["NCS", "MMIL"];
export const EVENT_TYPES = ["CULTURAL", "TECHNICAL"];

export const OTP_TRIES = 3;
export const OTP_ATTEMPTS = 10;

export const OTP_EXPIRES_MIN = 5;
export const OTP_RESEND_MIN = 0.5;

export const ACCESS_TOKEN_EXPIRY = "1h";
export const REFRESH_TOKEN_EXPIRY = "5d";
export const COOKIE_EXPIRY = 7; //days

export const GSHEET_HEADERS = ["_id", "name", "email", "phone", "zeal_id"];

export const CLOUDINARY_DIRS = ["idCard", "photo", "merch"];

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "PRODUCTION",
  sameSite: "Lax",
};
