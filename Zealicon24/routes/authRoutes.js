import { Router } from "express";
import { signupController, loginController, verifyOTPController, resendOTPController, refreshAccessTokenController, signCloudinaryTokenController, sendOTPController, logoutController, getUserDetailsController } from "../controllers/authController.js";
import { reqEveryNSeconds } from "../middlewares/rateLimitterMiddleware.js";
import { isEmailVerified, isLoggedIn } from "../middlewares/authMiddleware.js";

const authRouter = Router();

authRouter.get("/get", reqEveryNSeconds(0.5), isLoggedIn, getUserDetailsController);

authRouter.post("/send-otp", reqEveryNSeconds(0.5), sendOTPController);

authRouter.post("/verify-otp", reqEveryNSeconds(0.5), verifyOTPController);

authRouter.get("/sign-cloudinary-token/:folder", isEmailVerified, signCloudinaryTokenController);

authRouter.post("/signup", reqEveryNSeconds(1), isEmailVerified, signupController);

authRouter.patch("/resend-otp", reqEveryNSeconds(2), resendOTPController);

authRouter.post("/login", reqEveryNSeconds(1), loginController);

authRouter.get("/refresh-token", reqEveryNSeconds(2), refreshAccessTokenController);

authRouter.get("/logout", reqEveryNSeconds(2), isLoggedIn, logoutController);

export { authRouter };
