"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  fetchSettingsLockStatusService,
  requestSettingsCodeService,
  verifySettingsCodeService,
  startSettingsMfaSetupService,
  confirmSettingsMfaSetupService,
  verifySettingsMfaService,
} from "@/services/commissionService";

/**
 * Google Authenticator gate for Super Admin › Settings. The backend owns the
 * lock: the unlock is tied to this login session (ends on logout, capped
 * server-side) and set-pricing / set-commission-rate refuse with
 * SETTINGS_LOCKED without it.
 *
 * Stages: first visit -> email code (proves the admin may enrol) -> scan QR
 * and confirm an app code -> save backup codes. Later visits -> app code only.
 * children is a render function receiving `relock`, for a SETTINGS_LOCKED error.
 */
export const isSettingsLocked = (err) => err?.status === 403 && err?.data?.code === "SETTINGS_LOCKED";

const field = "rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2 text-[18px] tracking-[6px] text-center text-[#252525] focus:outline-none focus:border-[#308BF9]";
const primary = "rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-4 py-2 disabled:opacity-50 cursor-pointer";
const link = "text-[#308BF9] text-[12px] font-semibold disabled:text-[#A1A1A1] cursor-pointer";

function CodeForm({ value, onChange, onSubmit, busy, label, placeholder = "••••••", allowBackup = false, submitText }) {
  const ok = allowBackup ? /^\d{6}$|^[0-9a-f]{4}-?[0-9a-f]{4}$/i.test(value) : /^\d{6}$/.test(value);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ok && !busy) onSubmit(); }} className="flex flex-col gap-3">
      <input
        value={value}
        onChange={(e) => onChange(allowBackup ? e.target.value.replace(/[^0-9a-fA-F-]/g, "").slice(0, 9) : e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode={allowBackup ? "text" : "numeric"}
        autoComplete="one-time-code"
        autoFocus
        placeholder={placeholder}
        aria-label={label}
        className={field}
      />
      <button type="submit" disabled={busy || !ok} className={primary}>{busy ? "Checking…" : submitText}</button>
    </form>
  );
}

export default function SettingsLockGate({ children }) {
  // checking | error | email | setup | backup | app | unlocked
  const [stage, setStage] = useState("checking");
  const [sentTo, setSentTo] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [setup, setSetup] = useState(null); // { secret, otpauth_url }
  const [backupCodes, setBackupCodes] = useState([]);

  const check = useCallback(async () => {
    setStage("checking");
    setCode("");
    try {
      const d = await fetchSettingsLockStatusService();
      setSentTo(d.sent_to || "");
      if (d.mfa_enrolled) setStage(d.unlocked ? "unlocked" : "app");
      else setStage(d.unlocked ? "setup" : "email");
    } catch (err) {
      toast.error(err?.message || "Could not check settings access");
      setStage("error");
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

  // Fetch a QR secret when the setup stage opens.
  useEffect(() => {
    if (stage !== "setup" || setup) return;
    startSettingsMfaSetupService()
      .then((d) => setSetup({ secret: d.secret, otpauth_url: d.otpauth_url }))
      .catch((err) => {
        toast.error(err?.message || "Could not start Google Authenticator setup");
        check();
      });
  }, [stage, setup, check]);

  const relock = useCallback(() => {
    toast.error("Settings access expired. Enter a new code.");
    check();
  }, [check]);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const sendEmailCode = () => run(async () => {
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
    }
  });

  const verifyEmailCode = () => run(async () => {
    try {
      await verifySettingsCodeService({ code });
      setCode("");
      setStage("setup");
    } catch (err) {
      toast.error(err?.message || "Incorrect code");
      if (err?.data?.reason && err.data.reason !== "mismatch") {
        setCodeSent(false);
        setCode("");
      }
    }
  });

  const confirmSetup = () => run(async () => {
    try {
      const d = await confirmSettingsMfaSetupService({ code });
      setCode("");
      setSetup(null);
      setBackupCodes(d.backup_codes || []);
      setStage("backup");
    } catch (err) {
      toast.error(err?.message || "Incorrect code");
      if (err?.data?.reason === "not_found") setSetup(null);
    }
  });

  const verifyApp = () => run(async () => {
    try {
      const d = await verifySettingsMfaService({ code });
      setCode("");
      if (d.used_backup) toast.warning(`Backup code used. ${d.backup_codes_left} left.`);
      else toast.success("Settings unlocked");
      setStage("unlocked");
    } catch (err) {
      toast.error(err?.message || "Incorrect code");
      if (err?.data?.code === "MFA_NOT_ENROLLED") check();
    }
  });

  if (stage === "unlocked") return children(relock);

  const copyBackup = () => {
    navigator.clipboard?.writeText(backupCodes.join("\n")).then(
      () => toast.success("Backup codes copied"),
      () => toast.error("Could not copy")
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[#252525] text-[20px] font-bold">Settings</h1>
        <p className="text-[#535359] text-[13px] mt-1">Platform-wide configuration for the referral programme.</p>
      </div>

      <section className="bg-white rounded-[15px] p-6 flex flex-col gap-4 max-w-[440px]">
        {stage === "checking" && <p className="text-[#535359] text-[12px]">Checking access…</p>}

        {stage === "error" && (
          <>
            <h2 className="text-[#252525] text-[14px] font-bold">Settings are locked</h2>
            <button type="button" onClick={check} className={primary}>Try again</button>
          </>
        )}

        {stage === "app" && (
          <>
            <div>
              <h2 className="text-[#252525] text-[14px] font-bold">Settings are locked</h2>
              <p className="text-[#535359] text-[12px] mt-1">
                Enter the 6-digit code from Google Authenticator (under &ldquo;Rysflo Settings&rdquo;). Lost your phone? Enter one of your backup codes instead. Access stays open until you log out.
              </p>
            </div>
            <CodeForm value={code} onChange={setCode} onSubmit={verifyApp} busy={busy} label="Authenticator or backup code" allowBackup submitText="Unlock settings" />
          </>
        )}

        {stage === "email" && (
          <>
            <div>
              <h2 className="text-[#252525] text-[14px] font-bold">Set up Google Authenticator</h2>
              <p className="text-[#535359] text-[12px] mt-1">
                Settings are protected with Google Authenticator. To set it up, first enter the 6-digit code emailed to {sentTo || "the settings inbox"}.
              </p>
            </div>
            {!codeSent ? (
              <button type="button" onClick={sendEmailCode} disabled={busy} className={primary}>{busy ? "Sending…" : "Send email code"}</button>
            ) : (
              <>
                <CodeForm value={code} onChange={setCode} onSubmit={verifyEmailCode} busy={busy} label="6-digit email code" submitText="Continue" />
                <button type="button" onClick={sendEmailCode} disabled={busy || cooldown > 0} className={link}>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
              </>
            )}
          </>
        )}

        {stage === "setup" && (
          <>
            <div>
              <h2 className="text-[#252525] text-[14px] font-bold">Scan with Google Authenticator</h2>
              <p className="text-[#535359] text-[12px] mt-1">
                In Google Authenticator tap <b>+</b> › <b>Scan a QR code</b>, then enter the 6-digit code it shows.
              </p>
            </div>
            {setup ? (
              <>
                <div className="self-center p-3 bg-white border border-[#E1E6ED] rounded-[10px]">
                  <QRCodeSVG value={setup.otpauth_url} size={180} />
                </div>
                <p className="text-[#A1A1A1] text-[11px] text-center break-all">
                  Can&rsquo;t scan? Choose &ldquo;Enter a setup key&rdquo; and type: <span className="font-mono text-[#535359]">{setup.secret}</span>
                </p>
                <CodeForm value={code} onChange={setCode} onSubmit={confirmSetup} busy={busy} label="6-digit app code" submitText="Verify and turn on" />
              </>
            ) : (
              <p className="text-[#535359] text-[12px]">Preparing QR code…</p>
            )}
          </>
        )}

        {stage === "backup" && (
          <>
            <div>
              <h2 className="text-[#252525] text-[14px] font-bold">Save your backup codes</h2>
              <p className="text-[#535359] text-[12px] mt-1">
                Google Authenticator is on. If you lose your phone, each of these codes unlocks Settings once. They are shown only now — store them somewhere safe.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-[14px] text-[#252525] bg-[#F5F7FA] rounded-[10px] p-4">
              {backupCodes.map((c) => <span key={c} className="text-center">{c}</span>)}
            </div>
            <button type="button" onClick={copyBackup} className={link}>Copy codes</button>
            <button type="button" onClick={() => setStage("unlocked")} className={primary}>I&rsquo;ve saved them — open Settings</button>
          </>
        )}
      </section>
    </div>
  );
}
