import { createTransport } from "nodemailer";
import dotenv from "dotenv";
import { OTP_EXPIRES_MIN } from "./appConfig.js";

dotenv.config();

// Gmail SMTP transporter
const transporter = createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAILER_USER,        // Your Gmail address
    pass: process.env.MAILER_PASSWORD // App-specific password (not your main Gmail password)
  },
});

export const sendMail = async (eMail, otp) => {
  try {
    const mailOptions = {
      from: {
        name: process.env.MAILER_NAME || "Zealicon",
        address: process.env.MAILER_USER,
      },
      to: eMail,
      subject: `Your OTP (valid for ${OTP_EXPIRES_MIN} minutes)`,
      text: `Your OTP is: ${otp}`,
      html: `
      <div style="font-family: Helvetica,Arial,sans-serif; min-width: 1000px; overflow: auto; line-height: 2;">
        <div style="margin: 50px auto; width: 70%; padding: 20px 0;">
          <div style="border-bottom: 1px solid #eee;">
            <a href="#" style="font-size: 1.4em; color: #00466a; text-decoration: none; font-weight: 600;">Zealicon</a>
          </div>
          <p style="font-size: 1.1em;">Hi,</p>
          <p>Use the following OTP to complete your sign-up process. This OTP is valid for ${OTP_EXPIRES_MIN} minutes.</p>
          <h2 style="background: #00466a; margin: 0 auto; width: max-content; padding: 0 10px; color: #fff; border-radius: 4px;">${otp}</h2>
          <p style="font-size: 0.9em;">Regards,<br/>Team Zealicon</p>
          <hr style="border: none; border-top: 1px solid #eee;" />
          <div style="float: right; padding: 8px 0; color: #aaa; font-size: 0.8em; line-height: 1; font-weight: 300;">
            <p>Tech Team Zealicon</p>
            <p>JSS Academy of Technical Education, Sector 62</p>
            <p>Noida</p>
          </div>
        </div>
      </div>`,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Failed to send mail:", error);
    return { success: false, error: error.message };
  }
};
