"use client";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui";
import { OrderList, CustomerOrder } from "@/components/order-list";

export default function OrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/orders")
        .then((r) => r.json())
        .then((d) => { if (alive) setOrders(d.orders ?? []); })
        .catch(() => {});
    load();
    // Auto-refresh so status changes (confirmed / ready / cancelled) show up
    // without the customer reloading the page.
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!orders) return <Spinner label="Se încarcă comenzile..." />;
  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-brand-800">Comenzile mele</h1>
      <OrderList orders={orders} />
    </div>
  );
}
