"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { fetchEarningsSummaryService } from "@/services/commissionService";

/**
 * The referral QR code for the signed-in payee's partner code. Points at the
 * public order page, which starts Stripe Checkout with the code attached.
 * Shared by trainer, facility admin and trainer admin.
 */

// Either "https://rysflo.com/buy/?code=" (website) or "https://admin.rysflo.com/order/" (dashboard fallback).
const ORDER_BASE = process.env.NEXT_PUBLIC_ORDER_BASE_URL || "https://rysflo.com/buy/?code=";
const joinUrl = (base, id) => (/[?=&]$/.test(base) ? base : base.replace(/\/+$/, "") + "/") + encodeURIComponent(id);

export default function ReferralQrCard({ title = "Your referral QR code", subtitle }) {
  const [code, setCode] = useState(null);
  const [facility, setFacility] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchEarningsSummaryService();
        setCode(s.partner_code);
        setFacility(s.facility);
      } catch (err) {
        toast.error(err?.message || "Could not load your code");
      }
    })();
  }, []);

  const url = code ? joinUrl(ORDER_BASE, code) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed — select the link and copy it manually");
    }
  };

  const download = () => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `rysflo-${code}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">{title}</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          {subtitle ||
            "Print it, put it on the wall or the front desk, or share the link. Anyone who signs up through it is credited to you."}
        </p>
      </div>

      {!code ? (
        <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div ref={canvasRef} className="bg-white rounded-[10px] border border-[#E1E6ED] p-4 self-center md:self-start">
            <QRCodeCanvas value={url} size={220} level="M" includeMargin />
          </div>
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <div>
              <div className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide">Referral code</div>
              <div className="text-[#252525] text-[22px] font-bold font-mono">{code}</div>
              {facility?.name && <div className="text-[#535359] text-[12px]">{facility.name}</div>}
            </div>
            <div>
              <div className="text-[#A1A1A1] text-[11px] font-semibold uppercase tracking-wide">Sign-up link</div>
              <div className="text-[#308BF9] text-[13px] break-all select-all">{url}</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={copy} className="rounded-[10px] bg-[#308BF9] text-white text-[12px] font-semibold px-4 py-2 cursor-pointer">
                Copy link
              </button>
              <button type="button" onClick={download} className="rounded-[10px] bg-[#EEF4FE] text-[#308BF9] text-[12px] font-semibold px-4 py-2 cursor-pointer">
                Download PNG
              </button>
            </div>
            <p className="text-[#A1A1A1] text-[11px]">
              Members pay $29/month for the Rysflo device and app. Every reading they take earns them 20¢ off the next month, up to $6.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
