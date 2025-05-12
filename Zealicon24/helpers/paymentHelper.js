import { createHmac } from "crypto";
import { razorInstance } from "../server.js";
import userModel from "../models/userModel.js";
import orderModel from "../models/orderModel.js";
import { zealId } from "./generalHelpers.js";

export const paymentAuthenticate = async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  try {
    // Check if all required parameters are present
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.log("Payment authentication failed: Missing required parameters");
      return { success: false, error: "MISSING_PARAMS", message: "Missing payment parameters" };
    }

    // Verify signature
    const testString = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = createHmac("sha256", process.env.RAZORPAY_API_SECRET).update(testString.toString()).digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.log("Payment authentication failed: Invalid signature");
      return { success: false, error: "INVALID_SIGNATURE", message: "Payment signature verification failed" };
    }

    // Verify if order exists for a user
    const user = await userModel.exists({ order_id: razorpay_order_id });
    if (!user) {
      console.log(`Payment authentication failed: No user found with order_id ${razorpay_order_id}`);
      return { success: false, error: "USER_NOT_FOUND", message: "No user associated with this payment" };
    }

    // Verify payment status with Razorpay
    try {
      const payment = await razorInstance.payments.fetch(razorpay_payment_id);
      if (payment.status !== "captured" && payment.status !== "authorized") {
        console.log(`Payment verification failed: Payment status is ${payment.status}`);
        return { success: false, error: "PAYMENT_NOT_COMPLETED", message: `Payment not completed, status: ${payment.status}` };
      }
    } catch (error) {
      console.log("Error verifying payment with Razorpay:", error);
      return { success: false, error: "RAZORPAY_API_ERROR", message: "Error verifying payment with Razorpay" };
    }

    return { success: true, userId: user._id.toString() };
  } catch (error) {
    console.log("Unexpected error in payment authentication:", error);
    return { success: false, error: "UNKNOWN_ERROR", message: "Unexpected error during payment authentication" };
  }
};

export const generateZealId = async (user_id) => {
  const zeal_id = `Zeal_ID-${zealId()}`;
  await userModel.updateOne({ _id: user_id }, { $set: { zeal_id } }, { runValidators: true });
  return zeal_id;
};

export const generateOrder = async (amount, orderType = "registration", metadata = {}) => {
  return await razorInstance.orders.create({
    currency: "INR",
    amount: amount * 100,
    notes: {
      order_type: orderType, // "registration" or "merchandise"
      ...metadata, // Any additional metadata
    },
  });
};

export const processPayment = async (orderId, orderType) => {
  const finalOrderType = ["MERCH", "ZEAL"].includes(orderType) ? orderType : "UNKNOWN";
  if (["ZEAL", "UNKNOWN"].includes(finalOrderType)) {
    const user = await userModel.exists({ order_id: orderId });
    if (user) {
      await generateZealId(user._id);
      return true;
    }
  }
  if (["MERCH", "UNKNOWN"].includes(finalOrderType)) {
    const orderResult = await orderModel.updateOne({ order_id: orderId }, { status: "PAID" });
    return 0 != orderResult.matchedCount;
  }
  return false;
};
