import limitter from "express-rate-limit";

export const reqEveryNSeconds = (count) => {
  return limitter({
    window: Math.floor(5000 * count),
    max: 5,
    message: { success: false, message: "Too many requests" },
  });
};
