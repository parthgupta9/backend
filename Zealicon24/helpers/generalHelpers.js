import { randomInt, randomBytes, createHash, createCipheriv, createDecipheriv } from "crypto";

let counter = 0;

export const encryptData = (otp) => {
  const iv = randomBytes(16);

  const key = createHash("sha256").update(process.env.OTP_SECRET).digest().subarray(0, 16);

  const cipher = createCipheriv("aes-128-cbc", key, iv);
  let encryptedOtp = cipher.update(otp.toString(), "utf8", "hex");
  encryptedOtp += cipher.final("hex");

  return `${iv.toString("hex")}:${encryptedOtp}`;
};

export const decryptData = (encryptedData) => {
  const [ivHex, encryptedOtp] = encryptedData.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const key = createHash("sha256").update(process.env.OTP_SECRET).digest().subarray(0, 16);

  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  let decryptedOtp = decipher.update(encryptedOtp, "hex", "utf8");
  decryptedOtp += decipher.final("utf8");

  return +decryptedOtp;
};

export const generateRandomNDigits = (n) => {
  const min = Math.pow(10, n - 1);
  const max = Math.pow(10, n) - 1;

  return randomInt(min, max + 1);
};

export const validateDate = (date) => {
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
};

export const createObject = (obj) => Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));

export const zealId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#";
  let num = Math.floor(Date.now() / 100),
    res = "";

  do res = chars[num % 64] + res;
  while ((num = Math.floor(num / 64)));

  return res;
};
