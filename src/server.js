const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const log = require("./logger");
const mongoose = require("mongoose");

// environment variables
if (process.env.NODE_ENV !== "production") require("dotenv").config();

// express configs
const app = express();
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

// database connection
const connectDB = require("./configs/db");
connectDB();

// routes
app.get("/scheduler", (_req, res) => {
  res.send({ message: "The API is up and running" });
});

app.use("/scheduler/api/schedules", require("./routes/schedules"));

app.get("*", (_req, res) => {
  res.send({ message: "No routes available" });
});

// server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => log.info(`http://localhost:${PORT}`));
