const express = require("express");
const { placeOrder, myOrders, getOrder, cancelMyOrder } = require("../controllers/orderController");
const { protect } = require("../middleware/auth");

const router = express.Router();
router.use(protect);
router.post("/", placeOrder);
router.get("/mine", myOrders);
router.get("/:id", getOrder);
router.patch("/:id/cancel", cancelMyOrder);

module.exports = router;
