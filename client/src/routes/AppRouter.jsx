import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import HomePage from "../pages/Home/HomePage";
import NotFoundPage from "../pages/NotFound/NotFoundPage";

const LoginPage = lazy(() => import("../pages/Login/LoginPage"));
const RegisterPage = lazy(() => import("../pages/Register/RegisterPage"));
const ProtectedRoute = lazy(() => import("../components/common/ProtectedRoute"));
const AdminRoute = lazy(() => import("../components/common/AdminRoute"));
const SuperAdminRoute = lazy(() => import("../components/common/SuperAdminRoute"));

const MenuPage = lazy(() => import("../pages/Menu/MenuPage"));
const ReservationPage = lazy(() => import("../pages/Reservation/ReservationPage"));
const CartPage = lazy(() => import("../pages/Cart/CartPage"));
const CheckoutPage = lazy(() => import("../pages/Checkout/CheckoutPage"));
const OrdersPage = lazy(() => import("../pages/Orders/OrdersPage"));
const ProfilePage = lazy(() => import("../pages/Profile/ProfilePage"));
const PricingPage = lazy(() => import("../pages/Pricing/PricingPage"));
const SubscribeRegisterPage = lazy(() => import("../pages/Subscribe/SubscribeRegisterPage"));
const SubscribeCheckoutPage = lazy(() => import("../pages/Subscribe/SubscribeCheckoutPage"));
const SubscribeSuccessPage = lazy(() => import("../pages/Subscribe/SubscribeSuccessPage"));
const SubscribeFailedPage = lazy(() => import("../pages/Subscribe/SubscribeFailedPage"));

const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const SuperAdminDashboard = lazy(() => import("../pages/admin/SuperAdminDashboard"));
const MenuManagement = lazy(() => import("../pages/admin/MenuManagement"));
const CategoryManagement = lazy(() => import("../pages/admin/CategoryManagement"));
const TableManagement = lazy(() => import("../pages/admin/TableManagement"));
const ServiceCockpit = lazy(() => import("../pages/admin/ServiceCockpit"));
const OrderManagement = lazy(() => import("../pages/admin/OrderManagement"));
const StaffManagement = lazy(() => import("../pages/admin/StaffManagement"));
const Payments = lazy(() => import("../pages/admin/Payments"));
const Reports = lazy(() => import("../pages/admin/Reports"));
const Notifications = lazy(() => import("../pages/admin/Notifications"));
const Settings = lazy(() => import("../pages/admin/Settings"));
const AdminModuleLayout = lazy(() => import("../pages/admin/AdminModuleLayout"));
const SuperAdminModuleLayout = lazy(() => import("../pages/admin/SuperAdminModuleLayout"));
const AdminPlaceholderPage = lazy(() => import("../pages/admin/AdminPlaceholderPage"));
const RestaurantsPage = lazy(() => import("../pages/admin/RestaurantsPage"));
const AddRestaurantPage = lazy(() => import("../pages/admin/AddRestaurantPage"));
const RestaurantDetailsPage = lazy(() => import("../pages/admin/RestaurantDetailsPage"));
const UsersPage = lazy(() => import("../pages/admin/UsersPage"));
const AddUserPage = lazy(() => import("../pages/admin/AddUserPage"));
const UserDetailsPage = lazy(() => import("../pages/admin/UserDetailsPage"));
const SubscriptionsPage = lazy(() => import("../pages/admin/SubscriptionsPage"));
const ActivityLogsPage = lazy(() => import("../pages/admin/ActivityLogsPage"));
const BillingPage = lazy(() => import("../pages/admin/BillingPage"));
const SuperAdminPaymentsPage = lazy(() => import("../pages/admin/SuperAdminPaymentsPage"));
const MySubscriptionPage = lazy(() => import("../pages/admin/MySubscriptionPage"));

const PageSkeleton = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-700" />
  </div>
);

const AppRouter = () => (
  <Routes>
    <Route path="/login" element={
      <Suspense fallback={<PageSkeleton />}>
        <LoginPage />
      </Suspense>
    } />
    <Route path="/super-admin-login" element={
      <Suspense fallback={<PageSkeleton />}>
        <LoginPage superAdminOnly />
      </Suspense>
    } />
    <Route path="/register" element={
      <Suspense fallback={<PageSkeleton />}>
        <RegisterPage />
      </Suspense>
    } />

    <Route element={<MainLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/menu" element={
        <Suspense fallback={<PageSkeleton />}>
          <MenuPage />
        </Suspense>
      } />
      <Route path="/reservation" element={
        <Suspense fallback={<PageSkeleton />}>
          <ProtectedRoute>
            <ReservationPage />
          </ProtectedRoute>
        </Suspense>
      } />
      <Route path="/cart" element={
        <Suspense fallback={<PageSkeleton />}>
          <CartPage />
        </Suspense>
      } />
      <Route path="/checkout" element={
        <Suspense fallback={<PageSkeleton />}>
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        </Suspense>
      } />
      <Route path="/orders" element={
        <Suspense fallback={<PageSkeleton />}>
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        </Suspense>
      } />
      <Route path="/profile" element={
        <Suspense fallback={<PageSkeleton />}>
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        </Suspense>
      } />
      <Route path="/pricing" element={
        <Suspense fallback={<PageSkeleton />}>
          <PricingPage />
        </Suspense>
      } />
      <Route path="/subscribe/register" element={
        <Suspense fallback={<PageSkeleton />}>
          <SubscribeRegisterPage />
        </Suspense>
      } />
      <Route path="/subscribe/checkout" element={
        <Suspense fallback={<PageSkeleton />}>
          <SubscribeCheckoutPage />
        </Suspense>
      } />
      <Route path="/subscribe/success" element={
        <Suspense fallback={<PageSkeleton />}>
          <SubscribeSuccessPage />
        </Suspense>
      } />
      <Route path="/subscribe/failed" element={
        <Suspense fallback={<PageSkeleton />}>
          <SubscribeFailedPage />
        </Suspense>
      } />
    </Route>

    <Route
      path="/dashboard/admin"
      element={
        <Suspense fallback={<PageSkeleton />}>
          <ProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <AdminRoute>
                <Suspense fallback={<PageSkeleton />}>
                  <AdminModuleLayout />
                </Suspense>
              </AdminRoute>
            </Suspense>
          </ProtectedRoute>
        </Suspense>
      }
    >
      <Route index element={<AdminDashboard />} />
      <Route path="menu" element={<MenuManagement />} />
      <Route path="categories" element={<CategoryManagement />} />
      <Route path="tables" element={<TableManagement />} />
      <Route path="cockpit" element={<ServiceCockpit />} />
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
        <Suspense fallback={<PageSkeleton />}>
          <ProtectedRoute>
            <Suspense fallback={<PageSkeleton />}>
              <SuperAdminRoute>
                <Suspense fallback={<PageSkeleton />}>
                  <SuperAdminModuleLayout />
                </Suspense>
              </SuperAdminRoute>
            </Suspense>
          </ProtectedRoute>
        </Suspense>
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
