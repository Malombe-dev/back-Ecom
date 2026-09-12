const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: String,
    price: Number,
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, default: Date.now },
    note: String,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },

    phone: { type: String, required: true },
    landmark: { type: String, required: true },
    latitude: Number,
    longitude: Number,
    deliveryNotes: String,

    status: {
      type: String,
      enum: ["pending", "approved", "shipped", "delivered", "canceled"],
      default: "pending",
    },
    statusHistory: [statusHistorySchema],

    cancellationReason: String,
    canceledBy: { type: String, enum: ["customer", "admin", null], default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
