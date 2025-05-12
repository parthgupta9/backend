import { Router } from "express";
import { checkoutController, getZealIdController, paymentVerificationController, verifyZealIdController, paymentWebhookHandler } from "../controllers/zealController.js";
import { isLoggedIn } from "../middlewares/authMiddleware.js";
import { reqEveryNSeconds } from "../middlewares/rateLimitterMiddleware.js";

const zealRouter = Router();

// Payment webhook doesnt need auth called by Razorpay
zealRouter.post("/payment-webhook", paymentWebhookHandler);
// Payment verification doesn't need authentication as users might not be logged in during payment callback
zealRouter.post("/payment-verification", paymentVerificationController);

zealRouter.use(isLoggedIn);

zealRouter.post("/checkout", reqEveryNSeconds(2), checkoutController);

zealRouter.get("/get-zeal-id", reqEveryNSeconds(0.25), getZealIdController);

zealRouter.get("/verify-zeal-id/:zeal_id", reqEveryNSeconds(1), verifyZealIdController);

export { zealRouter };
