const fs = require("fs");
const path = require("path");
const Product = require("../models/Product");

// GET /api/products?category=slug&search=term&page=1&limit=12
async function listProducts(req, res) {
  const { category, search, page = 1, limit = 12, sort = "-createdAt" } = req.query;
  const filter = { isActive: true };

  if (category) {
    const Category = require("../models/Category");
    const cat = await Category.findOne({ slug: category });
    if (cat) filter.category = cat._id;
  }
  if (search) {
    filter.$text = { $search: search };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(filter).populate("category", "name slug").sort(sort).skip(skip).limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  res.json({
    products,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  });
}

// GET /api/products/:slug
async function getProductBySlug(req, res) {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true }).populate(
    "category",
    "name slug"
  );
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
}

// ---- Admin ----

// POST /api/admin/products
async function createProduct(req, res) {
  const { name, description, price, compareAtPrice, images, category, stock, sku, seoTitle, seoDescription } =
    req.body;

  if (!name || !description || !price || !images?.length || !category) {
    return res.status(400).json({ message: "Name, description, price, images and category are required" });
  }

  const product = await Product.create({
    name,
    description,
    price,
    compareAtPrice,
    images,
    category,
    stock: stock || 0,
    sku,
    seoTitle,
    seoDescription,
    createdBy: req.user._id,
  });

  res.status(201).json(product);
}

// GET /api/admin/products/:id  (includes inactive, for the edit form)
async function adminGetProduct(req, res) {
  const product = await Product.findById(req.params.id).populate("category", "name slug");
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
}

// PUT /api/admin/products/:id
async function updateProduct(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  Object.assign(product, req.body);
  await product.save();
  res.json(product);
}

// DELETE /api/admin/products/:id  (soft delete)
async function deleteProduct(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  product.isActive = false;
  await product.save();
  res.json({ message: "Product removed from storefront" });
}

// DELETE /api/admin/products/:id/permanent  (hard delete — removes the record and its local image files)
async function permanentDeleteProduct(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  for (const url of product.images || []) {
    if (url.startsWith("/uploads/")) {
      const filePath = path.join(__dirname, "..", url);
      fs.unlink(filePath, () => {}); // best-effort cleanup, ignore missing files
    }
  }

  await product.deleteOne();
  res.json({ message: "Product permanently deleted" });
}

// GET /api/admin/products  (includes inactive, for admin management table)
async function adminListProducts(req, res) {
  const products = await Product.find().populate("category", "name slug").sort("-createdAt");
  res.json(products);
}

module.exports = {
  listProducts,
  getProductBySlug,
  createProduct,
  adminGetProduct,
  updateProduct,
  deleteProduct,
  permanentDeleteProduct,
  adminListProducts,
};
