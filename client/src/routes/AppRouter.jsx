import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import ProtectedRoute from "../components/common/ProtectedRoute";
import AdminRoute from "../components/common/AdminRoute";
import SuperAdminRoute from "../components/common/SuperAdminRoute";
import HomePage from "../pages/Home/HomePage";
import MenuPage from "../pages/Menu/MenuPage";
import ReservationPage from "../pages/Reservation/ReservationPage";
import CartPage from "../pages/Cart/CartPage";
import CheckoutPage from "../pages/Checkout/CheckoutPage";
import OrdersPage from "../pages/Orders/OrdersPage";
import LoginPage from "../pages/Login/LoginPage";
import RegisterPage from "../pages/Register/RegisterPage";
import ProfilePage from "../pages/Profile/ProfilePage";
import NotFoundPage from "../pages/NotFound/NotFoundPage";
import AdminDashboard from "../pages/admin/AdminDashboard";
import SuperAdminDashboard from "../pages/admin/SuperAdminDashboard";
import MenuManagement from "../pages/admin/MenuManagement";
import CategoryManagement from "../pages/admin/CategoryManagement";
import TableManagement from "../pages/admin/TableManagement";
import OrderManagement from "../pages/admin/OrderManagement";
import StaffManagement from "../pages/admin/StaffManagement";
import Payments from "../pages/admin/Payments";
import Reports from "../pages/admin/Reports";
import Notifications from "../pages/admin/Notifications";
import Settings from "../pages/admin/Settings";
import AdminModuleLayout from "../pages/admin/AdminModuleLayout";
import SuperAdminModuleLayout from "../pages/admin/SuperAdminModuleLayout";
import AdminPlaceholderPage from "../pages/admin/AdminPlaceholderPage";
import RestaurantsPage from "../pages/admin/RestaurantsPage";
import AddRestaurantPage from "../pages/admin/AddRestaurantPage";
import RestaurantDetailsPage from "../pages/admin/RestaurantDetailsPage";
import UsersPage from "../pages/admin/UsersPage";
import AddUserPage from "../pages/admin/AddUserPage";
import UserDetailsPage from "../pages/admin/UserDetailsPage";
import SubscriptionsPage from "../pages/admin/SubscriptionsPage";
import ActivityLogsPage from "../pages/admin/ActivityLogsPage";
import BillingPage from "../pages/admin/BillingPage";
import SuperAdminPaymentsPage from "../pages/admin/SuperAdminPaymentsPage";
import PricingPage from "../pages/Pricing/PricingPage";
import SubscribeRegisterPage from "../pages/Subscribe/SubscribeRegisterPage";
import SubscribeCheckoutPage from "../pages/Subscribe/SubscribeCheckoutPage";
import SubscribeSuccessPage from "../pages/Subscribe/SubscribeSuccessPage";
import SubscribeFailedPage from "../pages/Subscribe/SubscribeFailedPage";
import MySubscriptionPage from "../pages/admin/MySubscriptionPage";

const AppRouter = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/super-admin-login" element={<LoginPage superAdminOnly />} />
    <Route path="/register" element={<RegisterPage />} />

    <Route element={<MainLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/reservation" element={<ProtectedRoute><ReservationPage /></ProtectedRoute>} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/subscribe/register" element={<SubscribeRegisterPage />} />
      <Route path="/subscribe/checkout" element={<SubscribeCheckoutPage />} />
      <Route path="/subscribe/success" element={<SubscribeSuccessPage />} />
      <Route path="/subscribe/failed" element={<SubscribeFailedPage />} />
    </Route>

    <Route
      path="/dashboard/admin"
      element={
        <ProtectedRoute>
          <AdminRoute>
            <AdminModuleLayout />
          </AdminRoute>
        </ProtectedRoute>
      }
    >
      <Route index element={<AdminDashboard />} />
      <Route path="menu" element={<MenuManagement />} />
      <Route path="categories" element={<CategoryManagement />} />
      <Route path="tables" element={<TableManagement />} />
      <Route path="orders" element={<OrderManagement />} />
      <Route path="staff" element={<StaffManagement />} />
      <Route path="payments" element={<Payments />} />
      <Route path="billing" element={<BillingPage />} />
      <Route path="my-subscription" element={<MySubscriptionPage />} />
      <Route path="reports" element={<Reports />} />
      <Route path="notifications" element={<Notifications />} />
      <Route path="settings" element={<Settings />} />
    </Route>

    <Route
      path="/super-admin/*"
      element={
        <ProtectedRoute>
          <SuperAdminRoute>
            <SuperAdminModuleLayout />
          </SuperAdminRoute>
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<SuperAdminDashboard />} />
      <Route path="restaurants" element={<RestaurantsPage />} />
      <Route path="restaurants/new" element={<AddRestaurantPage />} />
      <Route path="restaurants/:id" element={<RestaurantDetailsPage />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="users/new" element={<AddUserPage />} />
      <Route path="users/:id" element={<UserDetailsPage />} />
      <Route path="subscriptions" element={<SubscriptionsPage />} />
      <Route path="activity-logs" element={<ActivityLogsPage />} />
      <Route path="orders" element={<AdminPlaceholderPage title="Orders" />} />
      <Route path="payments" element={<SuperAdminPaymentsPage />} />
      <Route path="reports" element={<AdminPlaceholderPage title="Reports" />} />
      <Route path="settings" element={<AdminPlaceholderPage title="Settings" />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Route>

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export default AppRouter;
