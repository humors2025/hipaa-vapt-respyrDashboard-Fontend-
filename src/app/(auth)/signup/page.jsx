"use client";

// Signup / accept-invite page.
//
// Entry: /signup?token=...
// Invite details (name, email, role, ...) are fetched from invite-preview API.
// UI redesigned to match the Respyr "Web Portal Invitation" modal.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { cookieManager } from "@/lib/cookies";
import { previewInviteService, acceptInviteService } from "@/services/authService";
import Agreement from "@/components/agreement";

/* ---------------- Icons ---------------- */

const RespyrIcon = () => (
  <div className="w-[38px] h-[38px] bg-[#308bf9] rounded-[15px] flex items-center justify-center flex-shrink-0">
    <svg width="22" height="22" fill="none" viewBox="0 0 14.72 14.72">
      <path
        d="M6.13672 2.76172C5.59351 2.40874 5.01877 2.51886 4.59766 2.79004C4.21236 3.03824 3.91039 3.43568 3.69141 3.83301C3.25848 4.6186 2.96806 5.74033 3.16309 6.66113C3.2652 7.14297 3.52121 7.6456 4.04199 7.94434C4.20931 8.04026 4.38824 8.10647 4.57617 8.14551C4.2926 8.9109 3.98883 9.62245 3.74707 10.1494C3.57702 10.5203 3.74022 10.9589 4.11133 11.1289C4.48246 11.2988 4.92166 11.1355 5.0918 10.7646C5.4134 10.0636 5.84766 9.03289 6.21191 7.95605C6.95897 7.68793 7.85928 7.17522 8.94238 6.36523C8.73222 6.97038 8.55456 7.58863 8.4375 8.17969C8.27486 9.00094 8.21088 9.86107 8.41699 10.585C8.52328 10.9582 8.70845 11.3181 9.00781 11.6084C9.31095 11.9022 9.69408 12.0882 10.1348 12.1689C10.5364 12.2425 10.9215 11.9765 10.9951 11.5752C11.0686 11.174 10.8029 10.7894 10.4014 10.7158C10.2148 10.6817 10.1073 10.6158 10.0371 10.5479C9.96312 10.4761 9.89179 10.363 9.83984 10.1807C9.72957 9.79343 9.74074 9.20903 9.8877 8.4668C10.1777 7.00224 10.9211 5.27161 11.5293 4.12012C11.6972 3.80217 11.6121 3.40988 11.3271 3.19043C11.0421 2.971 10.6398 2.98798 10.375 3.23145C8.83131 4.6506 7.64164 5.54149 6.74512 6.06641C6.85678 5.53988 6.92654 5.02245 6.92285 4.55859C6.91804 3.95541 6.78389 3.18242 6.13672 2.76172ZM5.37988 4.09375C5.41447 4.18971 5.44252 4.34389 5.44434 4.57031C5.44797 5.02628 5.34518 5.63236 5.16309 6.32227C5.12914 6.45088 5.0929 6.58125 5.05469 6.71191C4.89386 6.71612 4.81117 6.68249 4.77734 6.66309C4.73032 6.63606 4.65518 6.56615 4.61035 6.35449C4.51157 5.88765 4.66386 5.13282 4.9873 4.5459C5.12917 4.28855 5.26805 4.13104 5.36523 4.05566C5.37005 4.06622 5.37464 4.07922 5.37988 4.09375Z"
        fill="white"
      />
    </svg>
  </div>
);

const CheckIcon = ({ size = 9 }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24">
    <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EyeIcon = () => (
  <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

/* ---------------- Constants ---------------- */

const ROLE_HEADINGS = {
  super_admin: "Super-Admin",
  trainer_admin: "Trainer-Admin",
  trainer: "Trainer",
  client: "Client",
};

const BAR_COLORS = { 1: "#e74c3c", 2: "#ffbf2d", 3: "#3faf58" };
const STRENGTH_META = [
  { label: "Weak", color: "#e74c3c" },
  { label: "Fair", color: "#ffbf2d" },
  { label: "Strong", color: "#3faf58" },
];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data:application/pdf;base64,...
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getStrength(val) {
  if (!val) return 0;
  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
  if (/[0-9\W]/.test(val)) score++;
  return score;
}

/* ---------------- Shared shell ---------------- */

const SHELL =
  "w-full max-w-[520px] bg-white rounded-[15px] border border-[#e1e6ed] shadow-[0_10px_40px_rgba(0,0,0,0.08)] overflow-hidden";

function CardHeader() {
  return (
    <div className="px-7 pt-5 pb-[18px] border-b border-[#e1e6ed] flex items-center gap-3">
      <RespyrIcon />
      <div className="flex-1">
        <div className="text-[15px] font-semibold text-[#252525] tracking-[-0.02em] leading-tight">Respyr</div>
        <div className="text-[10px] text-[#738298] tracking-[-0.02em] mt-px">Web Portal Invitation</div>
      </div>
    </div>
  );
}

/* ---------------- Form ---------------- */

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token") || "";
  const hasToken = Boolean(token);

  const [previewLoading, setPreviewLoading] = useState(hasToken);
  const [previewError, setPreviewError] = useState("");
  const [invite, setInvite] = useState(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pwError, setPwError] = useState("");
  const [cfError, setCfError] = useState("");

  // Gate: user must accept the Device Evaluation Agreement before the
  // password / signup form is shown. The signed agreement is captured as a
  // PDF (File) by the Agreement step and submitted with the invite acceptance.
  const [agreed, setAgreed] = useState(false);
  const [agreementPdf, setAgreementPdf] = useState(null);

  useEffect(() => {
    if (!hasToken) {
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await previewInviteService(token);
        if (cancelled) return;
        const data = res?.data || res;
        setInvite(data);
      } catch (err) {
        if (cancelled) return;
        const msg = err?.data?.message || err?.message || "Could not load invitation details.";
        setPreviewError(msg);
        toast.error(msg);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, hasToken]);

  const role = invite?.role || "";
  const roleLabel = ROLE_HEADINGS[role] || role || "";
  const firstName = invite?.first_name || "";
  const lastName = invite?.last_name || "";
  const fullName = invite?.name || [firstName, lastName].filter(Boolean).join(" ");
  const email = invite?.email || "";

  const strength = getStrength(password);

  // Info card is driven by real invite data. Rows only render when present,
  // so partner_code / expires_in simply disappear if your API doesn't return them.
  const phone = invite?.phone_no || "";
  const infoRows = [
    fullName && { label: "Name", value: fullName, valueClass: "text-[#252525]" },
    email && { label: "Email", value: email, valueClass: "text-[#308bf9]" },
    // phone && { label: "Phone", value: phone, valueClass: "text-[#252525]" },
    roleLabel && { label: "Role", badge: roleLabel },
    // invite?.partner_code && { label: "Partner Code", value: invite.partner_code, valueClass: "text-[#252525]" },
    invite?.expires_in && { label: "Expires In", value: invite.expires_in, valueClass: "text-[#e48326]" },
  ].filter(Boolean);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!token) return toast.error("Missing invitation token.");

    let ok = true;
    setPwError("");
    setCfError("");
    if (password.length < 8) {
      setPwError("Password must be at least 8 characters.");
      ok = false;
    }
    if (!confirm) {
      setCfError("Please confirm your password.");
      ok = false;
    } else if (confirm !== password) {
      setCfError("Passwords do not match.");
      ok = false;
    }
    if (!ok) return;

    setSubmitting(true);
    try {
      const payload = {
        token,
        password,
        confirm_password: confirm,
      };

      // Attach the signed agreement PDF (base64 data URL) if it was captured.
      if (agreementPdf) {
        payload.agreement_pdf = await fileToBase64(agreementPdf);
        payload.agreement_pdf_name = agreementPdf.name;
      }

      await acceptInviteService(payload);

      cookieManager.clearAuth();
      toast.success(`Welcome ${firstName || ""}! You're all set.`);
      router.push("/");
    } catch (err) {
      const msg = err?.data?.message || err?.message || "";
      const lower = msg.toLowerCase();
      if (lower.includes("already accepted") || lower.includes("already registered") || lower.includes("already onboarded")) {
        toast.error("This invite has already been accepted. Please sign in instead.");
        router.push("/");
        return;
      } else if (lower.includes("no pending invite") || lower.includes("not found")) {
        toast.error("No pending invitation found for this email. Please check with the person who invited you.");
      } else {
        toast.error(msg || "Could not create your account. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase =
    "w-full h-[42px] bg-white border rounded-[8px] px-3.5 pr-10 text-[12px] text-[#252525] tracking-[0.05em] outline-none transition-all duration-150 placeholder:text-[#a1a1a1] placeholder:tracking-[-0.02em] focus:border-[#308bf9] focus:shadow-[0_0_0_3px_#e9f3ff]";

  /* ----- Missing token state ----- */
  if (!hasToken) {
    return (
      <div className={SHELL}>
        <CardHeader />
        <div className="px-7 py-9 text-center">
          <div className="text-[20px] font-semibold text-[#252525] tracking-[-0.02em] mb-1">Invitation token missing</div>
          <div className="text-[12px] text-[#738298] tracking-[-0.02em]">
            Please use the signup link from your invitation email.
          </div>
        </div>
      </div>
    );
  }

  /* ----- Loading state ----- */
  if (previewLoading) {
    return (
      <div className={SHELL}>
        <CardHeader />
        <div className="px-7 py-12 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#308bf9] border-t-transparent rounded-full animate-spin" />
          <p className="text-[12px] text-[#738298] tracking-[-0.02em]">Loading invitation details…</p>
        </div>
      </div>
    );
  }

  /* ----- Preview error state ----- */
  if (previewError) {
    return (
      <div className={SHELL}>
        <CardHeader />
        <div className="px-7 py-9 text-center">
          <div className="text-[20px] font-semibold text-[#252525] tracking-[-0.02em] mb-1">Invitation unavailable</div>
          <div className="text-[12px] text-[#738298] tracking-[-0.02em]">{previewError}</div>
        </div>
      </div>
    );
  }

  /* ----- Agreement gate (must accept before signup form) ----- */
  if (!agreed) {
    return (
      <Agreement
        onAccept={(pdf) => {
          setAgreementPdf(pdf);
          setAgreed(true);
        }}
        onDecline={() => router.push("/")}
      />
    );
  }

  /* ----- Main form ----- */
  return (
    <form onSubmit={onSubmit} className={SHELL}>
      <CardHeader />

      {/* Step progress */}
      <div className="flex items-center px-7 py-[14px] pb-4 bg-[#f5f7fa] border-b border-[#e1e6ed]">
        <div className="flex items-center gap-[7px] flex-shrink-0">
          <div className="w-[22px] h-[22px] rounded-full bg-[#3faf58] flex items-center justify-center">
            <CheckIcon size={9} />
          </div>
          <span className="text-[11px] font-medium text-[#252525] tracking-[-0.02em] whitespace-nowrap">
            Agreement
          </span>
        </div>

        <div className="flex-1 h-[2px] bg-[#e1e6ed] rounded-full mx-2.5 overflow-hidden">
          <div className="h-full w-full bg-[#3faf58] rounded-full" />
        </div>

        <div className="flex items-center gap-[7px] flex-shrink-0">
          <div className="w-[22px] h-[22px] rounded-full bg-[#3faf58] flex items-center justify-center">
            <CheckIcon size={9} />
          </div>
          <span className="text-[11px] font-medium text-[#252525] tracking-[-0.02em] whitespace-nowrap">
            Set Password
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-7 pt-[26px] pb-0">
        <div className="text-center pb-5">
          <div className="inline-flex items-center justify-center w-[76px] h-[76px] bg-[#eaffef] rounded-full mb-3.5">
            <div className="w-[52px] h-[52px] bg-[#3faf58] rounded-full flex items-center justify-center">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="text-[20px] font-semibold text-[#252525] tracking-[-0.02em] mb-1">Welcome to Respyr!</div>
          <div className="text-[12px] text-[#738298] tracking-[-0.02em]">
            {roleLabel ? (
              <>
                You&apos;ve been invited as a <span className="font-semibold text-[#308bf9]">{roleLabel}</span>. Set a password to
                finish setting up your account.
              </>
            ) : (
              "Set a password to finish setting up your account."
            )}
          </div>
        </div>

        <div className="h-px bg-[#e1e6ed] -mx-7 mb-[22px]" />

        {/* Password */}
        <div className="mb-3.5">
          <label htmlFor="pw" className="block text-[11px] font-medium text-[#535359] tracking-[-0.02em] mb-1.5">
            Create Password
          </label>
          <div className="relative">
            <input
              id="pw"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (pwError) setPwError("");
              }}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              className={`${inputBase} ${
                pwError ? "border-[#e74c3c] shadow-[0_0_0_3px_rgba(231,76,60,0.1)]" : "border-[#e1e6ed]"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1a1] hover:text-[#738298] p-1 rounded-[4px]"
              style={{ color: showPassword ? "#252525" : undefined }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <EyeIcon />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-[5px]">
            <div className="flex gap-[3px] flex-1">
              {[1, 2, 3].map((bar) => (
                <div
                  key={bar}
                  className="h-[3px] flex-1 rounded-[2px] transition-colors duration-[250ms]"
                  style={{ background: strength >= bar && strength > 0 ? BAR_COLORS[strength] : "#e1e6ed" }}
                />
              ))}
            </div>
            <span
              className="text-[10px] font-medium tracking-[-0.02em] min-w-[32px] text-right"
              style={{ color: strength > 0 ? STRENGTH_META[strength - 1].color : "#a1a1a1" }}
            >
              {strength > 0 ? STRENGTH_META[strength - 1].label : ""}
            </span>
          </div>
          {pwError && <p className="text-[10px] text-[#e74c3c] tracking-[-0.02em] mt-1">{pwError}</p>}
        </div>

        {/* Confirm password */}
        <div className="mb-4">
          <label htmlFor="cf" className="block text-[11px] font-medium text-[#535359] tracking-[-0.02em] mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="cf"
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (cfError) setCfError("");
              }}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              className={`${inputBase} ${
                cfError ? "border-[#e74c3c] shadow-[0_0_0_3px_rgba(231,76,60,0.1)]" : "border-[#e1e6ed]"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1a1] hover:text-[#738298] p-1 rounded-[4px]"
              style={{ color: showConfirm ? "#252525" : undefined }}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              <EyeIcon />
            </button>
          </div>
          {cfError && <p className="text-[10px] text-[#e74c3c] tracking-[-0.02em] mt-1">{cfError}</p>}
        </div>

        {/* Info card (real invite data) */}
        {infoRows.length > 0 && (
          <div className="bg-[#f5f7fa] border border-[#e1e6ed] rounded-[10px] mb-4 overflow-hidden">
            {infoRows.map((row, idx) => (
              <div key={idx} className={`flex items-center px-3.5 py-[9px] gap-2 ${idx > 0 ? "border-t border-[#e1e6ed]" : ""}`}>
                <div className="w-1.5 h-1.5 rounded-full bg-[#3faf58] flex-shrink-0" />
                <span className="flex-1 text-[11px] text-[#738298] tracking-[-0.02em]">{row.label}</span>
                {row.badge ? (
                  <span className="inline-flex items-center bg-[#e9f3ff] text-[#308bf9] text-[10px] font-medium tracking-[-0.02em] px-2 py-0.5 rounded-[6px]">
                    {row.badge}
                  </span>
                ) : (
                  <span className={`text-[11px] font-semibold tracking-[-0.02em] ${row.valueClass}`}>{row.value}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-11 bg-[#252525] text-white rounded-[15px] text-[13px] font-semibold tracking-[-0.02em] cursor-pointer flex items-center justify-center gap-2 transition-all duration-150 hover:bg-[#3a3a3a] hover:-translate-y-px active:translate-y-0 disabled:opacity-55 disabled:cursor-not-allowed disabled:transform-none"
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Create Account</span>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="px-[22px] pt-3.5 pb-5 text-center">
        <div className="text-[11px] text-[#a1a1a1] tracking-[-0.02em]">
          You&apos;ll be redirected to the dashboard once your account is set up.
        </div>
      </div>
    </form>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-svh w-full flex items-center justify-center p-6 bg-[#f5f7fa]">
      <Suspense fallback={<div className="text-[#a1a1a1] text-[13px]">Loading…</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
















// "use client";

// // Signup / accept-invite page.
// //
// // Entry: /signup?token=...
// // Invite details (name, email, role) are fetched from invite-preview API.

// import { Suspense, useEffect, useState } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { toast } from "sonner";
// import Image from "next/image";
// import { cookieManager } from "@/lib/cookies";
// import { previewInviteService, acceptInviteService } from "@/services/authService";

// const ROLE_HEADINGS = {
//   super_admin:   "Super-Admin",
//   trainer_admin: "Trainer-Admin",
//   trainer:       "Trainer",
//   client:        "Client",
// };

// function SignupForm() {
//   const router = useRouter();
//   const searchParams = useSearchParams();

//   const token = searchParams.get("token") || "";
//   const hasToken = Boolean(token);

//   const [previewLoading, setPreviewLoading] = useState(hasToken);
//   const [previewError, setPreviewError] = useState("");
//   const [invite, setInvite] = useState(null);

//   const [password, setPassword] = useState("");
//   const [confirm, setConfirm] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [showConfirm, setShowConfirm] = useState(false);
//   const [submitting, setSubmitting] = useState(false);

//   useEffect(() => {
//     if (!hasToken) {
//       setPreviewLoading(false);
//       return;
//     }

//     let cancelled = false;
//     (async () => {
//       try {
//         const res = await previewInviteService(token);
//         if (cancelled) return;
//         const data = res?.data || res;
//         setInvite(data);
//       } catch (err) {
//         if (cancelled) return;
//         const msg = err?.data?.message || err?.message || "Could not load invitation details.";
//         setPreviewError(msg);
//         toast.error(msg);
//       } finally {
//         if (!cancelled) setPreviewLoading(false);
//       }
//     })();

//     return () => { cancelled = true; };
//   }, [token, hasToken]);

//   const role = invite?.role || "";
//   const roleLabel = ROLE_HEADINGS[role] || "";
//   const firstName = invite?.first_name || "";
//   const lastName = invite?.last_name || "";
//   const fullName = invite?.name || [firstName, lastName].filter(Boolean).join(" ");
//   const email = invite?.email || "";

//   const onSubmit = async (e) => {
//     e.preventDefault();

//     if (!token) return toast.error("Missing invitation token.");
//     if (password.length < 8) return toast.error("Password must be at least 8 characters.");
//     if (password !== confirm) return toast.error("Passwords don't match.");

//     setSubmitting(true);
//     try {
//       await acceptInviteService({
//         token,
//         password,
//         confirm_password: confirm,
//       });

//       cookieManager.clearAuth();
//       toast.success(`Welcome aboard, ${firstName || ""}! You're all set.`);
//       router.push("/");
//     } catch (err) {
//       const msg = err?.data?.message || err?.message || "";
//       const lower = msg.toLowerCase();
//       if (lower.includes("already accepted") || lower.includes("already registered") || lower.includes("already onboarded")) {
//         toast.error("This invite has already been accepted. Please sign in instead.");
//         router.push("/");
//         return;
//       } else if (lower.includes("no pending invite") || lower.includes("not found")) {
//         toast.error("No pending invitation found for this email. Please check with the person who invited you.");
//       } else {
//         toast.error(msg || "Could not create your account. Please try again.");
//       }
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const fieldClass = "w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9] transition-colors";
//   const labelClass = "text-[#535359] text-[12px] font-semibold";

//   if (!hasToken) {
//     return (
//       <div className="bg-white shadow-lg rounded-[12px] p-8 max-w-md w-full text-center">
//         <h2 className="text-[20px] font-bold text-[#252525]">Invitation token missing</h2>
//         <p className="text-[#535359] text-[13px] mt-2">
//           Please use the signup link from your invitation email.
//         </p>
//       </div>
//     );
//   }

//   if (previewLoading) {
//     return (
//       <div className="bg-white shadow-lg rounded-[12px] p-8 max-w-md w-full flex flex-col items-center gap-3">
//         <div className="w-8 h-8 border-2 border-[#308BF9] border-t-transparent rounded-full animate-spin" />
//         <p className="text-[#535359] text-[13px]">Loading invitation details…</p>
//       </div>
//     );
//   }

//   if (previewError) {
//     return (
//       <div className="bg-white shadow-lg rounded-[12px] p-8 max-w-md w-full text-center">
//         <h2 className="text-[20px] font-bold text-[#252525]">Invitation unavailable</h2>
//         <p className="text-[#535359] text-[13px] mt-2">{previewError}</p>
//       </div>
//     );
//   }

//   return (
//     <form onSubmit={onSubmit} className="bg-white shadow-lg rounded-[12px] p-8 max-w-md w-full flex flex-col gap-5">
//       <div>
//         <h2 className="text-[28px] font-bold text-[#252525] tracking-[-0.5px]">
//           Welcome to Respyr!
//         </h2>
//         {roleLabel && (
//           <p className="text-[#535359] text-[13px] mt-1">
//             You've been invited as a <span className="font-semibold text-[#308BF9]">{roleLabel}</span> on Respyr.
//           </p>
//         )}
//         <p className="text-[#A1A1A1] text-[11px] mt-3">
//           Confirm your details and set a password to complete your account.
//         </p>
//       </div>

//       <div className="flex flex-col gap-1">
//         <label className={labelClass}>Name</label>
//         <input className={`${fieldClass} bg-[#F5F7FA]`} value={fullName} readOnly />
//       </div>

//       <div className="flex flex-col gap-1">
//         <label className={labelClass}>Email</label>
//         <input className={`${fieldClass} bg-[#F5F7FA]`} value={email} readOnly />
//       </div>

//       <div className="flex flex-col gap-1">
//         <label className={labelClass}>Password <span className="text-red-500">*</span></label>
//         <div className="relative">
//           <input
//             className={`${fieldClass} pr-10`}
//             type={showPassword ? "text" : "password"}
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             placeholder="At least 8 characters"
//           />
//           <div
//             className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
//             onClick={() => setShowPassword((v) => !v)}
//           >
//             <Image
//               src="/icons/hugeicons_view.svg"
//               alt={showPassword ? "Hide password" : "Show password"}
//               width={15}
//               height={15}
//               className={showPassword ? "opacity-50" : "opacity-100"}
//             />
//           </div>
//         </div>
//       </div>

//       <div className="flex flex-col gap-1">
//         <label className={labelClass}>Confirm password <span className="text-red-500">*</span></label>
//         <div className="relative">
//           <input
//             className={`${fieldClass} pr-10`}
//             type={showConfirm ? "text" : "password"}
//             value={confirm}
//             onChange={(e) => setConfirm(e.target.value)}
//             placeholder="Re-enter password"
//           />
//           <div
//             className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
//             onClick={() => setShowConfirm((v) => !v)}
//           >
//             <Image
//               src="/icons/hugeicons_view.svg"
//               alt={showConfirm ? "Hide password" : "Show password"}
//               width={15}
//               height={15}
//               className={showConfirm ? "opacity-50" : "opacity-100"}
//             />
//           </div>
//         </div>
//       </div>

//       <button
//         type="submit"
//         disabled={submitting}
//         className="rounded-[10px] bg-[#308BF9] text-white text-[14px] font-semibold py-3 disabled:opacity-60 hover:bg-[#1a76e8] transition-colors cursor-pointer"
//       >
//         {submitting ? "Setting up your account..." : "Create account"}
//       </button>
//     </form>
//   );
// }

// export default function SignupPage() {
//   return (
//     <div className="min-h-svh w-full flex items-center justify-center p-6 bg-[#F5F7FA]">
//       <Suspense fallback={<div className="text-[#A1A1A1] text-[13px]">Loading…</div>}>
//         <SignupForm />
//       </Suspense>
//     </div>
//   );
// }
