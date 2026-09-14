const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  register, verifyEmail, resendVerificationCode, login,
  googleLogin, forgotPassword, resetPassword, getMe,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again after 15 minutes." },
});

router.post("/register", authLimiter, register);
router.post("/verify-email", authLimiter, verifyEmail);
router.post("/resend-code", authLimiter, resendVerificationCode);
router.post("/login", authLimiter, login);
router.post("/google", authLimiter, googleLogin);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.get("/me", protect, getMe);

module.exports = router;
