import { Schema, model } from "mongoose";

const userSchema = new Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: Number,
  },
  id_card: {
    public_id: {
      type: String,
    },
    secure_url: {
      type: String,
    },
  },
  photo: {
    public_id: {
      type: String,
    },
    secure_url: {
      type: String,
    },
  },
  verified: {
    type: Boolean,
    default: false,
  },
  otp: {
    value: {
      type: String,
    },
    expiration: {
      type: Date,
    },
    tries: {
      type: Number,
      min: 0,
    },
    attempts: {
      type: Number,
      min: 0,
    },
  },
  order_id: {
    type: String,
  },
  zeal_id: {
    type: String,
    index: 1,
  },
  role: {
    type: Number,
    default: 0,
  },
  refresh_token: {
    type: String,
  },
});

export default model("users", userSchema, "users");
