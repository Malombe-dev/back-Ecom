const nodemailer = require("nodemailer");

// Swap this transporter for Amazon SES or Resend SMTP in production.
// SES example: host: "email-smtp.<region>.amazonaws.com", port 587, auth from SES SMTP creds.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail({ to, subject, html }) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}

function verificationEmailTemplate(code) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#16213E">Verify your email</h2>
      <p>Use the code below to verify your email address. It expires in 15 minutes.</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#16213E">${code}</p>
    </div>`;
}

function passwordResetEmailTemplate(code) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#16213E">Reset your password</h2>
      <p>Use the code below to reset your password. It expires in 15 minutes. If you didn't request this, ignore this email.</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#16213E">${code}</p>
    </div>`;
}

function orderStatusEmailTemplate(status, orderId) {
  const messages = {
    pending: "We've received your order and will be in touch within 12 hours to confirm delivery details.",
    approved: "Your order has been approved and is awaiting shipping.",
    shipped: "Your order is on its way!",
    delivered: "Your order has been delivered. Enjoy!",
    canceled: "Your order has been canceled.",
  };
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#16213E">Order Update</h2>
      <p>Order #${orderId}</p>
      <p style="font-size:16px">${messages[status] || "Your order status has been updated."}</p>
    </div>`;
}

module.exports = {
  sendEmail,
  verificationEmailTemplate,
  passwordResetEmailTemplate,
  orderStatusEmailTemplate,
};
