import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { createOrder } from "../../services/orderService";
import { clearCart } from "../../redux/slices/cartSlice";

const CheckoutPage = () => {
  const items = useSelector((state) => state.cart.items);
  const dispatch = useDispatch();
  const [address, setAddress] = useState("");

  const onPlaceOrder = async () => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const payload = {
      restaurant: "66a111111111111111111111",
      items: items.map((item) => ({ food: item._id, quantity: item.quantity, price: item.price })),
      subtotal,
      tax: subtotal * 0.05,
      total: subtotal * 1.05,
      deliveryAddress: address,
      paymentMethod: "cash",
    };

    try {
      await createOrder(payload);
      dispatch(clearCart());
      toast.success("Order placed");
    } catch {
      toast.error("Order failed");
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
      <button onClick={onPlaceOrder} className="mt-4 rounded-xl bg-brand-700 px-5 py-2 text-white">Place Order</button>
    </div>
  );
};

export default CheckoutPage;
