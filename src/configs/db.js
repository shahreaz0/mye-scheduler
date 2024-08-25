const mongoose = require("mongoose");
const log = require("../logger");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    log.info("Database connected...");
  } catch (error) {
    log.error(error.message);
  }
};

module.exports = connectDB;
