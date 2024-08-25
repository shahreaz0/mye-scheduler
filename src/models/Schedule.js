const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema(
  {
    channel_name: {
      type: String,
    },
    channel_id: {
      type: String,
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
      trim: true,
    },
    timer: {
      type: Number,
      default: process.env.TIMER,
    },
    active_status: {
      type: String,
      enum: ["running", "stopped"],
      default: "running",
    },
    type: {
      type: String,
      enum: ["product", "inventory", "order"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Schedule", scheduleSchema);
