"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchOrderSessionStatusService } from "@/services/commissionService";

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || "https://apps.apple.com/app/rysflo";
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || "https://play.google.com/store/apps/details?id=com.rysflo";

/**
 * After Stripe Checkout. Shows the purchase code the member enters in the app
 * (the webhook can lag a few seconds, so we poll briefly).
 */
export default function SuccessContent() {
  const search = useSearchParams();
  const sessionId = search?.get("session_id") || "";
  const [st, setSt] = useState(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchOrderSessionStatusService({ sessionId });
        if (cancelled) return;
        setSt(r);
        if (r.pending && tries < 8) setTimeout(() => setTries((t) => t + 1), 1500);
      } catch {
        if (!cancelled) setSt({ paid: true, purchase_code: null, pending: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, tries]);

  const code = st?.purchase_code;

  return (
    <main className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-[16px] p-8 max-w-[560px] w-full flex flex-col gap-5">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#E5F6EE] text-[#1F7A4A] text-[22px] flex items-center justify-center">✓</div>
          <h1 className="text-[#252525] text-[24px] font-bold mt-3">You&rsquo;re in.</h1>
          <p className="text-[#535359] text-[14px] mt-1">Your membership is active and your device is on its way.</p>
        </div>

        {st?.already_linked ? (
          <div className="rounded-[10px] bg-[#E5F6EE] px-4 py-3 text-[13px] text-[#1F7A4A] text-center">
            Your purchase is already linked to your Rysflo app account. Nothing else to do.
          </div>
        ) : (
          <div className="rounded-[10px] bg-[#EEF4FE] p-5 flex flex-col gap-2 items-center">
            <div className="text-[#1F4E8C] text-[12px] font-semibold uppercase tracking-wide">Your Rysflo code</div>
            {code ? (
              <div className="text-[#1F4E8C] text-[34px] font-bold font-mono tracking-[3px]">{code}</div>
            ) : (
              <div className="text-[#1F4E8C] text-[14px]">{st?.pending || !st ? "Generating your code…" : "Your code is in your email."}</div>
            )}
            <div className="text-[#1F4E8C] text-[12px] text-center">
              Enter this in the Rysflo app when it asks for a code. We&rsquo;ve also emailed it{st?.email ? ` to ${st.email}` : ""}.
            </div>
          </div>
        )}

        <ol className="text-left text-[#535359] text-[13px] flex flex-col gap-2 list-decimal pl-5">
          <li>
            Download Rysflo — <a className="text-[#308BF9] font-semibold" href={APP_STORE_URL}>iPhone</a> ·{" "}
            <a className="text-[#308BF9] font-semibold" href={PLAY_STORE_URL}>Android</a>
          </li>
          <li>Create your account{st?.email ? <> with <strong>{st.email}</strong></> : null}.</li>
          {!st?.already_linked && <li>Enter the code above when asked.</li>}
          <li>When the device arrives, pair it and take your first reading. Every reading day takes 20¢ off next month&rsquo;s bill.</li>
        </ol>
        <p className="text-[#A1A1A1] text-[11px] text-center">Questions? Reply to your receipt email and we&rsquo;ll help.</p>
      </div>
    </main>
  );
}
