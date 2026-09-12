const Category = require("../models/Category");

async function listCategories(req, res) {
  const categories = await Category.find().sort("name");
  res.json(categories);
}

// Admin: create category
async function createCategory(req, res) {
  const { name, image } = req.body;
  const category = await Category.create({ name, image });
  res.status(201).json(category);
}

module.exports = { listCategories, createCategory };
