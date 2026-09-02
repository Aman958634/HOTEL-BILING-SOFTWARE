import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { addToCart, setPublicMenuContext } from "../../redux/slices/cartSlice";
import { getPublicMenu } from "../../services/menuService";
import { currency } from "../../utils/format";

const MenuPage = () => {
  const dispatch = useDispatch();
  const cartItems = useSelector((state) => state.cart.items);
  const publicMenuContext = useSelector((state) => state.cart.publicMenuContext);
  const [searchParams] = useSearchParams();
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const qrToken = searchParams.get("qr");

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    setError("");
    if (!qrToken) {
      setFoods([]);
      setCategories([]);
      setError("This menu requires a valid table QR code.");
      setLoading(false);
      return;
    }
    try {
      const params = { limit: 100, search: search.trim() || undefined };
      if (selectedCategory) params.category = selectedCategory;
      const { data } = await getPublicMenu(qrToken, params);
      const menu = data.data || {};
      setFoods(menu.items || []);
      setCategories(menu.categories || []);
      dispatch(setPublicMenuContext({
        qrToken,
        tableNumber: menu.table?.tableNumber || "",
        restaurantName: menu.restaurant?.name || "",
        outletName: menu.outlet?.name || "",
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load this menu.");
      setFoods([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [dispatch, qrToken, selectedCategory, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMenu();
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchMenu]);

  const availableFoods = useMemo(() => foods || [], [foods]);
  const cartCount = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);

  const handleAddToCart = (food) => {
    dispatch(addToCart(food));
    toast.success(`${food.name} added to cart`);
  };

  return (
    <div className="space-y-6">
      {qrToken && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800 sm:p-4">
          <p className="font-semibold">Verified table ordering</p>
          <p className="mt-1">{publicMenuContext?.restaurantName || "Restaurant menu"}{publicMenuContext?.outletName ? ` · ${publicMenuContext.outletName}` : ""}{publicMenuContext?.tableNumber ? ` · Table ${publicMenuContext.tableNumber}` : ""}</p>
        </div>
      )}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Menu</h2>
          <p className="mt-1 text-sm text-slate-500">Browse available dishes from the restaurant menu.</p>
        </div>

        <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block w-full">
            <span className="sr-only">Search menu</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu..."
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <article key={index} className="glass rounded-3xl p-4">
              <div className="aspect-[4/3] rounded-3xl bg-slate-200 animate-pulse" />
              <div className="mt-4 space-y-3">
                <div className="h-5 w-3/4 rounded-full bg-slate-200 animate-pulse" />
                <div className="h-4 w-full rounded-full bg-slate-200 animate-pulse" />
                <div className="h-5 w-1/2 rounded-full bg-slate-200 animate-pulse" />
                <div className="h-10 rounded-2xl bg-slate-200 animate-pulse" />
              </div>
            </article>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-lg font-semibold text-rose-900">Unable to load menu.</p>
          <p className="mt-2 text-sm text-rose-700">Please try again or check back soon.</p>
          <button
            type="button"
            onClick={fetchMenu}
            className="mt-4 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Retry
          </button>
        </div>
      ) : availableFoods.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-xl font-semibold text-slate-900">No menu items available</p>
          <p className="mt-2 text-sm text-slate-500">Please check back soon for our latest dishes.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {availableFoods.map((food) => {
            const statusLabel = food.status || "Popular";
            const isVeg = food.isVeg !== false;

            return (
              <article key={food._id} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="relative overflow-hidden rounded-t-[18px] bg-slate-100">
                  <div className="relative h-40 overflow-hidden sm:h-44">
                    {food.image ? (
                      <img
                        src={food.image}
                        alt={food.name}
                        className="h-full w-full object-cover transition duration-300 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-200 text-sm text-slate-500">
                        No image available
                      </div>
                    )}
                  </div>

                  <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-[#E8F7F1] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#087F70] shadow-sm shadow-slate-200">
                    {isVeg ? "Veg" : "Non-Veg"}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="break-words text-lg font-bold tracking-tight text-[#14213D]">{food.name}</h3>
                      <span className="inline-flex items-center rounded-full bg-[#E8F7F1] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#087F70] shadow-sm">
                        {statusLabel}
                      </span>
                    </div>

                    <p className="min-h-[2.75rem] text-[14px] leading-6 text-[#64748B] line-clamp-2">
                      {food.description || "No description provided."}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3">
                    <span className="text-[19px] font-bold text-[#087F70]">{currency(food.price)}</span>
                    <button
                      type="button"
                      disabled={!food.isAvailable}
                      onClick={() => handleAddToCart(food)}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#087F70] px-3 text-sm font-semibold text-white transition duration-200 hover:bg-[#066359] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 6h15l-1.5 9h-12z" />
                        <circle cx="9" cy="20" r="1" />
                        <circle cx="18" cy="20" r="1" />
                      </svg>
                      {food.isAvailable ? "Add to Cart" : "Unavailable"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {cartCount > 0 ? <div className="sticky bottom-3 z-20"><Link to={`/cart${qrToken ? `?qr=${encodeURIComponent(qrToken)}` : ""}`} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-lg shadow-brand-900/20"><span>{cartCount} {cartCount === 1 ? "item" : "items"} in cart</span><span>{currency(cartTotal)} · View cart</span></Link></div> : null}
    </div>
  );
};

export default MenuPage;
