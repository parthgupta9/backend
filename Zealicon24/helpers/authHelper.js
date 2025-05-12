import JWT from "jsonwebtoken";
import userModel from "../models/userModel.js";
import { ACCESS_TOKEN_EXPIRY, COOKIE_EXPIRY, OTP_EXPIRES_MIN, OTP_RESEND_MIN, REFRESH_TOKEN_EXPIRY, OTP_TRIES, OTP_ATTEMPTS, COOKIE_OPTIONS } from "../config/appConfig.js";
import { sendMail } from "../config/mailConfig.js";
import { decryptData, encryptData, generateRandomNDigits } from "./generalHelpers.js";

export const sendOTP = async (res, email, prev_otp) => {
  const currentTime = Date.now();

  let newExpirationTime = currentTime + OTP_EXPIRES_MIN * 60000; //minutes
  let newTries = OTP_TRIES;
  let newAttempts = OTP_ATTEMPTS;

  let otp_value = generateRandomNDigits(6);

  //if old otp has not expired resend it
  if (prev_otp && prev_otp.expiration && prev_otp.value) {
    if (prev_otp.tries <= 0 || prev_otp.attempts <= 0)
      return res.status(403).send({
        success: false,
        message: "Too many attempts!",
      });
    const otpExpirationTime = new Date(prev_otp.expiration).getTime();
    const resendOTPAfter = otpExpirationTime - (OTP_EXPIRES_MIN - OTP_RESEND_MIN) * 60000; //minutes
    if (currentTime < resendOTPAfter)
      return res.status(429).send({
        success: false,
        message: "Too many requests!",
      });
    if (currentTime < otpExpirationTime) {
      otp_value = decryptData(prev_otp.value);
      newExpirationTime = prev_otp.expiration;
    } else newTries--;
    newAttempts = prev_otp.attempts;
  }

  await userModel.updateOne(
    { email },
    {
      $set: {
        otp: {
          value: encryptData(otp_value),
          expiration: newExpirationTime,
          tries: newTries,
          attempts: newAttempts,
        },
      },
    },
    { runValidators: true },
  );

  const mailSent = await sendMail(email, otp_value);
  if (!mailSent.success) throw new Error("Error while sending mail!");

  res.status(200).send({
    success: true,
    message: "OTP sent successfully.",
  });
};

export const verifyOTP = async (email, otp) => {
  try {
    const user = await userModel
      .findOne({
        email,
        "otp.expiration": { $gt: Date.now() },
      })
      .select("_id otp verified role");

    if (!user) return { result: "INVALID", _id: null, role: null };
    if (user.otp.attempts <= 0) {
      return { result: "EXHAUSTED", _id: null, role: null };
    }
    if (otp != decryptData(user.otp.value)) {
      await userModel.updateOne(
        { _id: user._id },
        {
          $inc: { "otp.attempts": -1 },
        },
        { runValidators: true },
      );
      return { result: "INVALID", _id: null, role: null };
    }

    await userModel.updateOne(
      { _id: user._id },
      {
        $set: { verified: true, otp: { expiration: Date.now(), tries: OTP_TRIES, attempts: OTP_ATTEMPTS } },
      },
      { runValidators: true },
    );
    if (!user.verified) return { result: "VERIFIED", _id: user._id, role: user.role };
    return { result: "VALID", _id: user._id, role: user.role };
  } catch (error) {
    console.log(error);
    return { result: "INVALID", _id: null, role: null };
  }
};

export const sendInitToken = (res, user_id) => {
  const initToken = JWT.sign({ _id: user_id }, process.env.INIT_TOKEN_SECRET);
  res.cookie("init_token", initToken, {
    ...COOKIE_OPTIONS,
    maxAge: COOKIE_EXPIRY * 86400000, //days
  });
  return initToken;
};

export const verifyInitToken = (initToken) => {
  try {
    if (!initToken) return { status: "INIT_MISSING", _id: null };

    const { _id } = JWT.verify(initToken, process.env.INIT_TOKEN_SECRET);
    return { status: "INIT_VALID", _id };
  } catch (error) {
    if (error.name === "TokenExpiredError") return { status: "INIT_EXPIRED", _id: null };
    else return { status: "INIT_INVALID", _id: null };
  }
};

export const generateAccessAndRefreshToken = async (user_id, role) => {
  const accessToken = JWT.sign({ _id: user_id, role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = JWT.sign({ _id: user_id, role }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  await userModel.updateOne({ _id: user_id }, { refresh_token: refreshToken }, { runValidators: true });

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (accessToken) => {
  try {
    if (!accessToken) return { status: "ACCESS_MISSING", _id: null, role: 0 };

    const { _id, role } = JWT.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    return { status: "ACCESS_VALID", _id, role };
  } catch (error) {
    if (error.name === "TokenExpiredError") return { status: "ACCESS_EXPIRED", _id: null, role: 0 };
    else return { status: "ACCESS_INVALID", _id: null, role: 0 };
  }
};

export const refreshAccessToken = async (refreshToken) => {
  try {
    const { _id, role } = JWT.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await userModel.findOne({ _id, refresh_token: refreshToken }).select("-_id role");

    if (!user) return { status: "INVALID", accessToken: null };

    return {
      status: "VALID",
      accessToken: JWT.sign({ _id, role: user.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY }),
    };
  } catch (error) {
    if (error.name === "TokenExpiredError") return { status: "EXPIRED", accessToken: null };
    else if (error.name === "JsonWebTokenError") return { status: "INVALID", accessToken: null };
    else throw error;
  }
};

export const setAuthCookies = (res, accessToken, refreshToken) => {
  const options = {
    ...COOKIE_OPTIONS,
    maxAge: COOKIE_EXPIRY * 86400000, //days
  };
  if (accessToken) res.cookie("access_token", accessToken, options);
  if (refreshToken) res.cookie("refresh_token", refreshToken, options);
};
