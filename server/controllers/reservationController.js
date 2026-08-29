import Reservation from "../models/Reservation.js";
import Table from "../models/Table.js";
import Restaurant from "../models/Restaurant.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildRestaurantQuery, resolveRestaurantForUser } from "../utils/tenantUtils.js";
import {
  TABLE_STATUS,
  activeReservationStatuses,
  assignReservationToTable,
  releaseReservationFromTable,
} from "../services/tableStateService.js";
import { linkCustomerToRestaurant } from "../services/customerService.js";

const reservationStatusMap = {
  pending: "pending",
  confirmed: "confirmed",
  cancelled: "cancelled",
  completed: "completed",
};

const getReservationMinuteRange = (dateValue) => {
  const value = new Date(dateValue);
  if (Number.isNaN(value.getTime())) {
    throw new ApiError(422, "Reservation date is invalid");
  }

  const start = new Date(value);
  start.setSeconds(0, 0);

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 1);

  return { start, end, value: start };
};

const resolveRestaurantId = async (restaurantId, user) => {
  const restaurant = await resolveRestaurantForUser({ restaurantId, user });
  return restaurant._id;
};

export const createReservation = asyncHandler(async (req, res) => {
  const { table, date, guests, restaurant, notes } = req.body;
  const tableDoc = await Table.findById(table);
  if (!tableDoc) throw new ApiError(404, "Table not found");

  if (Number(guests) > Number(tableDoc.capacity)) {
    throw new ApiError(422, "Guest count exceeds table capacity");
  }

  if ([TABLE_STATUS.OCCUPIED, TABLE_STATUS.MAINTENANCE].includes(String(tableDoc.status).toUpperCase())) {
    throw new ApiError(409, "Selected table is not available for reservation");
  }

  const { start, end, value } = getReservationMinuteRange(date);

  const existingReservation = await Reservation.findOne({
    table,
    date: { $gte: start, $lt: end },
    status: { $in: activeReservationStatuses },
  }).select("_id");

  if (existingReservation) {
    throw new ApiError(409, "This table is already reserved for the selected date and time.");
  }

  const restaurantId = await resolveRestaurantId(restaurant || tableDoc.restaurant, req.user);

  if (!tableDoc.restaurant && restaurantId) {
    tableDoc.restaurant = restaurantId;
    await tableDoc.save();
  }

  const reservation = await Reservation.create({
    customer: req.user._id,
    table,
    date: value,
    guests,
    restaurant: restaurantId,
    notes,
  });

  await linkCustomerToRestaurant(req.user._id, restaurantId);

  await assignReservationToTable(tableDoc._id, reservation._id);

  const populated = await Reservation.findById(reservation._id)
    .populate("table", "tableNumber")
    .populate("restaurant", "name");

  res.status(201).json(new ApiResponse(true, "Reservation created", reservation));
});

export const listReservations = asyncHandler(async (req, res) => {
  const filters = req.user.role === "customer" ? { customer: req.user._id } : {};
  const query = await buildRestaurantQuery(filters, req.user);
  const reservations = await Reservation.find(query)
    .populate("table", "tableNumber floor")
    .populate("restaurant", "name")
    .sort({ date: -1 });
  res.status(200).json(new ApiResponse(true, "Reservations fetched", reservations));
});

export const updateReservationStatus = asyncHandler(async (req, res) => {
  const requestedStatus = String(req.body.status || "").toLowerCase().trim();
  const status = reservationStatusMap[requestedStatus] || requestedStatus;

  if (!reservationStatusMap[status]) {
    throw new ApiError(422, "Invalid reservation status");
  }

  const reservation = await Reservation.findOneAndUpdate(
    await buildRestaurantQuery({ _id: req.params.id }, req.user),
    { status },
    { new: true }
  );
  if (!reservation) throw new ApiError(404, "Reservation not found");

  if (["cancelled", "completed"].includes(status)) {
    await releaseReservationFromTable(reservation.table, reservation._id);
  }

  if (["pending", "confirmed"].includes(status)) {
    await assignReservationToTable(reservation.table, reservation._id);
  }

  res.status(200).json(new ApiResponse(true, "Reservation updated", reservation));
});
