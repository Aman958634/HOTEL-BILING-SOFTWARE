import User from "../models/User.js";

const isProduction = () => process.env.NODE_ENV === "production";

/** Development may use a convenience account; production must opt in with real secrets. */
export const getSuperAdminConfig = () => ({
  email: String(process.env.SUPER_ADMIN_EMAIL || (isProduction() ? "" : "superadmin@restosphere.com")).trim().toLowerCase(),
  password: process.env.SUPER_ADMIN_PASSWORD || (isProduction() ? "" : "SuperAdmin@12345"),
  fullName: process.env.SUPER_ADMIN_NAME || "Super Admin",
});

export const shouldSeedSuperAdmin = () =>
  isProduction() ? process.env.SUPER_ADMIN_SEED === "true" : process.env.SUPER_ADMIN_SEED !== "false";

/**
 * Idempotent super admin bootstrap:
 * - creates the account if missing
 * - repairs role / active status for the configured email
 * - never changes password unless SUPER_ADMIN_RESET_PASSWORD=true
 */
export const ensureSuperAdmin = async (log = console) => {
  const { email, password, fullName } = getSuperAdminConfig();
  if (!email || !password) {
    throw new Error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set before seeding a super admin");
  }

  const existingSuperAdmin = await User.findOne({ role: "super_admin" });
  if (existingSuperAdmin) {
    let changed = false;
    if (!existingSuperAdmin.isActive) {
      existingSuperAdmin.isActive = true;
      changed = true;
    }
    if (changed) {
      await existingSuperAdmin.save();
      log.info?.(`Super admin reactivated: ${existingSuperAdmin.email}`);
    } else {
      log.info?.(`Super admin already exists: ${existingSuperAdmin.email}`);
    }
    return { action: changed ? "reactivated" : "exists", email: existingSuperAdmin.email };
  }

  const byEmail = await User.findOne({ email }).select("+password");
  if (byEmail) {
    let changed = false;
    if (byEmail.role !== "super_admin") {
      byEmail.role = "super_admin";
      changed = true;
    }
    if (!byEmail.isActive) {
      byEmail.isActive = true;
      changed = true;
    }
    if (process.env.SUPER_ADMIN_RESET_PASSWORD === "true" && password) {
      byEmail.password = password;
      changed = true;
    }
    if (changed) {
      await byEmail.save();
      log.info?.(`Super admin repaired: ${email} (role/active${process.env.SUPER_ADMIN_RESET_PASSWORD === "true" ? "/password" : ""})`);
      return { action: "repaired", email };
    }
    log.info?.(`Super admin account already configured: ${email}`);
    return { action: "exists", email };
  }

  await User.create({
    fullName,
    email,
    password,
    role: "super_admin",
    isActive: true,
  });
  log.info?.(`Super admin created: ${email}`);
  return { action: "created", email };
};
