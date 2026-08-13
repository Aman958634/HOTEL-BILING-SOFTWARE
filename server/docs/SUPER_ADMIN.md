# Super Admin Documentation

## Purpose

This document describes how the `super_admin` role is defined and used in the backend.

## Role definition

In `server/models/User.js`, the `User` schema includes the following roles:

- `super_admin`
- `hotel_admin`
- `restaurant_admin`
- `manager`
- `staff`
- `cashier`
- `admin`
- `chef`
- `waiter`
- `delivery`
- `receptionist`
- `inventory_manager`
- `customer`

The `super_admin` role is the highest privilege level and is intended for global administrators.

## Authentication and token payload

When a user logs in, the JWT access token includes:

- `id`
- `role`
- `email`
- `hotelId`
- `restaurant`

This is created in `server/controllers/authController.js`.

Example token payload:

```json
{
  "id": "<userId>",
  "role": "super_admin",
  "email": "admin@example.com",
  "hotelId": null,
  "restaurant": null
}
```

## Middleware behavior

### `protect`

`server/middleware/auth.js` verifies the JWT token and attaches `req.user`:

- `id`
- `role`
- `hotelId`
- `restaurant`
- `email`
- `fullName`
- `isActive`

### `authorize(...roles)`

This middleware allows a route only if `req.user.role` exactly matches one of the provided roles.

### `requireSuperAdmin`

Defined in `server/middleware/tenantMiddleware.js`, this middleware allows only `super_admin` users.

### `requireHotelAccess`

Also in `server/middleware/tenantMiddleware.js`, this middleware:

- allows `super_admin` unconditionally
- requires other users to have `req.user.hotelId`
- sets `req.hotelId` for non-super-admin users

## Current code usage notes

- `super_admin` is recognized in `server/middleware/tenantMiddleware.js`.
- There is no current route file in the repo explicitly using `requireSuperAdmin`.
- The `resourceController` allows `super_admin` to bypass hotel-scoped restrictions.

## How to use `super_admin`

To use the role in the app, you must create or update a `User` record with:

```js
role: "super_admin"
```

Then log in through `/auth/login` to receive an access token.

## Important behavior

- A `super_admin` bypasses hotel-level tenant enforcement in the tenant middleware.
- `authorize("super_admin")` must be used explicitly if a route should accept only the super admin role.
- `requireRole("admin")` does not automatically include `super_admin`.

## Recommended pattern

If a route should allow both `admin` and `super_admin`, use:

```js
import { authorize } from "../middleware/auth.js";
router.use(protect, authorize("admin", "super_admin"));
```

Or add a dedicated wrapper if you want alias behavior.
