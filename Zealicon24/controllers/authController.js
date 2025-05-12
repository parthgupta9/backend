import userModel from "../models/userModel.js";
import { v2 as cloudinary } from "cloudinary";
import { generateAccessAndRefreshToken, sendOTP, refreshAccessToken, setAuthCookies, verifyOTP, sendInitToken } from "../helpers/authHelper.js";
import { CLOUDINARY_DIRS, COOKIE_OPTIONS } from "../config/appConfig.js";

export const getUserDetailsController = async (req, res) => {
  const { _id } = req.user;

  const user = await userModel.findById(_id).select("-_id name phone verified email photo id_card zeal_id").lean();
  if (!user || !user.verified)
    return res.status(400).send({
      success: false,
      message: "User not found!",
    });
  res.status(200).send({
    success: true,
    message: "User details fetched successfully!",
    user: {
      ...user,
      id_card: user.id_card.secure_url,
      photo: user.photo.secure_url,
    },
  });
};

export const sendOTPController = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).send({ success: false, message: "Email missing!" });

    let userExists = await userModel.findOne({ email }).select("-_id verified otp");
    if (userExists && userExists.verified)
      return res.status(409).send({
        success: false,
        message: "User already exists,please login instead!",
      });

    if (!userExists) userExists = await userModel.create({ email });

    await sendOTP(res, email, userExists.otp);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while verifying email!",
    });
  }
};

export const signCloudinaryTokenController = async (req, res) => {
  try {
    const { folder } = req.params;
    if (!folder || !CLOUDINARY_DIRS.includes(folder))
      return res.status(400).send({
        success: false,
        message: "folder missing or invalid",
      });

    const currentTime = Date.now();

    const options = {
      timestamp: Math.round(currentTime / 1000),
      folder,
      public_id: currentTime,
    };
    const token = cloudinary.utils.api_sign_request(options, process.env.CLOUDINARY_API_SECRET);
    res.status(200).send({
      success: true,
      message: "Cloudinary token created successfully!",
      ...options,
      token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while generating cloudinary signature!",
    });
  }
};

export const signupController = async (req, res) => {
  try {
    const { _id } = req.user;
    const { name, phone, id_card, photo } = req.body;
    if (!name) return res.status(400).send({ success: false, message: "name missing!" });
    if (!+phone && phone.toString().length !== 10) return res.status(400).send({ success: false, message: "phone number missing!" });

    if (!id_card?.secure_url || !id_card?.public_id || Object.keys(id_card).length !== 2) return res.status(400).send({ success: false, message: "id card image missing!" });
    if (!id_card.secure_url.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}`) || !id_card.public_id.startsWith(CLOUDINARY_DIRS[0])) return res.status(400).send({ success: false, message: "id card image invalid!" });

    if (!photo?.secure_url || !photo?.public_id || Object.keys(id_card).length !== 2) return res.status(400).send({ success: false, message: "photo missing!" });
    if (!photo.secure_url.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}`) || !photo.public_id.startsWith(CLOUDINARY_DIRS[1])) return res.status(400).send({ success: false, message: "photo invalid!" });

    const userResult = await userModel.updateOne(
      { _id, verified: true },
      {
        name,
        phone: +phone,
        id_card: {
          secure_url: id_card.secure_url,
          public_id: id_card.public_id,
        },
        photo: {
          secure_url: photo.secure_url,
          public_id: photo.public_id,
        },
      },
      { runValidators: true },
    );

    if (!userResult.matchedCount)
      return res.status(403).send({
        success: false,
        message: "Email verification pending!",
      });

    if (req.cookies.init_token) res.clearCookie("init_token", COOKIE_OPTIONS);

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(_id, 0);

    setAuthCookies(res, accessToken, refreshToken);

    res.status(200).send({
      success: true,
      message: "User signed up successfully!",
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while signing up user!",
    });
  }
};

export const verifyOTPController = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!otp) return res.status(400).send({ success: false, message: "OTP missing!" });

    if (!email)
      return res.status(400).send({
        success: false,
        message: "Email missing!",
      });

    const user = await verifyOTP(email, otp);
    if (user.result === "VERIFIED") {
      const initToken = sendInitToken(res, user._id);
      return res.status(200).send({
        success: true,
        message: "Email verified successfully!",
        init_token: initToken,
      });
    }

    if (user.result !== "VALID")
      return res.status(403).send({
        success: false,
        message: user.result === "INVALID" ? "Otp invalid!" : "Attempts exhausted! Contact support.",
      });

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id.toString(), user.role);

    setAuthCookies(res, accessToken, refreshToken);

    res.status(200).send({
      success: true,
      message: "Verified successfully!",
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while verifying user Otp!",
    });
  }
};

export const resendOTPController = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).send({
        success: false,
        message: "Email missing!",
      });

    const userExists = await userModel.findOne({ email }).select("-_id otp");
    if (!userExists)
      return res.status(404).send({
        success: false,
        message: "Email not found!",
      });

    await sendOTP(res, email, userExists.otp);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while sending Otp!",
    });
  }
};

export const loginController = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).send({
        success: false,
        message: "email missing!",
      });

    const userExists = await userModel.findOne({ email, verified: true, name: { $exists: true, $ne: null } }).select("-_id otp");
    if (!userExists)
      return res.status(404).send({
        success: false,
        message: "User not found!",
      });

    await sendOTP(res, email, userExists.otp);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while generating login otp!",
    });
  }
};

export const refreshAccessTokenController = async (req, res) => {
  try {
    const refresh_token = req.cookies.refresh_token ?? req.headers["authorization"];
    if (!refresh_token)
      return res.status(400).send({
        success: false,
        message: "token cookies missing!",
      });

    const result = await refreshAccessToken(refresh_token);
    if (result.status !== "VALID")
      return res.status(401).send({
        success: false,
        message: result.status,
      });

    setAuthCookies(res, result.accessToken, null);

    res.status(200).send({
      success: true,
      message: "Access token refreshed successfully!",
      access_token: result.accessToken,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while generating login otp!",
    });
  }
};

export const logoutController = async (req, res) => {
  try {
    const { _id } = req.user;

    await userModel.updateOne({ _id }, { $set: { refresh_token: null } });

    if (req.cookies.access_token) res.clearCookie("access_token", COOKIE_OPTIONS);
    if (req.cookies.refresh_token) res.clearCookie("refresh_token", COOKIE_OPTIONS);

    res.status(200).send({
      success: true,
      message: "Logged out successfully!",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while logging out!",
    });
  }
};
