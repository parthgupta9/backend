import { verifyAccessToken, verifyInitToken } from "../helpers/authHelper.js";

export const isEmailVerified = async (req, res, next) => {
  const init_token = req.cookies.init_token ?? req.headers["authorization"];
  const result = verifyInitToken(init_token);
  if (result.status !== "INIT_VALID")
    return res.status(401).send({
      success: false,
      message: result.status,
    });

  req.user = { _id: result._id };
  next();
};

export const isLoggedIn = (req, res, next) => {
  const access_token = req.cookies.access_token ?? req.headers["authorization"];
  const result = verifyAccessToken(access_token);
  if (result.status !== "ACCESS_VALID")
    return res.status(401).send({
      success: false,
      message: result.status,
    });

  req.user = { _id: result._id, role: result.role };
  next();
};

export const isSocietyAdmin = async (req, res, next) => {
  if (!req.user || req.user.role < 1)
    return res.status(401).send({
      success: false,
      message: "USER",
    });

  next();
};

export const isAppAdmin = async (req, res, next) => {
  if (!req.user || req.user.role < 2)
    return res.status(401).send({
      success: false,
      message: "USER",
    });

  next();
};
