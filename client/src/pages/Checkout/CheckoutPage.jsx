import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { createOrder } from "../../services/orderService";
import { clearCart } from "../../redux/slices/cartSlice";

const CheckoutPage = () => {
  const items = useSelector((state) => state.cart.items);
  const dispatch = useDispatch();
  const [address, setAddress] = useState("");
  const [placing, setPlacing] = useState(false);
  const idempotencyKey = useRef(typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `web-${Date.now()}-${Math.random()}`);

  const onPlaceOrder = async () => {
    if (!items.length || !address.trim() || placing) return;
    setPlacing(true);
    const payload = {
      orderType: "DELIVERY",
      orderSource: "ONLINE",
      externalOrderId: idempotencyKey.current,
      items: items.map((item) => ({ food: item._id, quantity: item.quantity, price: item.price })),
      deliveryAddress: address.trim(),
      paymentMethod: "cash",
    };

    try {
      await createOrder(payload);
      dispatch(clearCart());
      toast.success("Order placed");
    } catch {
      toast.error("Order failed");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold">Checkout</h2>
      <textarea
        className="mt-4 w-full rounded-xl border border-slate-300 p-3"
        rows={4}
        placeholder="Delivery address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <button onClick={onPlaceOrder} disabled={placing || !items.length || !address.trim()} className="mt-4 rounded-xl bg-brand-700 px-5 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60">{placing ? "Placing order..." : "Place Order"}</button>
    </div>
  );
};

export default CheckoutPage;
