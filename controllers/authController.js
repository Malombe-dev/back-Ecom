const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const generateCode = require("../utils/generateCode");
const {
  sendEmail,
  verificationEmailTemplate,
  passwordResetEmailTemplate,
} = require("../utils/sendEmail");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    isEmailVerified: user.isEmailVerified,
  };
}

// POST /api/auth/register
async function register(req, res) {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  const hashed = await bcrypt.hash(password, 10);
  const code = generateCode();

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password: hashed,
    phone,
    authProvider: "local",
    emailVerificationCode: code,
    emailVerificationExpires: new Date(Date.now() + CODE_TTL_MS),
  });

  await sendEmail({
    to: user.email,
    subject: "Verify your email",
    html: verificationEmailTemplate(code),
  });

  res.status(201).json({
    message: "Account created. Check your email for a verification code.",
    userId: user._id,
  });
}

// POST /api/auth/verify-email  { userId, code }
async function verifyEmail(req, res) {
  const { userId, code } = req.body;
  const user = await User.findById(userId).select("+emailVerificationCode +emailVerificationExpires");
  if (!user) return res.status(404).json({ message: "Account not found" });
  if (user.isEmailVerified) return res.status(400).json({ message: "Email already verified" });

  if (
    !user.emailVerificationCode ||
    user.emailVerificationCode !== code ||
    user.emailVerificationExpires < new Date()
  ) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }

  user.isEmailVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  const token = generateToken(user);
  res.json({ message: "Email verified", token, user: publicUser(user) });
}

// POST /api/auth/resend-code { userId }
async function resendVerificationCode(req, res) {
  const { userId } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: "Account not found" });
  if (user.isEmailVerified) return res.status(400).json({ message: "Email already verified" });

  const code = generateCode();
  user.emailVerificationCode = code;
  user.emailVerificationExpires = new Date(Date.now() + CODE_TTL_MS);
  await user.save();

  await sendEmail({
    to: user.email,
    subject: "Your new verification code",
    html: verificationEmailTemplate(code),
  });

  res.json({ message: "New code sent" });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() }).select("+password");
  if (!user || user.authProvider !== "local") {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: "Invalid email or password" });

  if (!user.isEmailVerified) {
    return res.status(403).json({
      message: "Please verify your email first",
      userId: user._id,
      needsVerification: true,
    });
  }
  if (!user.isActive) {
    return res.status(403).json({ message: "This account has been deactivated" });
  }

  const token = generateToken(user);
  res.json({ token, user: publicUser(user) });
}

// POST /api/auth/google  { idToken }
async function googleLogin(req, res) {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ message: "Missing Google ID token" });

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  let user = await User.findOne({ email: payload.email.toLowerCase() });

  if (!user) {
    user = await User.create({
      name: payload.name,
      email: payload.email.toLowerCase(),
      authProvider: "google",
      googleId: payload.sub,
      isEmailVerified: true, // Google already verified it
    });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: "This account has been deactivated" });
  }

  const token = generateToken(user);
  res.json({ token, user: publicUser(user) });
}

// POST /api/auth/forgot-password { email }
async function forgotPassword(req, res) {
  const { email } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase(), authProvider: "local" });
  // Always respond the same way, whether or not the account exists (avoid leaking which emails are registered)
  if (user) {
    const code = generateCode();
    user.passwordResetCode = code;
    user.passwordResetExpires = new Date(Date.now() + CODE_TTL_MS);
    await user.save();
    await sendEmail({
      to: user.email,
      subject: "Reset your password",
      html: passwordResetEmailTemplate(code),
    });
  }
  res.json({ message: "If that email exists, a reset code has been sent." });
}

// POST /api/auth/reset-password { email, code, newPassword }
async function resetPassword(req, res) {
  const { email, code, newPassword } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() }).select(
    "+passwordResetCode +passwordResetExpires"
  );
  if (
    !user ||
    !user.passwordResetCode ||
    user.passwordResetCode !== code ||
    user.passwordResetExpires < new Date()
  ) {
    return res.status(400).json({ message: "Invalid or expired reset code" });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.passwordResetCode = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.json({ message: "Password reset successfully. You can now log in." });
}

// GET /api/auth/me
async function getMe(req, res) {
  res.json({ user: publicUser(req.user) });
}

module.exports = {
  register,
  verifyEmail,
  resendVerificationCode,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
  getMe,
};
