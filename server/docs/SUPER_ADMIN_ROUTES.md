# Super Admin Route Access Guide

## Overview

This guide explains how to expose or protect routes for the `super_admin` role.

## Existing route patterns

### `authorize(...)`

The primary route guard in the backend is `authorize(...)` from `server/middleware/auth.js`.

Example:

```js
import { authorize, protect } from "../middleware/auth.js";

router.get("/dashboard", protect, authorize("admin", "manager"), dashboardStats);
```

This middleware checks whether `req.user.role` matches one of the allowed roles.

### `requireRole(...)`

In some routes, `requireRole` from `server/middleware/roleMiddleware.js` is used. It also validates against `req.user.role`.

## Open a route for `super_admin`

If you want a route to be accessible to `super_admin`, add `super_admin` explicitly to the role list.

Example:

```js
import { authorize, protect } from "../middleware/auth.js";

router.get(
  "/admin-only",
  protect,
  authorize("admin", "super_admin"),
  adminOnlyHandler
);
```

If the route should allow only `super_admin`:

```js
import { requireSuperAdmin } from "../middleware/tenantMiddleware.js";
import { protect } from "../middleware/auth.js";

router.get("/super-admin-only", protect, requireSuperAdmin, superAdminHandler);
```

## Recommended route setup

### Allow `admin` and `super_admin`

Use this pattern for admin routes that should remain compatible with both roles:

```js
router.use(protect, authorize("admin", "super_admin"));
```

### Only allow `super_admin`

Use this pattern for global configuration or tenant management endpoints:

```js
router.use(protect, requireSuperAdmin);
```

## Notes for tenant middleware

- `super_admin` bypasses hotel-level restrictions in `server/middleware/tenantMiddleware.js`.
- For tenant-specific routes, `super_admin` should still be allowed explicitly by role middleware if needed.

## Example file locations

- `server/middleware/auth.js`
- `server/middleware/tenantMiddleware.js`
- `server/routes/adminRoutes.js`
- `server/controllers/authController.js`

## Practical advice

1. Add `super_admin` to `authorize(...)` lists when role-based access should include global admin.
2. Use `requireSuperAdmin` for endpoints that should not be accessible to normal admins.
3. Keep route authorization explicit: do not assume `super_admin` is included unless listed.
