import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { clearCart, setCartTableNumber } from "../../redux/slices/cartSlice";
import { createGuestOrder } from "../../services/orderService";
import { getTableByNumber } from "../../services/tableService";
import { currency } from "../../utils/format";

const GuestCheckoutPage = () => {
  const dispatch = useDispatch();
  const items = useSelector((state) => state.cart.items);
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get("table") || useSelector((state) => state.cart.tableNumber);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [placing, setPlacing] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;

  const onPlaceOrder = async () => {
    if (!tableNumber) {
      toast.error("Table number is missing");
      return;
    }

    setPlacing(true);
    try {
      const tableRes = await getTableByNumber(tableNumber);
      const table = tableRes.data?.data;
      if (!table || !table._id) {
        toast.error("Invalid table");
        return;
      }

      const payload = {
        orderType: "DINE_IN",
        table: table._id,
        restaurant: table.restaurant?._id || table.restaurant,
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

      await createGuestOrder(payload);
      dispatch(clearCart());
      dispatch(setCartTableNumber(null));
      toast.success("Order placed successfully");
    } catch {
      toast.error("Order failed. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-xl">
        <h2 className="text-2xl font-bold">Checkout</h2>
        <p className="mt-4 text-slate-600">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Checkout</h2>
        {tableNumber && (
          <p className="mt-1 text-sm text-brand-700">
            Table: <span className="font-bold">{tableNumber}</span> (Dine-In)
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
        <h3 className="text-lg font-semibold text-slate-900">Your Details (Optional)</h3>
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
        className="w-full rounded-xl bg-brand-700 px-5 py-3 text-base font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {placing ? "Placing Order..." : `Place Order — ${currency(total)}`}
      </button>
    </div>
  );
};

export default GuestCheckoutPage;
