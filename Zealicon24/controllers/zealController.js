import userModel from "../models/userModel.js";
import { generateOrder, generateZealId, paymentAuthenticate } from "../helpers/paymentHelper.js";
import { razorInstance } from "../server.js";
import { createHmac } from "crypto";

export const checkoutController = async (req, res) => {
  try {
    const { _id } = req.user;

    const user = await userModel.findById(_id).select("-_id verified name email phone zeal_id");

    if (!user || !user.verified)
      return res.status(404).send({
        success: false,
        message: "User not found!",
      });

    if (user.zeal_id)
      return res.status(403).send({
        success: false,
        message: "Zeal ID already exists!",
      });

    try {
      // Use enhanced generateOrder with "registration" order type and user metadata
      const order = await generateOrder(1, "registration", {
        user_id: _id.toString(),
      });

      await userModel.updateOne({ _id }, { $set: { order_id: order.id } });

      res.status(200).send({
        success: true,
        message: "Order details generated successfully!",
        order,
        userDetails: {
          email: user.email,
          phone: user.phone,
          name: user.name,
        },
      });
    } catch (orderError) {
      console.log("Order generation error:", orderError);
      res.status(500).send({
        success: false,
        message: "Failed to create payment order. Please try again later.",
      });
    }
  } catch (error) {
    console.log("Checkout error:", error);
    res.status(500).send({
      success: false,
      message: "Error while creating payment request to client!",
    });
  }
};

export const paymentVerificationController = async (req, res) => {
  try {
    const payment_info = req.body;

    // Validate required fields are present
    if (!payment_info || !payment_info.razorpay_payment_id || !payment_info.razorpay_order_id || !payment_info.razorpay_signature) {
      return res.status(400).send({
        success: false,
        message: "Missing payment information! Please provide all required payment details.",
      });
    }

    const authResult = await paymentAuthenticate(payment_info);

    if (!authResult.success) {
      // Handle different error types with specific responses
      switch (authResult.error) {
        case "INVALID_SIGNATURE":
          return res.status(400).send({
            success: false,
            message: "Payment verification failed! The payment data appears to be tampered with.",
          });

        case "USER_NOT_FOUND":
          return res.status(404).send({
            success: false,
            message: "No user found associated with this payment. Please contact support.",
          });

        case "PAYMENT_NOT_COMPLETED":
          return res.status(402).send({
            success: false,
            message: "Payment not completed! Please complete the payment process.",
          });

        case "RAZORPAY_API_ERROR":
          return res.status(502).send({
            success: false,
            message: "Unable to verify payment with the payment gateway. Please try again or contact support if payment was deducted.",
          });

        default:
          return res.status(400).send({
            success: false,
            message: "Payment authentication failed! If amount was deducted, please contact support.",
          });
      }
    }

    // Generate zeal ID after successful payment verification
    try {
      await generateZealId(authResult.userId);

      res.status(200).send({
        success: true,
        message: "Payment successful and Zeal ID generated!",
      });
    } catch (zealIdError) {
      console.log("Error generating Zeal ID:", zealIdError);
      res.status(500).send({
        success: false,
        message: "Payment was successful but we couldn't generate your Zeal ID. Please contact support.",
      });
    }
  } catch (error) {
    console.log("Payment verification error:", error);
    res.status(500).send({
      success: false,
      message: "Something went wrong during payment verification. If amount was deducted, please contact support.",
    });
  }
};

export const getZealIdController = async (req, res) => {
  try {
    const { _id } = req.user;

    const user = await userModel.findById(_id).select("-_id name id_card photo verified order_id zeal_id");

    if (!user || !user.verified) {
      return res.status(404).send({
        success: false,
        message: "User not found or not verified. Please complete your registration first.",
      });
    }

    if (!user.order_id) {
      return res.status(404).send({
        success: false,
        message: "No payment initiated. Please complete the payment process first.",
      });
    }

    // Verify payment status with Razorpay
    try {
      const order = await razorInstance.orders.fetch(user.order_id);

      if (order.status !== "paid") {
        return res.status(402).send({
          success: false,
          message: "Payment not completed. Please complete your payment to get a Zeal ID.",
          orderStatus: order.status,
        });
      }
    } catch (orderError) {
      console.log("Error fetching order:", orderError);
      return res.status(500).send({
        success: false,
        message: "Error verifying payment status. Please try again or contact support.",
      });
    }

    // Get or generate Zeal ID
    try {
      const zealId = user.zeal_id ?? (await generateZealId(_id));

      res.status(200).send({
        success: true,
        message: "Zeal ID fetched successfully!",
        zeal_id: zealId,
        userDetails: {
          name: user.name,
          id_card: user.id_card.secure_url,
          photo: user.photo.secure_url,
        },
      });
    } catch (zealIdError) {
      console.log("Error generating Zeal ID:", zealIdError);
      return res.status(500).send({
        success: false,
        message: "Error generating Zeal ID. Please try again later or contact support.",
      });
    }
  } catch (error) {
    console.log("Error in getZealIdController:", error);
    res.status(500).send({
      success: false,
      message: "Error while verifying payment. Please try again later.",
    });
  }
};

export const verifyZealIdController = async (req, res) => {
  try {
    const { zeal_id } = req.params;

    if (!zeal_id) {
      return res.status(400).send({
        success: false,
        message: "Zeal ID is missing! Please provide a valid Zeal ID.",
      });
    }

    const user = await userModel.findOne({ zeal_id }).select("-_id name email phone photo id_card order_id verified");

    if (!user || !user.verified) {
      return res.status(404).send({
        success: false,
        message: "User not found or not verified!",
      });
    }

    if (!user.order_id) {
      return res.status(403).send({
        success: false,
        message: "No payment was initiated for this user!",
      });
    }

    // Verify payment status with Razorpay
    try {
      const order = await razorInstance.orders.fetch(user.order_id);

      if (order.status !== "paid") {
        return res.status(403).send({
          success: false,
          message: "Payment not completed for this user. No valid Zeal ID exists.",
          orderStatus: order.status,
        });
      }
    } catch (orderError) {
      console.log("Error fetching order in verifyZealIdController:", orderError);
      return res.status(500).send({
        success: false,
        message: "Error verifying payment status. Please try again later.",
      });
    }

    res.status(200).send({
      success: true,
      message: "User found successfully!",
      userDetails: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        id_card: user.id_card.secure_url,
        photo: user.photo.secure_url,
      },
    });
  } catch (error) {
    console.log("Error in verifyZealIdController:", error);
    res.status(500).send({
      success: false,
      message: "Error while verifying Zeal ID! Please try again later.",
    });
  }
};

export const paymentWebhookHandler = async (req, res) => {
  try {
    // Verify webhook signature to ensure it's from Razorpay
    const webhookSignature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSignature || !webhookSecret) {
      console.log("Missing webhook signature or secret");
      return res.status(401).send({ status: "error", message: "Invalid webhook request" });
    }

    // Validate the signature
    const shasum = createHmac("sha256", webhookSecret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");

    if (digest !== webhookSignature) {
      console.log("Invalid webhook signature");
      return res.status(401).send({ status: "error", message: "Invalid webhook signature" });
    }

    // Process the webhook event
    const event = req.body.event;
    console.log(`Received Razorpay webhook: ${event}`);

    // Handle payment events
    if (event === "payment.captured" || event === "payment.authorized") {
      const paymentEntity = req.body.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const amount = paymentEntity.amount;

      // Try to fetch order details to get metadata
      try {
        const order = await razorInstance.orders.fetch(orderId);
        const orderType = order.notes?.order_type || "unknown";

        console.log(`Processing ${orderType} payment for order: ${orderId}, amount: ${amount / 100}`);

        // Process based on order type
        if (orderType === "registration") {
          // Handle Zealicon registration
          const user = await userModel.findOne({ order_id: orderId });

          if (user) {
            if (!user.zeal_id) {
              const zealId = await generateZealId(user._id);
              console.log(`Generated Zeal ID ${zealId} for user ${user._id} via webhook`);
            } else {
              console.log(`Zeal ID already exists for user ${user._id}`);
            }
          } else {
            console.log(`No user found for registration order ID: ${orderId}`);
          }
        } else if (orderType === "merchandise") {
          // Handle merchandise order
          const Order = await import("../models/orderModel.js").then((module) => module.default);
          const merchOrder = await Order.findOne({ razorpay_order_id: orderId });

          if (merchOrder) {
            merchOrder.payment_status = "paid";
            merchOrder.razorpay_payment_id = paymentId;
            await merchOrder.save();
            console.log(`Updated merchandise order ${merchOrder._id} status to paid via webhook`);
          } else {
            console.log(`No merchandise order found for order ID: ${orderId}`);
          }
        } else {
          // Fallback to the existing logic for orders without metadata
          await processPaymentWithoutMetadata(orderId, paymentId);
        }
      } catch (orderError) {
        console.log(`Error fetching order details: ${orderError}`);
        // Fallback to the existing logic if we can't get order details
        await processPaymentWithoutMetadata(orderId, paymentId);
      }
    }

    // Always acknowledge webhook receipt
    res.status(200).send({ status: "received" });
  } catch (error) {
    console.log("Error in payment webhook handler:", error);
    // Always return 200 for webhooks, even on errors
    res.status(200).send({ status: "error", message: "Error processing webhook" });
  }
};

// Helper function to process payments when metadata is not available
async function processPaymentWithoutMetadata(orderId, paymentId) {
  try {
    // First check if this is a user registration
    const user = await userModel.findOne({ order_id: orderId });

    if (user) {
      // This is a Zealicon registration payment
      if (!user.zeal_id) {
        const zealId = await generateZealId(user._id);
        console.log(`Generated Zeal ID ${zealId} for user ${user._id} via webhook (fallback)`);
      } else {
        console.log(`Zeal ID already exists for user ${user._id}`);
      }
      return;
    }

    // If not found in users, check merchandise orders
    const Order = await import("../models/orderModel.js").then((module) => module.default);
    const order = await Order.findOne({ razorpay_order_id: orderId });

    if (order) {
      // Update the order status for merchandise purchase
      order.payment_status = "paid";
      order.razorpay_payment_id = paymentId;
      await order.save();
      console.log(`Updated merchandise order ${order._id} status to paid via webhook (fallback)`);
    } else {
      console.log(`No user or order found for order ID: ${orderId}`);
    }
  } catch (error) {
    console.log(`Error in processPaymentWithoutMetadata: ${error}`);
  }
}
