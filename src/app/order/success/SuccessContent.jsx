"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchOrderSessionStatusService } from "@/services/commissionService";

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || "https://apps.apple.com/app/rysflo";
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || "https://play.google.com/store/apps/details?id=com.rysflo";

/* ------------------------------------------------------------------ icons */

function IconCheck({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
function IconKey({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="M10.85 12.15L19 4m-2 2l2 2m-5 1l2 2" />
    </svg>
  );
}
function IconCopy({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  );
}
function IconApple({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}
function IconAndroid({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4483-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993 0 .5511-.4483.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396" />
    </svg>
  );
}
function IconCoin({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.9-2.5 2s1.1 2 2.5 2 2.5.9 2.5 2-1.1 2-2.5 2a2.5 2.5 0 0 1-2.5-1.5M12 6.5v1.5m0 8v1.5" />
    </svg>
  );
}

/* ------------------------------------------------------------ copy button */

/** Copies `text`; falls back to execCommand, then to selecting the code. */
function CopyButton({ text, codeRef }) {
  const [state, setState] = useState("idle"); // idle | copied | selected
  const timer = useRef(null);

  const flash = (s) => {
    setState(s);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1800);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const selectCode = () => {
    try {
      const range = document.createRange();
      range.selectNodeContents(codeRef.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {}
    flash("selected");
  };
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    ok ? flash("copied") : selectCode();
  };
  const onClick = () => {
    if (!text) return;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => flash("copied"), fallback);
    else fallback();
  };

  const copied = state === "copied";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!text}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        copied ? "border-[#1F7A4A] bg-[#E5F6EE] text-[#1F7A4A]" : "border-[#308BF9]/30 bg-white text-[#308BF9] hover:bg-[#EEF4FE]"
      }`}
    >
      {copied ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "selected" ? "Selected" : "Copy"}</span>
    </button>
  );
}

/* ------------------------------------------------------------------- page */

/**
 * After Stripe Checkout. Shows the purchase code the member enters in the app
 * (the webhook can lag a few seconds, so we poll briefly).
 */
export default function SuccessContent() {
  const search = useSearchParams();
  const sessionId = search?.get("session_id") || "";
  const [st, setSt] = useState(null);
  const [tries, setTries] = useState(0);
  const codeRef = useRef(null);

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

  const code = st?.purchase_code || "";
  const email = st?.email || "";
  const linked = !!st?.already_linked;

  const steps = [
    {
      body: <p>Download Rysflo on your phone.</p>,
      extra: (
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={APP_STORE_URL} className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E1E6ED] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#252525] hover:border-[#308BF9] hover:text-[#308BF9] transition-colors">
            <IconApple className="h-4 w-4" /> iPhone
          </a>
          <a href={PLAY_STORE_URL} className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E1E6ED] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#252525] hover:border-[#308BF9] hover:text-[#308BF9] transition-colors">
            <IconAndroid className="h-4 w-4" /> Android
          </a>
        </div>
      ),
    },
    {
      body: (
        <p>
          Create your account{email ? <> with <strong className="font-semibold text-[#252525] break-all">{email}</strong></> : null}.
        </p>
      ),
    },
    ...(linked ? [] : [{ body: <p>Enter the code above when asked.</p> }]),
    {
      body: <p>When the device arrives, pair it and take your first reading.</p>,
      extra: (
        <span className="mt-2 inline-flex items-start gap-1.5 rounded-[8px] bg-[#E5F6EE] px-2.5 py-1.5 text-[12px] text-[#1F7A4A]">
          <IconCoin className="mt-[1px] h-3.5 w-3.5 shrink-0" />
          <span>
            Every reading day takes <strong className="font-semibold">20&cent; off</strong> next month&rsquo;s bill.
          </span>
        </span>
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-[#F5F7FA] flex items-start sm:items-center justify-center px-4 py-6 sm:py-10">
      <article aria-labelledby="page-title" className="w-full max-w-[560px] overflow-hidden rounded-[16px] bg-white shadow-[0px_4px_10px_rgba(0,0,0,0.06)]">
        {/* header */}
        <header className="flex items-center justify-between gap-3 border-b border-[#E1E6ED] px-5 py-4 sm:px-8">
          <img src="/icons/rysflo-logo.png" alt="Rysflo" width={120} height={34} className="h-8 w-auto sm:h-9" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E5F6EE] px-3 py-1 text-[11px] font-semibold text-[#1F7A4A] whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1F7A4A]" aria-hidden="true" />
            Membership active
          </span>
        </header>

        <div className="flex flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
          {/* hero */}
          <section className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E5F6EE]" aria-hidden="true">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1F7A4A] text-white">
                <IconCheck className="h-6 w-6" />
              </div>
            </div>
            <h1 id="page-title" className="mt-4 text-[#252525] text-[26px] sm:text-[28px] font-bold leading-tight">
              You&rsquo;re in.
            </h1>
            <p className="mt-1.5 text-[#535359] text-[14px]">Your membership is active and your device is on its way.</p>
          </section>

          {/* code pass */}
          {linked ? (
            <section className="rounded-[12px] bg-[#E5F6EE] px-4 py-3 text-center text-[13px] text-[#1F7A4A]">
              Your purchase is already linked to your Rysflo app account. Nothing else to do.
            </section>
          ) : (
            <section aria-labelledby="pass-label" className="overflow-hidden rounded-[14px] border border-[#308BF9]/20 bg-[#EEF4FE]">
              <div className="px-4 pt-4 pb-3 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <p id="pass-label" className="inline-flex items-center gap-1.5 text-[#1F4E8C] text-[12px] font-semibold uppercase tracking-wide">
                    <IconKey className="h-4 w-4" />
                    Your Rysflo Redeem code
                  </p>
                  <CopyButton text={code} codeRef={codeRef} />
                </div>
                {code ? (
                  <p ref={codeRef} className="mt-2 text-[#1F4E8C] text-[26px] sm:text-[34px] font-bold font-mono tracking-[2px] sm:tracking-[3px] break-all select-all">
                    {code}
                  </p>
                ) : (
                  <p className="mt-2 text-[#1F4E8C] text-[14px]">{st?.pending || !st ? "Generating your code…" : "Your code is in your email."}</p>
                )}
              </div>
              <div className="border-t border-dashed border-[#308BF9]/30" aria-hidden="true" />
              <div className="px-4 py-3 sm:px-5 text-[#1F4E8C] text-[12px]">
                Enter this in the Rysflo app when it asks for a code. We&rsquo;ve also emailed it
                {email ? <> to <strong className="font-semibold break-all">{email}</strong></> : null}.
              </div>
            </section>
          )}

          {/* steps */}
          <section aria-labelledby="steps-title">
            <h2 id="steps-title" className="text-[#738298] text-[12px] font-semibold uppercase tracking-wide">
              Next steps
            </h2>
            <ol className="mt-3 flex flex-col">
              {steps.map((s, i) => {
                const last = i === steps.length - 1;
                return (
                  <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                    {!last && <span className="absolute left-[13px] top-7 bottom-0 w-px bg-[#E1E6ED]" aria-hidden="true" />}
                    <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#308BF9] text-white text-[12px] font-semibold" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 pt-1 text-[#535359] text-[13px] leading-relaxed">
                      {s.body}
                      {s.extra}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <footer className="border-t border-[#E1E6ED] pt-4 text-center text-[#A1A1A1] text-[11px]">
            Questions? Reply to your receipt email and we&rsquo;ll help.
          </footer>
        </div>
      </article>
    </main>
  );
}
