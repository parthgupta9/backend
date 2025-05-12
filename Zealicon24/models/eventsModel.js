import { Schema, model } from "mongoose";
import { SOCIETIES, EVENT_TYPES } from "../config/appConfig.js";

const eventSchema = new Schema({
  title: {
    type: String,
    required: true,
    maxLength: 40,
  },
  type: {
    type: String,
    required: true,
    enum: EVENT_TYPES,
  },
  image: {
    type: String,
  },
  society: {
    type: String,
    required: true,
    enum: SOCIETIES,
  },
  sheet_id: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    maxLength: 2000,
  },
  venue: {
    type: String,
  },
  contact_info: {
    type: String,
    maxLength: 1000,
  },
  prize: {
    type: Number,
    min: 0,
  },
  enrolled: [
    {
      type: Schema.Types.ObjectId,
      ref: "users",
      default: [],
    },
  ],
  enrollment_start: {
    type: Date,
    default: Date.now,
  },
  enrollment_end: {
    type: Date,
  },
  event_start: {
    type: Date,
  },
  event_end: {
    type: Date,
  },
});

export default model("events", eventSchema, "events");
