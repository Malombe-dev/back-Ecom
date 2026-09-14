const mongoose = require("mongoose");
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
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });

    const code = generateCode();
    const hashed = await bcrypt.hash(password, 10);

    if (existing) {
      if (!existing.isEmailVerified) {
        // Account exists but was never verified: update credentials and send a new code
        existing.name = name.trim();
        existing.password = hashed;
        if (phone) existing.phone = phone.trim();
        existing.emailVerificationCode = code;
        existing.emailVerificationExpires = new Date(Date.now() + CODE_TTL_MS);
        await existing.save();

        console.log(`[Auth] Verification code for unverified existing ${cleanEmail}: ${code}`);

        try {
          await sendEmail({
            to: existing.email,
            subject: "Verify your email",
            html: verificationEmailTemplate(code),
          });
        } catch (mailErr) {
          console.error("Failed to send verification email on re-register:", mailErr.message);
        }

        return res.status(200).json({
          message: "Verification code sent. Please check your email.",
          userId: existing._id,
          email: existing.email,
        });
      }

      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: hashed,
      phone: phone ? phone.trim() : undefined,
      authProvider: "local",
      emailVerificationCode: code,
      emailVerificationExpires: new Date(Date.now() + CODE_TTL_MS),
    });

    console.log(`[Auth] Verification code for ${user.email}: ${code}`);

    try {
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        html: verificationEmailTemplate(code),
      });
    } catch (mailErr) {
      console.error("Failed to send verification email on register:", mailErr.message);
    }

    return res.status(201).json({
      message: "Account created. Check your email for a verification code.",
      userId: user._id,
      email: user.email,
    });
  } catch (err) {
    console.error("Error in register:", err);
    return res.status(500).json({ message: err.message || "Failed to create account" });
  }
}

// POST /api/auth/verify-email  { userId, email, code }
async function verifyEmail(req, res) {
  try {
    const { userId, email, code } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Verification code is required" });
    }

    if (!userId && !email) {
      return res.status(400).json({ message: "Email or userId is required" });
    }

    let user = null;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId).select("+emailVerificationCode +emailVerificationExpires");
    }
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase().trim() }).select(
        "+emailVerificationCode +emailVerificationExpires"
      );
    }

    if (!user) return res.status(404).json({ message: "Account not found" });
    if (user.isEmailVerified) return res.status(400).json({ message: "Email already verified" });

    const cleanCode = String(code).trim();
    if (
      !user.emailVerificationCode ||
      user.emailVerificationCode !== cleanCode ||
      user.emailVerificationExpires < new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    const token = generateToken(user);
    return res.json({ message: "Email verified", token, user: publicUser(user) });
  } catch (err) {
    console.error("Error in verifyEmail:", err);
    return res.status(500).json({ message: err.message || "Failed to verify email" });
  }
}

// POST /api/auth/resend-code { userId, email }
async function resendVerificationCode(req, res) {
  try {
    const { userId, email } = req.body;

    if (!userId && !email) {
      return res.status(400).json({ message: "Email or userId is required" });
    }

    let user = null;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
    }

    if (!user) return res.status(404).json({ message: "Account not found" });
    if (user.isEmailVerified) return res.status(400).json({ message: "Email already verified" });

    const code = generateCode();
    user.emailVerificationCode = code;
    user.emailVerificationExpires = new Date(Date.now() + CODE_TTL_MS);
    await user.save();

    console.log(`[Auth] Resending verification code for ${user.email}: ${code}`);

    try {
      await sendEmail({
        to: user.email,
        subject: "Your new verification code",
        html: verificationEmailTemplate(code),
      });
    } catch (mailErr) {
      console.error("Failed to send verification email on resend:", mailErr.message);
      return res.status(500).json({ message: "Failed to send email. Please try again later." });
    }

    return res.json({ message: "New code sent", userId: user._id });
  } catch (err) {
    console.error("Error in resendVerificationCode:", err);
    return res.status(500).json({ message: err.message || "Failed to resend code" });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
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
        email: user.email,
        needsVerification: true,
      });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "This account has been deactivated" });
    }

    const token = generateToken(user);
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Error in login:", err);
    return res.status(500).json({ message: err.message || "Login failed" });
  }
}

// POST /api/auth/google  { idToken }
async function googleLogin(req, res) {
  try {
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
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Error in googleLogin:", err);
    return res.status(500).json({ message: err.message || "Google login failed" });
  }
}

// POST /api/auth/forgot-password { email }
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase(), authProvider: "local" });
    // Always respond the same way, whether or not the account exists (avoid leaking which emails are registered)
    if (user) {
      const code = generateCode();
      user.passwordResetCode = code;
      user.passwordResetExpires = new Date(Date.now() + CODE_TTL_MS);
      await user.save();
      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your password",
          html: passwordResetEmailTemplate(code),
        });
      } catch (mailErr) {
        console.error("Failed to send password reset email:", mailErr.message);
      }
    }
    return res.json({ message: "If that email exists, a reset code has been sent." });
  } catch (err) {
    console.error("Error in forgotPassword:", err);
    return res.status(500).json({ message: err.message || "Failed to process request" });
  }
}

// POST /api/auth/reset-password { email, code, newPassword }
async function resetPassword(req, res) {
  try {
    const { email, code, newPassword } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() }).select(
      "+passwordResetCode +passwordResetExpires"
    );
    if (
      !user ||
      !user.passwordResetCode ||
      user.passwordResetCode !== String(code).trim() ||
      user.passwordResetExpires < new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    console.error("Error in resetPassword:", err);
    return res.status(500).json({ message: err.message || "Failed to reset password" });
  }
}

// GET /api/auth/me
async function getMe(req, res) {
  try {
    return res.json({ user: publicUser(req.user) });
  } catch (err) {
    console.error("Error in getMe:", err);
    return res.status(500).json({ message: err.message || "Failed to get user profile" });
  }
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
