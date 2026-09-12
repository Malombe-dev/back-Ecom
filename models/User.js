const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true },
    landmark: { type: String, required: true },
    latitude: Number,
    longitude: Number,
    notes: String,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    googleId: { type: String, default: null },

    phone: { type: String },

    role: {
      type: String,
      enum: ["customer", "admin", "superadmin"],
      default: "customer",
    },

    isEmailVerified: { type: Boolean, default: false },
    emailVerificationCode: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    passwordResetCode: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    cart: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, default: 1, min: 1 },
      },
    ],

    savedAddress: addressSchema,

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
