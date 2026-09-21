import OrderPage from "../../order/OrderPage";

export const metadata = { title: "Get Rysflo" };

// Pre-printed sticker: /q/K7M2P9. Resolved to its current gym/trainer server-side.
export default async function StickerOrderPage({ params }) {
  const { id } = await params;
  const clean = String(id || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  return <OrderPage qrId={clean} />;
}
