import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { removeFromCart } from "../../redux/slices/cartSlice";
import { currency } from "../../utils/format";

const CartPage = () => {
  const dispatch = useDispatch();
  const items = useSelector((state) => state.cart.items);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div>
      <h2 className="text-2xl font-bold">Cart</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item._id} className="glass flex items-center justify-between rounded-xl p-3">
            <div>
              <h3 className="font-semibold">{item.name}</h3>
              <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
            </div>
            <div className="flex items-center gap-3">
              <p>{currency(item.price * item.quantity)}</p>
              <button className="text-red-600" onClick={() => dispatch(removeFromCart(item._id))}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-xl font-bold">Total: {currency(total)}</p>
        <Link to="/checkout" className="rounded-xl bg-brand-700 px-5 py-2 text-white">Checkout</Link>
      </div>
    </div>
  );
};

export default CartPage;
