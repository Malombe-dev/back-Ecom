const bcrypt = require("bcryptjs");
const User = require("../models/User");

// GET /api/admin/dashboard  (basic counts)
async function dashboardStats(req, res) {
  const Order = require("../models/Order");
  const Product = require("../models/Product");

  const [totalOrders, pending, approved, shipped, delivered, canceled, totalProducts, totalCustomers] =
    await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: "pending" }),
      Order.countDocuments({ status: "approved" }),
      Order.countDocuments({ status: "shipped" }),
      Order.countDocuments({ status: "delivered" }),
      Order.countDocuments({ status: "canceled" }),
      Product.countDocuments({ isActive: true }),
      User.countDocuments({ role: "customer" }),
    ]);

  res.json({
    totalOrders,
    ordersByStatus: { pending, approved, shipped, delivered, canceled },
    totalProducts,
    totalCustomers,
  });
}

// ---- Super Admin only: manage admin accounts ----

// GET /api/admin/admins
async function listAdmins(req, res) {
  const admins = await User.find({ role: { $in: ["admin", "superadmin"] } }).select("-password");
  res.json(admins);
}

// POST /api/admin/admins  { name, email, password }
async function createAdmin(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ message: "An account with this email already exists" });

  const hashed = await bcrypt.hash(password, 10);
  const admin = await User.create({
    name,
    email: email.toLowerCase(),
    password: hashed,
    role: "admin",
    authProvider: "local",
    isEmailVerified: true, // created directly by super admin, skip verification flow
    createdBy: req.user._id,
  });

  res.status(201).json({
    id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  });
}

// PATCH /api/admin/admins/:id/deactivate
async function deactivateAdmin(req, res) {
  const admin = await User.findById(req.params.id);
  if (!admin || admin.role !== "admin") return res.status(404).json({ message: "Admin not found" });
  admin.isActive = !admin.isActive;
  await admin.save();
  res.json({ message: admin.isActive ? "Admin reactivated" : "Admin deactivated", admin });
}

module.exports = { dashboardStats, listAdmins, createAdmin, deactivateAdmin };
