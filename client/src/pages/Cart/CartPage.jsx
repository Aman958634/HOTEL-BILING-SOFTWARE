import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { addToCart, removeFromCart } from "../../redux/slices/cartSlice";
import { currency } from "../../utils/format";

const CartPage = () => {
  const dispatch = useDispatch();
  const items = useSelector((state) => state.cart.items);
  const publicMenuContext = useSelector((state) => state.cart.publicMenuContext);
  const total = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const checkoutPath = publicMenuContext?.qrToken ? `/guest-checkout?qr=${encodeURIComponent(publicMenuContext.qrToken)}` : "/checkout";
  const menuPath = publicMenuContext?.qrToken ? `/menu?qr=${encodeURIComponent(publicMenuContext.qrToken)}` : "/menu";

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Your cart</h2>{publicMenuContext?.tableNumber ? <p className="mt-1 text-sm text-brand-700">Ordering for <span className="font-semibold">Table {publicMenuContext.tableNumber}</span>{publicMenuContext.restaurantName ? ` · ${publicMenuContext.restaurantName}` : ""}</p> : <p className="mt-1 text-sm text-slate-500">Review items before checkout.</p>}</header>
      {!items.length ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><h3 className="text-lg font-semibold text-slate-900">Your cart is empty</h3><p className="mt-2 text-sm text-slate-500">Add available menu items to place an order.</p><Link to={menuPath} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white">Browse menu</Link></section> : <>
        <section className="space-y-3">{items.map((item) => <article key={item._id} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><div className="min-w-0"><h3 className="break-words font-semibold text-slate-900">{item.name}</h3><p className="mt-1 text-sm text-slate-500">{currency(item.price)} each</p><div className="mt-2 flex items-center gap-2"><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-800">Qty {item.quantity}</span><button type="button" onClick={() => dispatch(addToCart(item))} className="min-h-9 rounded-lg border border-brand-200 px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-50" aria-label={`Add one ${item.name}`}>Add one</button></div></div><div className="shrink-0 text-right"><p className="font-semibold text-slate-900">{currency(item.price * item.quantity)}</p><button type="button" className="mt-2 min-h-9 text-xs font-semibold text-rose-700 hover:text-rose-800" onClick={() => dispatch(removeFromCart(item._id))} aria-label={`Remove ${item.name} from cart`}>Remove</button></div></article>)}</section>
        <aside className="sticky bottom-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-slate-500">{itemCount} {itemCount === 1 ? "item" : "items"}</p><p className="text-xl font-bold text-slate-900">{currency(total)}</p></div><Link to={checkoutPath} className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white">Review order</Link></div></aside>
      </>}
    </div>
  );
};

export default CartPage;
