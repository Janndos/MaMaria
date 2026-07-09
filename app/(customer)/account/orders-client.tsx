"use client";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui";
import { OrderList, CustomerOrder } from "@/components/order-list";

export function AccountOrders() {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/orders")
        .then((r) => r.json())
        .then((d) => { if (alive) setOrders(d.orders ?? []); })
        .catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!orders) return <Spinner label="Se încarcă istoricul..." />;
  return <OrderList orders={orders} />;
}
