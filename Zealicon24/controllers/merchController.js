import { startSession } from "mongoose";
import merchModel from "../models/merchModel.js";
import orderModel from "../models/orderModel.js";
import { generateOrder, paymentAuthenticate } from "../helpers/paymentHelper.js";
import { razorInstance } from "../server.js";
import { createObject } from "../helpers/generalHelpers.js";

export const getMerchController = async (req, res) => {
  try {
    const merch = await merchModel.find({}).select("_id title description sizes price photo");

    res.status(200).send({
      success: true,
      message: "Merch fetched successfully!",
      merch,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while getting merch!",
    });
  }
};

export const checkoutController = async (req, res) => {
  try {
    const { merch_id, size, quantity } = req.body;
    const { _id } = req.user;

    if (!merch_id)
      return res.status(400).send({
        success: false,
        message: "merch_id missing!",
      });

    if (!quantity || quantity <= 0)
      return res.status(400).send({
        success: false,
        message: "Invalid quantity!",
      });

    const merch = await merchModel.findById(merch_id).select("-_id sizes stock price");
    if (!merch)
      return res.status(404).send({
        success: false,
        message: "Merch not found!",
      });
    if(size && !merch.sizes?.includes(size))
      return res.status(400).send({
        success: false,
        message: "Size invalid!",
      });

    if (quantity > merch.stock)
      return res.status(409).send({
        success: false,
        message: "Stock not enough!",
      });

    await orderModel.deleteMany({ user_id: _id, status: "PENDING" });

    const amount = merch.price * quantity;

    const order = await generateOrder(amount, "merchandise", {
      merch_id: merch_id.toString(),
      quantity: quantity.toString(),
    });

    await orderModel.create(createObject({
      order_id: order.id,
      user_id: _id,
      merch_id,
      size,
      quantity,
      amount,
    }));

    res.status(201).send({
      success: true,
      message: "Order created successfully!",
      order,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while creating order!",
    });
  }
};

export const paymentVerificationController = async (req, res) => {
  const session = await startSession();
  try {
    const payment_info = req.body;

    if (!paymentAuthenticate("MERCH", payment_info))
      return res.status(400).send({
        success: false,
        message: "Payment authentication failed",
      });

    const order = await orderModel.findOne({ order_id: payment_info.razorpay_order_id }).select("_id status purchasedAt merch_id quantity");
    if (!order)
      return res.status(404).send({
        success: false,
        message: "Order not found!",
      });

    const merch = await merchModel.findById(order.merch_id);
    if (!merch || merch.stock < order.quantity)
      return res.status(409).send({
        success: false,
        message: "Merch unavailable or stock too low!",
      });

    session.startTransaction();

    merch.stock -= order.quantity;
    await merch.save({ session });

    order.status = "PAID";
    order.purchasedAt = new Date();
    await order.save({ session });

    await session.commitTransaction();

    res.status(200).send({
      success: true,
      message: "Payment verified and order confirmed!",
    });
    await session.endSession();
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while verifying merch payment!",
    });
    await session.abortTransaction();
    await session.endSession();
  }
};

export const getMyOrdersController = async (req, res) => {
  try {
    const { _id } = req.user;

    const orders = await orderModel.find({ user_id: _id }).select("_id order_id size quantity amount status purchasedAt merch_id").populate("merch_id", "title description price").sort({ purchasedAt: -1 });

    const unpaidOrderIds = (
      await Promise.all(
        orders.map(async (order) => {
          const razorpayOrder = await razorInstance.orders.fetch(order.order_id);
          if (razorpayOrder.status === "paid" && order.status === "PENDING") {
            order.status = "PAID";
            order.purchasedAt = new Date(razorpayOrder.created_at * 1000);
            await order.save();
          } else if (razorpayOrder.status !== "paid") {
            return order.order_id;
          }
          return null;
        }),
      )
    ).filter(Boolean);

    await orderModel.deleteMany({ order_id: { $in: unpaidOrderIds } });

    const flatOrders = orders
      .filter((order) => !unpaidOrderIds.includes(order.order_id))
      .map((order) => ({
        order_id: order.order_id,
        size:order.size,
        quantity: order.quantity,
        amount: order.amount,
        status: order.status,
        purchasedAt: order.purchasedAt,
        ...order.merch_id._doc,
      }));
    res.status(200).send({
      success: true,
      message: "Orders fetched successfully!",
      orders: flatOrders,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while fetching orders!",
    });
  }
};

export const getAllOrdersController = async (req, res) => {
  try {
    const orders = await orderModel.find({}).populate("user_id", "_id name email").populate("merch_id", "-_id title").sort({ status: 1, "merch_id.title": 1, "user_id.name": 1 });

    const flatOrders = orders.map((order) => ({
      order_id: order.order_id,
      size: order.size,
      quantity: order.quantity,
      amount: order.amount,
      status: order.status,
      purchasedAt: order.purchasedAt,
      ...order.merch_id?._doc,
      ...order.user_id?._doc,
    }));
    res.status(200).send({
      success: true,
      message: "All orders fetched",
      orders: flatOrders,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while fetching orders!",
    });
  }
};

export const updateOrderController = async (req, res) => {
  try {
    const { order_id, status } = req.body;

    if (!order_id)
      return res.status(400).send({
        success: false,
        message: "Order ID missing!",
      });

    if (!status || !["FULFILLED", "CANCELLED"].includes(status))
      return res.status(400).send({
        success: false,
        message: "Invalid status!",
      });

    const orderRes = await orderModel.updateOne({ _id: order_id, status: "PAID" }, { $set: { status } }, { runValidators: true });

    if (orderRes.matchedCount === 0)
      return res.status(404).send({
        success: false,
        message: "Order not found!",
      });

    res.status(200).send({
      success: true,
      message: "Order status updated successfully!",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while updating order status!",
    });
  }
};

export const createMerchController = async (req, res) => {
  try {
    let merchArray = req.body;

    if (!Array.isArray(merchArray)) merchArray = [merchArray];

    await merchModel.create(merchArray);

    res.status(201).send({
      success: true,
      message: "Merch created successfully!",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while creating merch!",
    });
  }
};

export const updateMerchController = async (req, res) => {
  try {
    const { merch_id, title, sizes, description, photo, price, stock } = req.body;

    const merchRes = await merchModel.updateOne({ _id: merch_id }, { $set: createObject({ title, description, sizes, photo, price, stock }) }, { runValidators: true });
    if (!merchRes.matchedCount)
      return res.status(404).send({
        success: false,
        message: "Error while updating merch!",
      });

    res.status(200).send({
      success: true,
      message: "Merch updated successfully!",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while updating merch!",
    });
  }
};

export const deleteMerchController = async (req, res) => {
  try {
    const { merch_id } = req.params;

    const merchRes = await merchModel.deleteOne({ _id: merch_id });
    if (!merchRes.matchedCount)
      return res.status(404).send({
        success: false,
        message: "Error while deleting merch!",
      });

    res.status(200).send({
      success: false,
      message: "Merch deleted successfully!",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while deleting merch!",
    });
  }
};
