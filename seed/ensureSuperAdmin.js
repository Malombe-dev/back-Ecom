const bcrypt = require("bcryptjs");
const User = require("../models/User");

// Runs on server start: if no super admin exists yet, create one from .env values.
async function ensureSuperAdmin() {
  const existing = await User.findOne({ role: "superadmin" });
  if (existing) return;

  const { SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME } = process.env;
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    console.warn("No super admin exists and SUPER_ADMIN_EMAIL/PASSWORD not set in .env — skipping.");
    return;
  }

  const hashed = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  await User.create({
    name: SUPER_ADMIN_NAME || "Super Admin",
    email: SUPER_ADMIN_EMAIL.toLowerCase(),
    password: hashed,
    role: "superadmin",
    authProvider: "local",
    isEmailVerified: true,
  });

  console.log(`Super admin created: ${SUPER_ADMIN_EMAIL}`);
}

module.exports = ensureSuperAdmin;
