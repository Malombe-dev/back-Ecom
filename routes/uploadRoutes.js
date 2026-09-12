const express = require("express");
const { protect, requireRole } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

router.use(protect, requireRole("admin", "superadmin"));

// POST /api/upload  (multipart/form-data, field name "images", up to 6 files)
router.post("/", upload.array("images", 6), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No images uploaded" });
  }
  const urls = req.files.map((f) => `/uploads/${f.filename}`);
  res.status(201).json({ urls });
});

module.exports = router;
