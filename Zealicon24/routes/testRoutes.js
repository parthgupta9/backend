import { Router } from "express";
import { sendMail } from "../config/mailConfig.js";
import limitter from "express-rate-limit";
import { createHmac, randomInt } from "crypto";

const router = Router();

router.get("/test-mail", async (req, res) => {
  const mailStatus = await sendMail("devolopkingbro@gmail.com", 1122333);
  res.status(200).send({
    success: mailStatus.success,
  });
});

router.get("/get-signature/:secret", async (req, res) => {
  const { secret } = req.params;
  if (secret !== process.env.JWT_SECRET) {
    return res.status(401).send({
      success: false,
      message: "unauthorized",
    });
  }
  const order_id = `order${randomInt(1000000000, 9999999999)}`;
  const payment_id = `payment${randomInt(1000000000, 9999999999)}`;
  const testString = `${order_id}|${payment_id}`;
  const expectedSignature = createHmac("sha256", process.env.RAZORPAY_API_SECRET).update(testString.toString()).digest("hex");
  console.log(`order_id: ${order_id}`);
  console.log(`payment_id: ${payment_id}`);
  console.log(`signature: ${expectedSignature}`);
  res.status(200).send({
    order_id,
    payment_id,
    signature: expectedSignature,
  });
});
const testLimitter = limitter({
  //can send at max 5 requests in 5 seconds on the specified route
  windowMs: 5000,
  max: 4,
  message: {
    success: false,
    message: "Too many requests",
  },
});
router.get("/test-limitter", testLimitter, async (req, res) => {
  res.status(200).send({
    success: true,
    message: "Request processed successfully",
  });
});

export default router;
