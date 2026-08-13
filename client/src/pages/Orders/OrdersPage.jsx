import { useEffect, useState } from "react";
import { getOrders } from "../../services/orderService";
import { currency, dateTime } from "../../utils/format";

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    getOrders().then((res) => setOrders(res.data.data)).catch(() => setOrders([]));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold">Orders</h2>
      <div className="mt-4 space-y-3">
        {orders.map((order) => (
          <div className="glass rounded-xl p-3" key={order._id}>
            <div className="flex justify-between">
              <h3 className="font-semibold">{order.orderNumber}</h3>
              <p className="text-sm">{order.status}</p>
            </div>
            <p className="text-sm text-slate-500">{dateTime(order.createdAt)}</p>
            <p className="mt-1 font-semibold">{currency(order.total)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrdersPage;
