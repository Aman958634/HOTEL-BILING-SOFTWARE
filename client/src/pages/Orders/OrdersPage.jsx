import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getOrders } from "../../services/orderService";
import { generateHotelPaymentQr, verifyHotelPayment } from "../../services/hotelPaymentService";
import { getPaymentById, getPaymentReceipt } from "../../services/paymentService";
import { currency, dateTime } from "../../utils/format";
import { orderPaymentLabel, paymentBadgeClasses } from "../../utils/paymentUtils";
import { FiCheckCircle, FiShoppingBag } from "react-icons/fi";
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

  const regenerateHotelPaymentQr = async () => {
    if (!hotelPaymentOrder?._id || hotelPaymentLoading) return;
    setHotelPaymentLoading(true);
    try {
      const { data } = await generateHotelPaymentQr({ orderId: hotelPaymentOrder._id });
      setHotelPayment(data?.data || null);
      toast.success("Hotel UPI QR is ready for the current outstanding amount.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to generate a new Hotel UPI QR");
    } finally {
      setHotelPaymentLoading(false);
    }
  };

  const refreshHotelPaymentStatus = async ({ silent = false } = {}) => {
    const paymentId = hotelPayment?.payment?._id || hotelPayment?.payment?.paymentId;
    if (!paymentId || hotelPaymentLoading) return;
    setHotelPaymentLoading(true);
    try {
      const { data } = await getPaymentById(paymentId);
      const paymentRecord = data?.data || {};
      setHotelPayment((current) => ({ ...current, payment: paymentRecord, paymentStatus: paymentRecord.paymentStatus || current?.paymentStatus }));
      if (String(paymentRecord.paymentStatus || "").toUpperCase() === "PAID") {
        setOrders((current) => current.map((item) => String(item._id) === String(hotelPaymentOrder?._id)
          ? { ...item, paymentStatus: "PAID", paymentMethod: paymentRecord.paymentMethod || "UPI" }
          : item));
        if (!silent) toast.success("Hotel payment independently verified.");
      } else if (!silent) toast("No independent bank-credit verification has been recorded yet.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to refresh Hotel UPI payment status");
    } finally {
      setHotelPaymentLoading(false);
    }
  };

  const confirmHotelPaymentReceived = async (transactionId) => {
    const paymentId = hotelPayment?.payment?._id || hotelPayment?.payment?.paymentId;
    if (!paymentId || hotelPaymentLoading) return false;
    setHotelPaymentLoading(true);
    try {
      const { data } = await verifyHotelPayment({ paymentId, transactionId: transactionId || undefined });
      const paymentRecord = data?.data?.payment || {};
      setHotelPayment((current) => ({ ...current, payment: paymentRecord, paymentStatus: paymentRecord.paymentStatus || "PAID" }));
      setOrders((current) => current.map((item) => String(item._id) === String(hotelPaymentOrder?._id)
        ? { ...item, paymentStatus: "PAID", paymentMethod: paymentRecord.paymentMethod || "UPI" }
        : item));
      toast.success("Payment successful");
      return true;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to confirm payment received");
      return false;
    } finally {
      setHotelPaymentLoading(false);
    }
  };

  const downloadHotelPaymentReceipt = async () => {
    const paymentId = hotelPayment?.payment?._id || hotelPayment?.payment?.paymentId;
    if (!paymentId) return;
    try {
      const { data } = await getPaymentReceipt(paymentId);
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `receipt-${paymentId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Hotel UPI receipt downloaded");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to download Hotel UPI receipt");
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
            {String(order.paymentStatus || "").toUpperCase() === "PAID" ? <span className={`mt-1 inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${paymentBadgeClasses(order.paymentStatus)}`}><FiCheckCircle aria-hidden="true" className="shrink-0" /><span className="truncate">{orderPaymentLabel(order.paymentStatus, order.paymentMethod, order.paymentProvider || order.provider || order.gateway)}</span></span> : <button type="button" onClick={() => openHotelPayment(order)} className="mt-3 min-h-10 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">{String(order.paymentStatus || "").toUpperCase() === "AWAITING_VERIFICATION" ? "View Hotel UPI QR" : "Pay via Hotel UPI"}</button>}
          </div>
        ))}
      </div>
      <HotelUpiPaymentModal
        open={Boolean(hotelPaymentOrder)}
        order={hotelPaymentOrder}
        payment={hotelPayment}
        loading={hotelPaymentLoading}
        onGenerate={regenerateHotelPaymentQr}
        onRefreshStatus={refreshHotelPaymentStatus}
        onConfirmPaymentReceived={confirmHotelPaymentReceived}
        onReceipt={downloadHotelPaymentReceipt}
        onClose={() => { if (!hotelPaymentLoading) { setHotelPaymentOrder(null); setHotelPayment(null); } }}
      />
    </div>
  );
};

export default OrdersPage;
