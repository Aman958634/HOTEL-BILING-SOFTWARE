const idOf = (value) => String(value?._id || value?.id || value || "");

export const realtimeNotificationId = (notification) => idOf(notification?.id || notification?.notificationId || notification?._id);

export const isRealtimeNotificationVisible = ({ notification, user, activeOutletId }) => {
  const notificationId = realtimeNotificationId(notification);
  const notificationRestaurant = idOf(notification?.restaurantId || notification?.restaurant);
  const notificationOutlet = idOf(notification?.outlet || notification?.outletId);
  const userRestaurant = idOf(user?.restaurant);

  if (!notificationId || !notificationRestaurant || (userRestaurant && notificationRestaurant !== userRestaurant)) return false;
  if (notificationOutlet && notificationOutlet !== idOf(activeOutletId)) return false;
  return true;
};

export const prependRealtimeNotification = (current = [], notification, limit = 3) => {
  const id = realtimeNotificationId(notification);
  if (!id || current.some((item) => realtimeNotificationId(item) === id)) return current;
  return [{ ...notification, _id: id, isRead: Boolean(notification.isRead) }, ...current].slice(0, limit);
};
