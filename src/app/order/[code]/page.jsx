import OrderPage from "../OrderPage";

export const metadata = { title: "Get Rysflo" };

export default async function OrderWithCodePage({ params }) {
  const { code } = await params;
  const clean = String(code || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 50);
  return <OrderPage code={clean} />;
}
