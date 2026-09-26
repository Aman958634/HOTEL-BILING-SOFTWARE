import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getOrders } from "../../services/orderService";
import { generateHotelPaymentQr } from "../../services/hotelPaymentService";
import { currency, dateTime } from "../../utils/format";
import { FiShoppingBag } from "react-icons/fi";
import ModuleIcon from "../../components/common/ModuleIcon";
import HotelUpiPaymentModal from "../../components/payments/HotelUpiPaymentModal";

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [hotelPaymentOrder, setHotelPaymentOrder] = useState(null);
  const [hotelPayment, setHotelPayment] = useState(null);
  const [hotelPaymentLoading, setHotelPaymentLoading] = useState(false);

  useEffect(() => {
    getOrders().then((res) => setOrders(res.data.data)).catch(() => setOrders([]));
  }, []);

  const openHotelPayment = async (order) => {
    if (!order?._id || hotelPaymentLoading) return;
    setHotelPaymentOrder(order);
    setHotelPayment(null);
    setHotelPaymentLoading(true);
    try {
      const { data } = await generateHotelPaymentQr({ orderId: order._id });
      setHotelPayment(data?.data || null);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Hotel UPI payment is unavailable for this order");
      setHotelPaymentOrder(null);
    } finally {
      setHotelPaymentLoading(false);
    }
  };

  return (
    <div>
      <h2 className="flex items-center gap-3 text-2xl font-bold"><ModuleIcon icon={<FiShoppingBag />} module="orders" variant="header" />Orders</h2>
      <div className="mt-4 space-y-3">
        {orders.map((order) => (
          <div className="glass rounded-xl p-3" key={order._id}>
            <div className="flex justify-between">
              <h3 className="font-semibold">{order.orderNumber}</h3>
              <p className="text-sm">{order.status}</p>
            </div>
            <p className="text-sm text-slate-500">{dateTime(order.createdAt)}</p>
            <p className="mt-1 font-semibold">{currency(order.total)}</p>
            {["PAID", "AWAITING_VERIFICATION"].includes(String(order.paymentStatus || "").toUpperCase()) ? <p className="mt-1 text-sm font-medium text-amber-700">{String(order.paymentStatus).replaceAll("_", " ")}</p> : <button type="button" onClick={() => openHotelPayment(order)} className="mt-3 min-h-10 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Pay via Hotel UPI</button>}
          </div>
        ))}
      </div>
      <HotelUpiPaymentModal
        open={Boolean(hotelPaymentOrder)}
        order={hotelPaymentOrder}
        payment={hotelPayment}
        loading={hotelPaymentLoading}
        onClose={() => { if (!hotelPaymentLoading) { setHotelPaymentOrder(null); setHotelPayment(null); } }}
      />
    </div>
  );
};

export default OrdersPage;
