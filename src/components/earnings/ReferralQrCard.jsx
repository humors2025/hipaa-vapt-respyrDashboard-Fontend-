"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { fetchEarningsSummaryService } from "@/services/commissionService";

/**
 * The referral QR code for the signed-in payee. Shared by trainer, facility
 * admin and trainer admin.
 *
 * Two kinds of QR resolve to the same code:
 *  - a printed sticker (?q=<sticker id>) that a trainer admin mapped to this
 *    payee in the field — shown first, pixel-identical to the one on the wall;
 *  - the code link (?code=<partner code>) — text only, for sharing or typing
 *    at checkout. Never rendered as a QR: printed QR codes are issued and
 *    mapped by Rysflo, so what's on a wall is always a tracked sticker.
 * Both start Stripe Checkout with the code attached; the sticker is resolved
 * server-side, so re-mapping it never requires a reprint.
 */

// Either "https://rysflo.com/buy/?code=" (website) or "https://admin.rysflo.com/order/" (dashboard fallback).
const ORDER_BASE = process.env.NEXT_PUBLIC_ORDER_BASE_URL || "https://rysflo.com/buy/?code=";
const STICKER_BASE = process.env.NEXT_PUBLIC_STICKER_BASE_URL || "https://rysflo.com/buy/?q=";
const joinUrl = (base, id) => (/[?=&]$/.test(base) ? base : base.replace(/\/+$/, "") + "/") + encodeURIComponent(id);

function QrBlock({ value, filename, size = 220 }) {
  const ref = useRef(null);
  const download = () => {
    const canvas = ref.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename;
    a.click();
  };
  return (
    <div className="flex flex-col items-center gap-2 self-center md:self-start">
      <div ref={ref} className="bg-white rounded-[10px] border border-[#E1E6ED] p-4">
        <QRCodeCanvas value={value} size={size} level="M" includeMargin />
      </div>
      <button type="button" onClick={download} className="rounded-[10px] bg-[#EEF4FE] text-[#308BF9] text-[12px] font-semibold px-4 py-2 cursor-pointer">
        Download PNG
      </button>
    </div>
  );
}

const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copied");
  } catch {
    toast.error("Copy failed — select the link and copy it manually");
  }
};

const LABEL = "text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide";

/**
 * codeQr: render the partner code itself as a QR. Trainers: yes — they print
 * or download it for their own clients. Facilities: no — a gym's wall QR is
 * always a Rysflo-issued sticker so every print is tracked by sticker ID.
 */
export default function ReferralQrCard({ title = "Your referral QR code", subtitle, codeQr = false }) {
  const [code, setCode] = useState(null);
  const [facility, setFacility] = useState(null);
  const [stickers, setStickers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchEarningsSummaryService();
        setCode(s.partner_code);
        setFacility(s.facility);
        setStickers(Array.isArray(s.stickers) ? s.stickers : []);
      } catch (err) {
        toast.error(err?.message || "Could not load your code");
      }
    })();
  }, []);

  const url = code ? joinUrl(ORDER_BASE, code) : "";
  const hasStickers = stickers.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">{title}</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          {subtitle ||
            "The sticker on your wall and your share link both credit sign-ups to you."}
        </p>
      </div>

      {!code ? (
        <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div>
      ) : (
        <>
          {hasStickers && (
            <div className="rounded-[15px] border border-[#E1E6ED] bg-white p-5 flex flex-col gap-4">
              <div>
                <div className={LABEL}>Your QR code{stickers.length > 1 ? "s" : ""}</div>
                <p className="text-[#535359] text-[12px] mt-1">
                  {stickers.length > 1 ? "These are the printed stickers" : "This is the printed sticker"} Rysflo mapped to{" "}
                  {facility?.name || "you"}. It&rsquo;s the exact code on your wall — print more copies from here and they all count for you.
                </p>
              </div>
              <div className="flex flex-col gap-6">
                {stickers.map((st) => {
                  const surl = joinUrl(STICKER_BASE, st.id);
                  return (
                    <div key={st.id} className="flex flex-col md:flex-row gap-6 items-start">
                      <QrBlock value={surl} filename={`rysflo-sticker-${st.id}.png`} />
                      <div className="flex flex-col gap-3 flex-1 min-w-0">
                        <div>
                          <div className={LABEL}>Sticker ID</div>
                          <div className="text-[#252525] text-[22px] font-bold font-mono">{st.id}</div>
                          {st.label && <div className="text-[#535359] text-[12px]">{st.label}</div>}
                        </div>
                        <div>
                          <div className={LABEL}>Sticker link</div>
                          <div className="text-[#308BF9] text-[13px] break-all select-all">{surl}</div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" onClick={() => copy(surl)} className="rounded-[10px] bg-[#308BF9] text-white text-[12px] font-semibold px-4 py-2 cursor-pointer">
                            Copy link
                          </button>
                        </div>
                        <div className="text-[#A1A1A1] text-[11px]">
                          {st.scans} scan{st.scans === 1 ? "" : "s"} so far
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasStickers ? (
            <div className="rounded-[15px] border border-[#E1E6ED] bg-white p-5 flex flex-col gap-3">
              <div>
                <div className={LABEL}>Your gym code</div>
                <div className="text-[#252525] text-[22px] font-bold font-mono">{code}</div>
                {facility?.name && <div className="text-[#535359] text-[12px]">{facility.name}</div>}
              </div>
              <p className="text-[#535359] text-[12px]">
                The sticker above is mapped to this code. Members can also type it at checkout, or use the link below in messages, email or social — same result.
              </p>
              <div>
                <div className={LABEL}>Share link</div>
                <div className="text-[#308BF9] text-[13px] break-all select-all">{url}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => copy(url)} className="rounded-[10px] bg-[#EEF4FE] text-[#308BF9] text-[12px] font-semibold px-4 py-2 cursor-pointer">
                  Copy link
                </button>
              </div>
              <p className="text-[#A1A1A1] text-[11px]">
                Members pay $29/month for the Rysflo device and app. Every reading they take earns them 20¢ off the next month, up to $6.
              </p>
            </div>
          ) : codeQr ? (
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <QrBlock value={url} filename={`rysflo-${code}.png`} />
              <div className="flex flex-col gap-3 flex-1 min-w-0">
                <div>
                  <div className={LABEL}>Your code</div>
                  <div className="text-[#252525] text-[22px] font-bold font-mono">{code}</div>
                  {facility?.name && <div className="text-[#535359] text-[12px]">{facility.name}</div>}
                </div>
                <div>
                  <div className={LABEL}>Sign-up link</div>
                  <div className="text-[#308BF9] text-[13px] break-all select-all">{url}</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={() => copy(url)} className="rounded-[10px] bg-[#308BF9] text-white text-[12px] font-semibold px-4 py-2 cursor-pointer">
                    Copy link
                  </button>
                </div>
                <p className="text-[#A1A1A1] text-[11px]">
                  Print it or download it and let your clients scan. Members pay $29/month for the Rysflo device and app; every reading earns them 20¢ off the next month, up to $6.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-[15px] border border-dashed border-[#E1E6ED] bg-white p-5 flex flex-col gap-3">
              <div>
                <div className={LABEL}>No QR sticker assigned yet</div>
                <p className="text-[#535359] text-[12px] mt-1">
                  Rysflo issues printed QR stickers and maps one to {facility?.name || "you"}. Once your Rysflo contact sets it up it appears here. Until then members can sign up with your code or link.
                </p>
              </div>
              <div>
                <div className={LABEL}>Your code</div>
                <div className="text-[#252525] text-[22px] font-bold font-mono">{code}</div>
                {facility?.name && <div className="text-[#535359] text-[12px]">{facility.name}</div>}
              </div>
              <div>
                <div className={LABEL}>Share link</div>
                <div className="text-[#308BF9] text-[13px] break-all select-all">{url}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => copy(url)} className="rounded-[10px] bg-[#EEF4FE] text-[#308BF9] text-[12px] font-semibold px-4 py-2 cursor-pointer">
                  Copy link
                </button>
              </div>
              <p className="text-[#A1A1A1] text-[11px]">
                Members pay $29/month for the Rysflo device and app. Every reading they take earns them 20¢ off the next month, up to $6.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
