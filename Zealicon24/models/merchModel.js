import { Schema, model } from "mongoose";

const merchSchema = new Schema({
  title: {
    type: String,
    required: true,
    maxLength: 40,
  },
  photo: {
    type: String,
  },
  sizes:{
    type:[String]
  },
  description: {
    type: String,
    maxLength: 300,
  },
  stock: {
    type: Number,
    default: 0,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
});

export default model("merch", merchSchema, "merch");
