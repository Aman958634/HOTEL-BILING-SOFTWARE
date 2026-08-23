import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination } from "../utils/pagination.js";
import {
  Restaurant,
  Table,
  Reservation,
  Category,
  Food,
  Payment,
  Staff,
  Shift,
  Inventory,
  Ingredient,
  Supplier,
  Notification,
  Feedback,
  Coupon,
  Offer,
  Delivery,
  Analytics,
  Log,
} from "../models/index.js";
import { notifyLowStock } from "../services/notificationService.js";

const registry = {
  restaurants: Restaurant,
  tables: Table,
  reservations: Reservation,
  categories: Category,
  foods: Food,
  payments: Payment,
  staff: Staff,
  shifts: Shift,
  inventory: Inventory,
  ingredients: Ingredient,
  suppliers: Supplier,
  notifications: Notification,
  feedback: Feedback,
  coupons: Coupon,
  offers: Offer,
  delivery: Delivery,
  analytics: Analytics,
  logs: Log,
};

const queryBuilder = (query) => {
  const filters = {};
  if (query.search) {
    filters.$or = [{ name: { $regex: query.search, $options: "i" } }, { title: { $regex: query.search, $options: "i" } }];
  }
  if (query.status) filters.status = query.status;
  if (query.isActive !== undefined) filters.isActive = query.isActive === "true";
  return filters;
};

const hasHotelId = (Model) => Boolean(Model.schema.path("hotelId"));

const buildTenantFilter = (Model, req, baseFilters = {}) => {
  const filters = { ...baseFilters };
  if (req.user?.hotelId && req.user.role !== "super_admin" && hasHotelId(Model)) {
    const tenantCondition = { $or: [{ hotelId: req.user.hotelId }, { hotelId: null }] };
    if (filters.$or) {
      return { $and: [filters, tenantCondition] };
    }
    return { ...filters, ...tenantCondition };
  }
  return filters;
};

const getModel = (resource) => {
  const model = registry[resource];
  if (!model) throw new ApiError(404, "Resource not found");
  return model;
};

export const createOne = asyncHandler(async (req, res) => {
  const Model = getModel(req.params.resource);
  if (req.user?.hotelId && req.user.role !== "super_admin" && hasHotelId(Model)) {
    req.body.hotelId = req.user.hotelId;
  }

  const doc = await Model.create(req.body);

  if (Model === Inventory) {
    const quantity = Number(doc.quantity || 0);
    const reorderLevel = Number(doc.reorderLevel || 0);
    if (quantity <= reorderLevel) {
      await notifyLowStock({
        restaurantId: doc.restaurant,
        inventoryId: doc._id,
        itemName: doc.itemName,
        quantity,
        reorderLevel,
      }).catch(() => {});
    }
  }

  res.status(201).json(new ApiResponse(true, "Created", doc));
});

export const findAll = asyncHandler(async (req, res) => {
  const Model = getModel(req.params.resource);
  const { page, limit, skip } = getPagination(req.query);
  const sort = req.query.sortBy ? { [req.query.sortBy]: req.query.order === "asc" ? 1 : -1 } : { createdAt: -1 };
  const filters = buildTenantFilter(Model, req, queryBuilder(req.query));

  const [items, total] = await Promise.all([
    Model.find(filters).sort(sort).skip(skip).limit(limit),
    Model.countDocuments(filters),
  ]);

  res.status(200).json(
    new ApiResponse(true, "Fetched", items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  );
});

export const findOne = asyncHandler(async (req, res) => {
  const Model = getModel(req.params.resource);
  const doc = await Model.findOne(buildTenantFilter(Model, req, { _id: req.params.id }));
  if (!doc) throw new ApiError(404, "Record not found");
  res.status(200).json(new ApiResponse(true, "Fetched", doc));
});

export const updateOne = asyncHandler(async (req, res) => {
  const Model = getModel(req.params.resource);
  const doc = await Model.findOneAndUpdate(buildTenantFilter(Model, req, { _id: req.params.id }), req.body, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw new ApiError(404, "Record not found");

  if (Model === Inventory) {
    const quantity = Number(doc.quantity || 0);
    const reorderLevel = Number(doc.reorderLevel || 0);
    if (quantity <= reorderLevel) {
      await notifyLowStock({
        restaurantId: doc.restaurant,
        inventoryId: doc._id,
        itemName: doc.itemName,
        quantity,
        reorderLevel,
      }).catch(() => {});
    }
  }

  res.status(200).json(new ApiResponse(true, "Updated", doc));
});

export const deleteOne = asyncHandler(async (req, res) => {
  const Model = getModel(req.params.resource);
  const doc = await Model.findOneAndDelete(buildTenantFilter(Model, req, { _id: req.params.id }));
  if (!doc) throw new ApiError(404, "Record not found");
  res.status(200).json(new ApiResponse(true, "Deleted"));
});
