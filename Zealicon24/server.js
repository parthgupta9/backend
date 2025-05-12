import express from "express";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import connectDB from "./config/databaseConfig.js";
import { zealRouter } from "./routes/zealRoutes.js";
import { authRouter } from "./routes/authRoutes.js";
import { merchRouter } from "./routes/merchRoutes.js";
import { eventsRouter } from "./routes/eventsRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import corsOptions from "./config/corsOptions.js";

dotenv.config();

const app = express();
// app.set("trust proxy", true);
//middlewares
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true, parameterLimit: 50000 }));
app.use(cookieParser());
app.use(morgan("dev"));

//connect to mongodb
connectDB();

export const razorInstance = new Razorpay({
  key_id: process.env.RAZORPAY_API_KEY,
  key_secret: process.env.RAZORPAY_API_SECRET,
});

//routes
app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);
app.use("/api/zeal", zealRouter);
app.use("/api/merch", merchRouter);
app.use("/api/test", testRoutes);

app.get("/get-key", (req, res) => {
  res.send({ key: process.env.RAZORPAY_API_KEY });
});

const PORT = process.env.PORT || 8181;
app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
});
