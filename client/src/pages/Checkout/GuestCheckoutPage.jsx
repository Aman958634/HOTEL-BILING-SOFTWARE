import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { clearCart } from "../../redux/slices/cartSlice";
import { createGuestOrder } from "../../services/orderService";
import { currency } from "../../utils/format";

const GuestCheckoutPage = () => {
  const dispatch = useDispatch();
  const items = useSelector((state) => state.cart.items);
  const [searchParams] = useSearchParams();
  const publicMenuContext = useSelector((state) => state.cart.publicMenuContext);
  const qrToken = searchParams.get("qr") || publicMenuContext?.qrToken;
  const tableNumber = publicMenuContext?.tableNumber || "";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [idempotencyKey] = useState(() => {
    const storageKey = qrToken ? `restosphere.qrOrderKey:${qrToken}` : "restosphere.qrOrderKey:missing";
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const next = globalThis.crypto?.randomUUID?.() || `qr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(storageKey, next);
    return next;
  });

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;

  const onPlaceOrder = async () => {
    if (!qrToken) {
      toast.error("A valid table QR code is required");
      return;
    }

    setPlacing(true);
    try {
      const payload = {
        orderType: "DINE_IN",
        qrToken,
        items: items.map((item) => ({
          menuItem: item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.price * item.quantity,
        })),
        subtotal,
        tax,
        total,
        paymentMethod: "CASH",
        specialInstructions: name ? `Guest: ${name}${phone ? `, Phone: ${phone}` : ""}` : "",
      };

      const { data } = await createGuestOrder(payload, idempotencyKey);
      setPlacedOrder(data?.data || null);
      dispatch(clearCart());
      sessionStorage.removeItem(`restosphere.qrOrderKey:${qrToken}`);
      toast.success("Order placed successfully");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Order failed. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (placedOrder) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm">
          <p className="text-lg font-bold">Order received</p>
          <p className="mt-1 text-sm text-emerald-800">Your order has been submitted for Table {tableNumber || "your table"}.</p>
          {placedOrder.orderNumber ? <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold">Order #{placedOrder.orderNumber}</p> : null}
          {placedOrder.status ? <p className="mt-2 text-sm">Current status: {String(placedOrder.status).replaceAll("_", " ")}</p> : null}
        </section>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl">
        <h2 className="text-2xl font-bold">Checkout</h2>
        <p className="mt-4 text-slate-600">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Review order</h2>
        {tableNumber && (
          <p className="mt-1 text-sm text-brand-700">
            Table: <span className="font-bold">{tableNumber}</span> (Dine-In)
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm text-slate-600"><span>Items</span><span>{items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</span></div>
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Subtotal</span>
          <span>{currency(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Tax (5%)</span>
          <span>{currency(tax)}</span>
        </div>
        <div className="flex items-center justify-between text-lg font-bold text-slate-900">
          <span>Total</span>
          <span>{currency(total)}</span>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Your details (optional)</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </div>

      <button
        onClick={onPlaceOrder}
        disabled={placing}
        className="min-h-12 w-full rounded-xl bg-brand-700 px-5 py-3 text-base font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {placing ? "Placing Order..." : `Place Order — ${currency(total)}`}
      </button>
    </div>
  );
};

export default GuestCheckoutPage;
