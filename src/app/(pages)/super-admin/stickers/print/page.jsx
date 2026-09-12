"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { listQrService } from "@/services/commissionService";

const STICKER_BASE = (process.env.NEXT_PUBLIC_STICKER_BASE_URL || process.env.NEXT_PUBLIC_ORDER_BASE_URL?.replace(/\/order$/, "/q") || "https://admin.rysflo.com/q").replace(/\/+$/, "");

/** Printable sticker sheet: one QR + its ID per cell. Print at 100%. */
function Sheet() {
  const search = useSearchParams();
  const batch = search?.get("batch") || "";
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      const res = await listQrService({});
      setItems((res.items || []).filter((q) => !batch || q.batch_id === batch));
    })();
  }, [batch]);

  return (
    <div className="bg-white min-h-screen p-6 print:p-0">
      <style>{`@media print { .no-print { display:none } @page { margin: 10mm } }`}</style>
      <div className="no-print flex items-center justify-between mb-4">
        <div className="text-[#252525] text-[14px] font-bold">Sticker sheet {batch ? `— batch ${batch}` : ""} ({items.length})</div>
        <button type="button" onClick={() => window.print()} className="rounded-[10px] bg-[#308BF9] text-white text-[12px] font-semibold px-4 py-2 cursor-pointer">Print</button>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
        {items.map((q) => (
          <div key={q.id} className="border border-[#E1E6ED] rounded-[8px] p-3 flex flex-col items-center gap-1 break-inside-avoid">
            <QRCodeSVG value={`${STICKER_BASE}/${q.id}`} size={140} level="M" includeMargin={false} />
            <div className="text-[#252525] text-[16px] font-bold font-mono tracking-[2px] mt-1">{q.id}</div>
            <div className="text-[#A1A1A1] text-[9px]">Scan to get Rysflo</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StickerPrintPage() {
  return (
    <Suspense fallback={null}>
      <Sheet />
    </Suspense>
  );
}
