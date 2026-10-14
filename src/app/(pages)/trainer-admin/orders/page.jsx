"use client";

// Read-only Orders & Payments for the trainer admins listed in
// src/lib/ordersAccess.js (middleware sends everyone else away; the backend
// answers 403 for them anyway). Same data as the super-admin page, no Test codes.

import OrdersPayments from "@/components/super-admin/orders/OrdersPayments";

export default function TrainerAdminOrdersPage() {
  return <OrdersPayments />;
}
