"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchSettingsLockStatusService, requestSettingsCodeService, verifySettingsCodeService } from "@/services/commissionService";

/**
 * Email-code gate for Super Admin › Settings. The backend owns the lock: the
 * unlock is tied to this login session (ends on logout, capped server-side)
 * and set-pricing / set-commission-rate refuse with SETTINGS_LOCKED without it.
 * children is a render function receiving `relock`, for a SETTINGS_LOCKED error.
 */
export const isSettingsLocked = (err) => err?.status === 403 && err?.data?.code === "SETTINGS_LOCKED";

export default function SettingsLockGate({ children }) {
  const [state, setState] = useState("checking"); // checking | locked | unlocked | error
  const [sentTo, setSentTo] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const check = useCallback(async () => {
    setState("checking");
    try {
      const d = await fetchSettingsLockStatusService();
      setSentTo(d.sent_to || "");
      setState(d.unlocked ? "unlocked" : "locked");
    } catch (err) {
      toast.error(err?.message || "Could not check settings access");
      setState("error");
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const relock = useCallback(() => {
    toast.error("Settings access expired. Enter a new code.");
    setCodeSent(false);
    setCode("");
    setState("locked");
  }, []);

  const sendCode = async () => {
    if (busy || cooldown > 0) return;
    setBusy(true);
    try {
      const d = await requestSettingsCodeService();
      setSentTo(d.sent_to || sentTo);
      setCodeSent(true);
      setCooldown(60);
      toast.success(`Code sent to ${d.sent_to || "the settings inbox"}`);
    } catch (err) {
      if (err?.data?.retry_after_seconds) {
        setCooldown(err.data.retry_after_seconds);
        setCodeSent(true);
      }
      toast.error(err?.message || "Could not send the code");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    if (busy || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    try {
      await verifySettingsCodeService({ code });
      toast.success("Settings unlocked");
      setCode("");
      setState("unlocked");
    } catch (err) {
      toast.error(err?.message || "Incorrect code");
      if (err?.data?.reason && err.data.reason !== "mismatch") {
        setCodeSent(false);
        setCode("");
      }
    } finally {
      setBusy(false);
    }
  };

  if (state === "unlocked") return children(relock);

  const field = "rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[18px] tracking-[6px] text-center text-[#252525] focus:outline-none focus:border-[#308BF9]";
  const primary = "rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-4 py-2 disabled:opacity-50 cursor-pointer";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[#252525] text-[20px] font-bold">Settings</h1>
        <p className="text-[#535359] text-[13px] mt-1">Platform-wide configuration for the referral programme.</p>
      </div>

      <section className="bg-white rounded-[15px] p-6 flex flex-col gap-4 max-w-[440px]">
        <div>
          <h2 className="text-[#252525] text-[14px] font-bold">Settings are locked</h2>
          <p className="text-[#535359] text-[12px] mt-1">
            {state === "checking"
              ? "Checking access…"
              : `To change pricing or the commission rate, enter the 6-digit code sent to ${sentTo || "the settings inbox"}. Access stays open until you log out.`}
          </p>
        </div>

        {state === "error" && (
          <button type="button" onClick={check} className={primary}>Try again</button>
        )}

        {state === "locked" && !codeSent && (
          <button type="button" onClick={sendCode} disabled={busy} className={primary}>
            {busy ? "Sending…" : "Send code"}
          </button>
        )}

        {state === "locked" && codeSent && (
          <form onSubmit={verify} className="flex flex-col gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="••••••"
              aria-label="6-digit code"
              className={field}
            />
            <button type="submit" disabled={busy || code.length !== 6} className={primary}>
              {busy ? "Checking…" : "Unlock settings"}
            </button>
            <button type="button" onClick={sendCode} disabled={busy || cooldown > 0} className="text-[#308BF9] text-[12px] font-semibold disabled:text-[#A1A1A1] cursor-pointer">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
