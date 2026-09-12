const express = require("express");
const { protect, requireRole } = require("../middleware/auth");
const { createCategory } = require("../controllers/categoryController");
const {
  createProduct, adminGetProduct, updateProduct, deleteProduct, permanentDeleteProduct, adminListProducts,
} = require("../controllers/productController");
const { adminListOrders, adminUpdateStatus } = require("../controllers/orderController");
const {
  dashboardStats, listAdmins, createAdmin, deactivateAdmin,
} = require("../controllers/adminController");

const router = express.Router();

router.use(protect, requireRole("admin", "superadmin"));

router.get("/dashboard", dashboardStats);

// products
router.get("/products", adminListProducts);
router.get("/products/:id", adminGetProduct);
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);
router.delete("/products/:id/permanent", permanentDeleteProduct);

// categories
router.post("/categories", createCategory);

// orders
router.get("/orders", adminListOrders);
router.patch("/orders/:id/status", adminUpdateStatus);

// super-admin only: manage admin accounts
router.get("/admins", requireRole("superadmin"), listAdmins);
router.post("/admins", requireRole("superadmin"), createAdmin);
router.patch("/admins/:id/deactivate", requireRole("superadmin"), deactivateAdmin);

module.exports = router;
