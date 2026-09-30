"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { listQrService } from "@/services/commissionService";
import { buildQrPoster } from "@/lib/qrPoster";

// Either "https://rysflo.com/buy/?q=" (website) or "https://admin.rysflo.com/q/" (dashboard fallback).
const STICKER_BASE = process.env.NEXT_PUBLIC_STICKER_BASE_URL || "https://rysflo.com/buy/?q=";
const stickerUrl = (id) =>
  (/[?=&]$/.test(STICKER_BASE) ? STICKER_BASE : STICKER_BASE.replace(/\/+$/, "") + "/") + id;

/**
 * Print sheet of branded posters, one per sticker, one per page.
 *
 * This is what the field team carries. Stickers are printed before anyone knows
 * which gym they will belong to — the mapping happens later, in the database —
 * so every sheet is identical apart from the QR and the id in its footer, and a
 * single run serves every partner.
 *
 * Posters build on their own as soon as the list loads. They are drawn one at a
 * time through a single reusable 1000px QR canvas: rendering one canvas per
 * sticker up front would cost ~4MB each and a batch is often fifty.
 */
export default function StickerPosterSheet() {
  const search = useSearchParams();
  const batch = search?.get("batch") || "";

  const [items, setItems] = useState(null); // null = still loading
  const [posters, setPosters] = useState([]);
  const [failed, setFailed] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await listQrService({});
        const rows = (res.items || []).filter((q) => !batch || q.batch_id === batch);
        if (alive) setItems(rows);
      } catch {
        if (alive) {
          setItems([]);
          setFailed(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [batch]);

  // The sticker the hidden QR is currently showing is the next one to build.
  const cursor = posters.length;
  const current = items && cursor < items.length ? items[cursor] : null;

  useEffect(() => {
    if (!current) return;
    let alive = true;
    (async () => {
      const cv = qrRef.current?.querySelector("canvas");
      if (!cv) return;
      try {
        const url = await buildQrPoster(cv, {
          stickerId: current.id,
          url: stickerUrl(current.id),
          kind: "facility",
        });
        if (alive) setPosters((p) => (p.length === cursor ? [...p, { id: current.id, url }] : p));
      } catch {
        // Skip the one that failed rather than stalling the whole sheet.
        if (alive) setPosters((p) => (p.length === cursor ? [...p, { id: current.id, url: null }] : p));
      }
    })();
    return () => {
      alive = false;
    };
  }, [current, cursor]);

  const total = items?.length ?? 0;
  const done = posters.length >= total && total > 0;
  const usable = useMemo(() => posters.filter((p) => p.url), [posters]);

  return (
    <div className="bg-white min-h-screen p-6 print:p-0">
      <style>{`
        @media print {
          .no-print { display: none }
          @page { margin: 0; size: A4 portrait }
          .poster { break-after: page; page-break-after: always }
          .poster:last-child { break-after: auto; page-break-after: auto }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[#252525] text-[14px] font-bold">
            Sticker posters {batch ? `— batch ${batch}` : ""}
          </div>
          <div className="text-[#535359] text-[12px] mt-0.5">
            {items === null
              ? "Loading stickers…"
              : failed
              ? "Could not load your stickers. Refresh to try again."
              : total === 0
              ? "No stickers here yet."
              : done
              ? `${usable.length} poster${usable.length === 1 ? "" : "s"}, one per page. Print at 100% scale, no fit-to-page.`
              : `Building posters… ${posters.length} of ${total}`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!done || usable.length === 0}
          className="rounded-[10px] bg-[#308BF9] text-white text-[12px] font-semibold px-4 py-2 disabled:opacity-50 cursor-pointer"
        >
          Print
        </button>
      </div>

      {/* One reusable canvas, off-screen: the source every poster is drawn from. */}
      <div ref={qrRef} className="absolute -left-[9999px] top-0" aria-hidden="true">
        {current && <QRCodeCanvas value={stickerUrl(current.id)} size={1000} level="M" includeMargin />}
      </div>

      {!done && total > 0 && (
        <div className="no-print h-1.5 w-full max-w-[420px] rounded-full bg-[#EEF4FE] overflow-hidden">
          <div
            className="h-full bg-[#308BF9] transition-[width] duration-200"
            style={{ width: `${Math.round((posters.length / total) * 100)}%` }}
          />
        </div>
      )}

      <div className="flex flex-col items-center gap-6 print:gap-0">
        {usable.map((p) => (
          <img
            key={p.id}
            src={p.url}
            alt={`Rysflo poster for sticker ${p.id}`}
            className="poster w-full max-w-[520px] print:max-w-none border border-[#E1E6ED] print:border-0"
          />
        ))}
      </div>
    </div>
  );
}
