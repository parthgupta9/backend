import { Router } from "express";
import { isAppAdmin, isLoggedIn } from "../middlewares/authMiddleware.js";
import { checkoutController, createMerchController, deleteMerchController, getAllOrdersController, getMerchController, getMyOrdersController, paymentVerificationController, updateMerchController, updateOrderController } from "../controllers/merchController.js";
import { reqEveryNSeconds } from "../middlewares/rateLimitterMiddleware.js";

const merchRouter = Router();

merchRouter.post("/payment-verification", paymentVerificationController);

merchRouter.use(isLoggedIn);

merchRouter.get("/get", reqEveryNSeconds(1), getMerchController);

merchRouter.post("/checkout", reqEveryNSeconds(1), checkoutController);

merchRouter.get("/orders", reqEveryNSeconds(1), getMyOrdersController);

merchRouter.use(isAppAdmin);

merchRouter.get("/admin/orders", reqEveryNSeconds(1), getAllOrdersController);

merchRouter.patch("/admin/order-update", reqEveryNSeconds(1), updateOrderController);

merchRouter.post("/admin/create", reqEveryNSeconds(1), createMerchController);

merchRouter.patch("/admin/update", reqEveryNSeconds(1), updateMerchController);

merchRouter.delete("/admin/delete/:merch_id", reqEveryNSeconds(1), deleteMerchController);

export { merchRouter };
