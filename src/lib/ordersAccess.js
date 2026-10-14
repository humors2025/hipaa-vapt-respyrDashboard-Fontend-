// Who may open Orders & Payments besides super admins.
//
// Trainer admins listed here get a read-only copy of the super-admin Orders
// page at /trainer-admin/orders: the same Shipping and Payments rows (every
// buyer), but no Test codes tab. The backend's ORDERS_VIEWER_EMAILS
// (super-admin-orders.js) is the real gate; this list only decides the menu
// link and the middleware redirect, so keep the two in step.
//
// Plain module with no client-only imports: middleware.js runs it on the edge.

export const ORDERS_VIEWER_EMAILS = ["evan.gaudet@gmail.com", "derek.lopez88@gmail.com", "sagar@respyr.in"];

export const ORDERS_TRAINER_ADMIN_PATH = "/trainer-admin/orders";
export const ORDERS_SUPER_ADMIN_PATH = "/super-admin/orders";

// `role` may be the raw token role ("admin") or the canonical "trainer_admin".
export function isOrdersViewer(role, email) {
  const r = String(role || "").trim().toLowerCase();
  if (r !== "admin" && r !== "trainer_admin") return false;
  return ORDERS_VIEWER_EMAILS.includes(String(email || "").trim().toLowerCase());
}
