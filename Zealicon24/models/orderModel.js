import { Schema, model } from "mongoose";
import { ORDER_STATUSES } from "../config/appConfig.js";

const orderSchema = new Schema({
  order_id: {
    type: String,
    required: true,
    unique: true,
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  merch_id: {
    type: Schema.Types.ObjectId,
    ref: "merch",
    required: true,
  },
  size: {
    type: String,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ORDER_STATUSES,
    default: "PENDING",
  },
  purchasedAt: {
    type: Date,
  },
});

export default model("order", orderSchema, "orders");
