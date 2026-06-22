"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { cookieManager } from "@/lib/cookies";
import {
  sendTrainerClientInviteService,
  resendTrainerClientInviteService,
  revokeTrainerClientInviteService,
  fetchReferralClientListService,
  revokeClientSubscriptionInviteService,
  resendClientSubscriptionInviteService,
  extendClientFreeTrialService,
} from "@/services/authService";
import Cookies from "js-cookie";
import * as CountryFlags from "country-flag-icons/react/3x2";
import { countries as COUNTRY_DATA } from "countries-list";

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64).split("").map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`).join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getTrainerIdFromCookie() {
  const token = Cookies.get("access_token");
  if (!token) return null;
  const decoded = decodeJwt(token);
  return decoded?.dietician_id ?? decoded?.sub ?? null;
}

function resolvePartnerCode(dietician) {
  return dietician?.partner_code || dietician?.dietician_id || "";
}

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isValidMobile = (m) => /^\+?[0-9\s\-()]{7,}$/.test(m);

// Trial window length (days) for an accepted referral client.
const TRIAL_DAYS = 7;

// Computes the remaining days in the 7-day trial window starting from the given
// start date (the client's accepted_at for accepted referrals).
// Returns null when there's no usable date, otherwise { days, expired }.
function getTrialCountdown(startDate) {
  if (!startDate) return null;
  // "2026-06-03 23:53:13" -> parse reliably across browsers
  const start = new Date(String(startDate).replace(" ", "T"));
  if (Number.isNaN(start.getTime())) return null;

  const expiry = new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const msLeft = expiry.getTime() - Date.now();

  if (msLeft <= 0) return { days: 0, expired: true };

  // Round up so a partial day still counts as a remaining day; cap at the trial length.
  const days = Math.min(Math.ceil(msLeft / (24 * 60 * 60 * 1000)), TRIAL_DAYS);
  return { days, expired: false };
}

// Country list for the mobile-number input, sourced from the `countries-list`
// package. Entries without an available flag (in country-flag-icons) are filtered
// out, then sorted alphabetically by name.
const COUNTRIES = Object.entries(COUNTRY_DATA)
  .map(([code, data]) => ({
    code,
    name: data.name,
    dial: `+${Array.isArray(data.phone) ? data.phone[0] : data.phone}`,
  }))
  .filter((c) => CountryFlags[c.code])
  .sort((a, b) => a.name.localeCompare(b.name));

// Renders the SVG flag for a given ISO country code
function CountryFlag({ code, className }) {
  const Flag = CountryFlags[code];
  if (!Flag) return null;
  return <Flag title={code} className={className} />;
}

function CountryCodeSelect({ value, onChange, buttonClass }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const selected =
    COUNTRIES.find((c) => `${c.code}-${c.dial}` === value) || COUNTRIES[0];

  const filtered = COUNTRIES.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.dial.includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${buttonClass} flex items-center gap-1.5 whitespace-nowrap cursor-pointer`}
      >
        <CountryFlag code={selected.code} className="w-5 h-auto rounded-[2px]" />
        <span className="text-[#252525]">{selected.dial}</span>
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" className="text-[#A1A1A1]">
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-[10px] border border-[#E1E6ED] bg-white shadow-lg">
          <div className="p-2 border-b border-[#F5F7FA]">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="w-full rounded-[8px] border border-[#E1E6ED] bg-white px-2.5 py-1.5 text-[12px] text-[#252525] focus:outline-none focus:border-[#308BF9]"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[12px] text-[#A1A1A1]">No matches</li>
            ) : (
              filtered.map((c) => (
                <li key={`${c.code}-${c.dial}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(`${c.code}-${c.dial}`);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F5F7FA] cursor-pointer"
                  >
                    <CountryFlag code={c.code} className="w-5 h-auto rounded-[2px] shrink-0" />
                    <span className="flex-1 text-[#252525]">{c.name}</span>
                    <span className="text-[#A1A1A1]">{c.dial}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

const PLANS = [
  // {
  //   id: "free_trial",
  //   apiValue: "free_trial",
  //   label: "Free Trial",
  //   price: "$0",
  //   badge: "Free",
  //   badgeColor: "bg-[#E5F6EE] text-[#1F7A4A]",
  // },
  // {
  //   id: "monthly",
  //   apiValue: "monthly",
  //   label: "Monthly Plan",
  //   price: "$50",
  //   badge: "$50/mo",
  //   badgeColor: "bg-[#EEF4FE] text-[#308BF9]",
  // },
  // {
  //   id: "lease_quarterly",
  //   apiValue: "lease_quarterly",
  //   label: "Lease (Quarterly)",
  //   price: "$150",
  //   badge: "$150",
  //   badgeColor: "bg-[#FFF4E0] text-[#A66B00]",
  // },
  // {
  //   id: "yearly",
  //   apiValue: "yearly",
  //   label: "Yearly Plan",
  //   price: "$300",
  //   badge: "$300/yr",
  //   badgeColor: "bg-[#F3EEFE] text-[#6B45BC]",
  // },
];

// Revoke Confirmation Modal
function RevokeModal({ isOpen, onClose, onConfirm, clientName, isLoading }) {
  const [reason, setReason] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(reason);
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-[16px] w-full max-w-md mx-4 p-6 shadow-xl">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[#252525] text-[16px] font-bold">Revoke Invitation</h3>
            <button
              onClick={handleClose}
              className="text-[#A1A1A1] hover:text-[#535359] transition-colors cursor-pointer"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <p className="text-[#535359] text-[13px]">
            You are about to revoke the invitation for <span className="font-semibold text-[#252525]">{clientName}</span>. 
            This action cannot be undone. Please provide a reason for revocation.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[#535359] text-[12px] font-semibold">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Wrong email address, Client requested cancellation, etc."
                rows={3}
                className="w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9] transition-colors resize-none"
                required
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isLoading || !reason.trim()}
                className="flex-1 rounded-[10px] bg-[#B5363A] text-white text-[13px] font-semibold px-5 py-2.5 disabled:opacity-60 hover:bg-[#9a2e32] transition-colors cursor-pointer"
              >
                {isLoading ? "Revoking..." : "Confirm Revoke"}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-[10px] border border-[#E1E6ED] bg-white text-[#535359] text-[13px] font-semibold px-5 py-2.5 hover:bg-[#F5F7FA] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function PartnerCodeCard({ code, name }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Partner code copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy. Long-press to copy manually.");
    }
  };

  return (
    <>
    {/* <div className="bg-[#F5F7FA] rounded-[10px] p-5 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-[#A1A1A1] text-[11px] uppercase tracking-wide font-semibold">
          Your partner code
        </span>
        <span className="text-[#535359] text-[12px]">
          {name ? `${name} · ` : ""}Share this code so clients can attribute
          their subscription to you.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-white rounded-[10px] px-4 py-3 border border-[#E1E6ED]">
          <span className="text-[#252525] text-[20px] font-bold tracking-wide">
            {code || "\u2014"}
          </span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          disabled={!code}
          className="rounded-[10px] bg-[#308BF9] text-white text-[12px] font-semibold px-4 py-3 disabled:opacity-50 cursor-pointer"
        >
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
    </div> */}
  
    
    </>
  );
}

function InviteForm({ partnerCode, onInviteSent }) {
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("US-+1");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("free_trial");
  const [submitting, setSubmitting] = useState(false);

  const dialCode = countryCode.split("-")[1] || "+1";
  const fullMobile = `${dialCode}${mobile.replace(/\D/g, "")}`.trim();

  const reset = () => {
    setName("");
    setCountryCode("US-+1");
    setMobile("");
    setEmail("");
    setSelectedPlan("free_trial");
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!partnerCode) {
      toast.error("Partner code not loaded yet — try again in a moment.");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Please enter the client's name.");
      return;
    }
    if (!mobile.trim() || !isValidMobile(fullMobile)) {
      toast.error("Please enter a valid mobile number.");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email.");
      return;
    }

    const trainerId = partnerCode;

    if (!trainerId) {
      return toast.error("Trainer code not found.");
    }

    setSubmitting(true);

    try {
      const res = await sendTrainerClientInviteService({
        trainerId: trainerId,
        clientName: name.trim(),
        clientMobile: fullMobile,
        clientEmail: email.trim(),
        planCode: selectedPlan,
      });

      const clientEmail = res?.data?.client_email || email.trim();
      toast.success(`Invite sent to ${name.trim()} — ${clientEmail}`);
      reset();
      onInviteSent();
    } catch (err) {
      const msg = err?.data?.message || err?.message || "";
      if (msg.toLowerCase().includes("already has a pending invitation")) {
        toast.success(`Invite sent to ${name.trim()}`);
        reset();
        onInviteSent();
      } else {
        toast.error(msg || "Could not send invite. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9] transition-colors";
  const labelClass = "text-[#535359] text-[12px] font-semibold";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-[#252525] text-[14px] font-bold">Invite a client</h3>
        <p className="text-[#535359] text-[12px]">
          Send an invite with a deep link. Your partner code is attached
          automatically. The client receives a code based on the plan you select.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Name <span className="text-red-500">*</span></label>
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Mobile <span className="text-red-500">*</span></label>
          <div className="flex items-stretch rounded-[10px] border border-[#E1E6ED] bg-white transition-colors focus-within:border-[#308BF9]">
            <CountryCodeSelect
              value={countryCode}
              onChange={setCountryCode}
              buttonClass="px-2.5 py-2.5 text-[13px] border-r border-[#E1E6ED] rounded-l-[10px] hover:bg-[#F5F7FA] focus:outline-none transition-colors"
            />
            <input
              className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[13px] text-[#252525] rounded-r-[10px] focus:outline-none"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/[^\d\s\-()]/g, ""))}
              placeholder="555 123 4567"
              inputMode="tel"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Email <span className="text-red-500">*</span></label>
          <input
            className={fieldClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            inputMode="email"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {/* <label className={labelClass}>Free Trial <span className="text-red-500">*</span></label> */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlan(plan.id)}
              className={`rounded-[10px] border px-3 py-2.5 text-left transition-all cursor-pointer ${
                selectedPlan === plan.id
                  ? "border-[#308BF9] bg-[#EEF4FE] ring-1 ring-[#308BF9]"
                  : "border-[#E1E6ED] bg-white hover:border-[#C4C9D4]"
              }`}
            >
              <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 mb-1.5 ${plan.badgeColor}`}>
                {plan.badge}
              </span>
              <p className="text-[12px] font-semibold text-[#252525]">{plan.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-5 py-2.5 disabled:opacity-60 hover:bg-[#1a76e8] transition-colors cursor-pointer"
        >
          {submitting ? "Sending..." : "Send invite"}
        </button>
        <span className="text-[#A1A1A1] text-[11px]">
          Client will receive a code for the {PLANS.find((p) => p.id === selectedPlan)?.label}.
        </span>
      </div>
    </form>
  );
}

function PendingInvites({ 
  invites, 
  onResend, 
  onRevoke, 
  isLoading,
  onPageChange,
  pagination,
  currentPage,
  summary,
  onSubscriptionRevoke,
  onSubscriptionResend,
  onExtend
}) {
  const [actionInProgress, setActionInProgress] = useState({});
  const [revokeModal, setRevokeModal] = useState({ isOpen: false, client: null });

  const getUniqueKey = (inv, index) => {
    if (inv.subscription_id) {
      return `sub-${inv.subscription_id}-${inv.invite_id || 'no-invite'}`;
    }
    if (inv.invite_id) {
      return `inv-${inv.invite_id}`;
    }
    return `item-${index}`;
  };

  const handleResendClick = (inv, index) => {
    // Check if it's a subscription-based invite
    if (inv.subscription_id && inv.source === "trainer_client_plan_subscriptions") {
      handleSubscriptionResend(inv, index);
    } else {
      // For regular invites, use the existing resend function
      handleResend(inv, index);
    }
  };

  const handleResend = async (inv, index) => {
    const uniqueKey = getUniqueKey(inv, index);
    setActionInProgress((prev) => ({ ...prev, [`resend-${uniqueKey}`]: true }));
    try { 
      await onResend(inv); 
    } finally {
      setActionInProgress((prev) => ({ ...prev, [`resend-${uniqueKey}`]: false }));
    }
  };

  const handleSubscriptionResend = async (inv, index) => {
    const uniqueKey = getUniqueKey(inv, index);
    setActionInProgress((prev) => ({ ...prev, [`resend-${uniqueKey}`]: true }));
    try { 
      await onSubscriptionResend(inv); 
    } finally {
      setActionInProgress((prev) => ({ ...prev, [`resend-${uniqueKey}`]: false }));
    }
  };

  const handleRevokeClick = (inv) => {
    // Check if it's a subscription-based invite
    if (inv.subscription_id && inv.source === "trainer_client_plan_subscriptions") {
      setRevokeModal({ isOpen: true, client: inv });
    } else {
      // For regular invites, use the existing revoke function
      handleRevoke(inv, inv.invite_id || inv.subscription_id);
    }
  };

  const handleRevoke = async (inv) => {
    const uniqueKey = getUniqueKey(inv);
    setActionInProgress((prev) => ({ ...prev, [`revoke-${uniqueKey}`]: true }));
    try { 
      await onRevoke(inv); 
    } finally {
      setActionInProgress((prev) => ({ ...prev, [`revoke-${uniqueKey}`]: false }));
    }
  };

  const handleExtendClick = async (inv, index) => {
    const uniqueKey = getUniqueKey(inv, index);
    setActionInProgress((prev) => ({ ...prev, [`extend-${uniqueKey}`]: true }));
    try {
      await onExtend(inv);
    } finally {
      setActionInProgress((prev) => ({ ...prev, [`extend-${uniqueKey}`]: false }));
    }
  };

  const handleSubscriptionRevokeConfirm = async (reason) => {
    if (!revokeModal.client) return;
    
    const uniqueKey = getUniqueKey(revokeModal.client);
    setActionInProgress((prev) => ({ ...prev, [`revoke-${uniqueKey}`]: true }));
    
    try {
      await onSubscriptionRevoke(revokeModal.client, reason);
      setRevokeModal({ isOpen: false, client: null });
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setActionInProgress((prev) => ({ ...prev, [`revoke-${uniqueKey}`]: false }));
    }
  };

  // Only show the full-block loader on the very first load (no data yet). For
  // subsequent fetches (search / pagination) we keep the table mounted and just
  // dim it, so the page doesn't flash/refresh and scroll position is preserved.
  const isInitialLoading = isLoading && (!invites || invites.length === 0);

  if (isInitialLoading) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
        Loading clients...
      </div>
    );
  }

  if (!isLoading && (!invites || invites.length === 0)) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
        No clients found. Use the form above to invite your first client.
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      accepted: { bg: "bg-[#E5F6EE]", text: "text-[#1F7A4A]", label: "Accepted" },
      pending: { bg: "bg-[#FFF4E0]", text: "text-[#A66B00]", label: "Pending" },
      failed: { bg: "bg-[#FCEAEB]", text: "text-[#B5363A]", label: "Failed" },
      cancelled: { bg: "bg-[#F3EEFE]", text: "text-[#6B45BC]", label: "Cancelled" },
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <span className={`inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  return (
    <>
      <div>
        <div className="relative overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
          {/* Background-fetch overlay: keeps the table in place, just dims it. */}
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#535359] shadow-sm border border-[#E1E6ED]">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#E1E6ED" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="#308BF9" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Updating...
              </span>
            </div>
          )}
          <table className={`w-full text-[12px] transition-opacity ${isLoading ? "opacity-50" : "opacity-100"}`}>
            <thead>
              <tr className="bg-[#F5F7FA] text-[#535359] text-left">
                <th className="py-2.5 px-4 font-semibold">Name</th>
                <th className="py-2.5 px-4 font-semibold">Mobile</th>
                <th className="py-2.5 px-4 font-semibold">Invite Email</th>
                <th className="py-2.5 px-4 font-semibold">Accepted Email</th>
                <th className="py-2.5 px-4 font-semibold">Referral Code</th>
                <th className="py-2.5 px-4 font-semibold">Plan</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold">Trial</th>
                <th className="py-2.5 px-4 font-semibold">Sent</th>
                <th className="py-2.5 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv, index) => {
                const uniqueKey = getUniqueKey(inv, index);
                const planCode = inv.plan?.plan_code;
                const planObj = PLANS.find((p) => p.apiValue === planCode);
                
                return (
                  <tr key={uniqueKey} className="border-t border-[#F5F7FA]">
                    <td className="py-2.5 px-4 text-[#252525] font-semibold">{inv.name}</td>
                    <td className="py-2.5 px-4 text-[#535359]">{inv.phone || "NA"}</td>
                    <td className="py-2.5 px-4 text-[#535359]">{inv.email}</td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {inv.accepted_email || inv.accepted_by_email || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-[#535359]">
                      {inv.redeem_code || "-"}
                    </td>
                    <td className="py-2.5 px-4">
                      {planObj ? (
                        <span className={`inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${planObj.badgeColor}`}>
                          {planObj.badge}
                        </span>
                      ) : (
                        <span className="text-[#A1A1A1]">
                          {inv.plan?.plan_name || inv.plan?.plan_code || "-"}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex flex-col gap-1">
                        {/* {getStatusBadge(inv.status)} */}
                        {inv.status_label && (
                          <span className="text-[12px] text-boldtext-[#A1A1A1]">
                            {inv.status_label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      {(() => {
                        const trial = inv.free_trial_subscription;
                        if (!trial?.exists || trial.added_days == null) {
                          return <span className="text-[#A1A1A1]">-</span>;
                        }

                        const addedDays = trial.added_days;

                        return (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 bg-[#FFF4E0] text-[#A66B00]">
                              {addedDays} days added
                            </span>
                            {/* TODO: temporarily always shown for API integration.
                                Restore `addedDays === 1` gate once the extend API is wired. */}
                            {addedDays >= 1 && (
                              <button
                                type="button"
                                onClick={() => handleExtendClick(inv, index)}
                                disabled={actionInProgress[`extend-${uniqueKey}`]}
                                className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-2.5 py-0.5 hover:bg-[#d9e8fd] disabled:opacity-60 cursor-pointer"
                              >
                                {actionInProgress[`extend-${uniqueKey}`] ? "Extending..." : "+7 days"}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-2.5 px-4 text-[#A1A1A1]">
                      {inv.sent_on_date ? new Date(inv.sent_on_date).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      }) : "-"}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        {inv.actions?.can_resend && (
                          <button
                            type="button"
                            onClick={() => handleResendClick(inv, index)}
                            disabled={actionInProgress[`resend-${uniqueKey}`]}
                            className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-2.5 py-0.5 hover:bg-[#d9e8fd] disabled:opacity-60 cursor-pointer"
                          >
                            {actionInProgress[`resend-${uniqueKey}`] ? "Sending..." : "Resend"}
                          </button>
                        )}
                        {inv.actions?.can_revoke && (
                          <button
                            type="button"
                            onClick={() => handleRevokeClick(inv)}
                            disabled={actionInProgress[`revoke-${uniqueKey}`]}
                            className="rounded-full bg-[#FCEAEB] text-[#B5363A] text-[11px] font-semibold px-2.5 py-0.5 hover:bg-[#f8d4d5] disabled:opacity-60 cursor-pointer"
                          >
                            {actionInProgress[`revoke-${uniqueKey}`] ? "Revoking..." : "Revoke"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {pagination && (() => {
          const totalPages = Math.max(
            1,
            Math.ceil((summary?.total_count || 0) / (pagination.limit || 10))
          );
          const page = currentPage || pagination.page || 1;

          return (
            <div className="flex items-center justify-between mt-4 px-2">
              <div className="text-[#A1A1A1] text-[12px]">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1 || isLoading}
                  className="rounded-[8px] border border-[#E1E6ED] px-3 py-1.5 text-[12px] font-semibold text-[#535359] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5F7FA] transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => onPageChange(page + 1)}
                  disabled={!pagination.has_more || page >= totalPages || isLoading}
                  className="rounded-[8px] border border-[#E1E6ED] px-3 py-1.5 text-[12px] font-semibold text-[#535359] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5F7FA] transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Revoke Modal */}
      <RevokeModal
        isOpen={revokeModal.isOpen}
        onClose={() => setRevokeModal({ isOpen: false, client: null })}
        onConfirm={handleSubscriptionRevokeConfirm}
        clientName={revokeModal.client?.name || ""}
        isLoading={actionInProgress[`revoke-${getUniqueKey(revokeModal.client || {}, 0)}`]}
      />
    </>
  );
}

export default function ReferralsPage() {
  const [dietician, setDietician] = useState(null);
  const [invites, setInvites] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const limit = 10;

  // Backend enforces a minimum search length (search_min_length: 3).
  const SEARCH_MIN_LENGTH = 3;

  // Caches already-fetched pages (keyed by page number) so navigating back to a
  // page you've already visited — e.g. clicking "Previous" — serves from memory
  // instead of hitting the API again. Cleared whenever the search/partner filter
  // changes or after a mutation that could change the data.
  const pageCacheRef = useRef({});

  useEffect(() => {
    setDietician(cookieManager.getJSON("dietician"));
  }, []);

  const partnerCode = resolvePartnerCode(dietician);
  const name = dietician?.name || "";

  // Any change to the filters invalidates the cached pages.
  useEffect(() => {
    pageCacheRef.current = {};
  }, [debouncedSearch, partnerCode]);

  // Debounce the search input and reset to the first page whenever it changes.
  // Only 0 chars (cleared -> full list) or >= SEARCH_MIN_LENGTH chars trigger a
  // fetch; typing 1-2 letters is a no-op so the API is never hit for them.
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed.length > 0 && trimmed.length < SEARCH_MIN_LENGTH) return;

    const t = setTimeout(() => {
      setDebouncedSearch(trimmed);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchReferralList = useCallback(
    async (page = 1, search = "", { force = false } = {}) => {
      // A mutation just changed the data — drop every cached page.
      if (force) pageCacheRef.current = {};

      // Serve already-fetched pages from cache (e.g. "Previous") without an API call.
      const cached = pageCacheRef.current[page];
      if (cached) {
        setInvites(cached.data || []);
        setSummary(cached.summary || null);
        setPagination(cached.pagination || null);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetchReferralClientListService(page, limit, {
          partnerCode,
          // Only send the search term once it meets the backend's minimum length.
          search: search.length >= SEARCH_MIN_LENGTH ? search : "",
        });

        if (response?.status || response?.ok) {
          pageCacheRef.current[page] = response;
          setInvites(response.data || []);
          setSummary(response.summary || null);
          setPagination(response.pagination || null);
        } else {
          toast.error(response?.message || "Failed to fetch clients");
        }
      } catch (error) {
        const msg = error?.data?.message || error?.message || "Failed to fetch referral list";
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [partnerCode]
  );

  useEffect(() => {
    fetchReferralList(currentPage, debouncedSearch, { force: true });
  }, [currentPage, debouncedSearch, fetchReferralList]);

  const handlePageChange = (newPage) => {
    const totalPages = Math.max(1, Math.ceil((summary?.total_count || 0) / limit));
    // Ignore clicks that would go out of range, land on the same page, or fire
    // while a request is already in flight — each of those would be a wasted API call.
    if (newPage < 1 || newPage > totalPages) return;
    if (newPage === currentPage) return;
    if (isLoading) return;
    setCurrentPage(newPage);
  };

  const handleInviteSent = () => {
    setCurrentPage(1);
    fetchReferralList(1, "", { force: true });
  };

  const handleResend = async (inv) => {
    const trainerId = inv.trainer_id || partnerCode;
    if (!trainerId) return toast.error("Session expired. Please log in again.");

    try {
      await resendTrainerClientInviteService({
        inviteId: inv.invite_id || inv.subscription_id,
        trainerID: trainerId,
        clientName: inv.name,
        clientMobile: inv.phone,
        clientEmail: inv.email,
        plan: inv.plan?.plan_code,
      });
      toast.success(`Invite resent to ${inv.name}`);
      fetchReferralList(currentPage, debouncedSearch, { force: true });
    } catch (err) {
      const msg = err?.data?.message || err?.message || "";
      if (msg.toLowerCase().includes("already has a pending invitation")) {
        toast.success(`Invite resent to ${inv.name}`);
        fetchReferralList(currentPage, debouncedSearch, { force: true });
      } else {
        toast.error(msg || "Could not resend invite.");
      }
    }
  };

  const handleSubscriptionResend = async (inv) => {
    try {
      await resendClientSubscriptionInviteService({
        subscriptionId: inv.subscription_id,
      });
      toast.success(`Subscription invitation for ${inv.name} resent successfully.`);
      fetchReferralList(currentPage, debouncedSearch, { force: true });
    } catch (err) {
      toast.error(err?.data?.message || err?.message || "Could not resend subscription invite.");
      throw err; // Re-throw to handle in the UI
    }
  };

  const handleRevoke = async (inv) => {
    try {
      await revokeTrainerClientInviteService({ 
        inviteId: inv.invite_id || inv.subscription_id 
      });
      toast.success(`Invite to ${inv.name} revoked.`);
      fetchReferralList(currentPage, debouncedSearch, { force: true });
    } catch (err) {
      toast.error(err?.data?.message || err?.message || "Could not revoke invite.");
    }
  };

  const handleExtendTrial = async (inv) => {
    const profileId = inv.accepted_profile_id || inv.accepted_client?.profile_id;
    if (!profileId) {
      return toast.error("Client profile not found — cannot extend trial.");
    }

    try {
      await extendClientFreeTrialService({
        profileId,
        reason: "Extending free trial to 7 days",
      });
      toast.success(`Trial for ${inv.name} extended by 7 days.`);
      fetchReferralList(currentPage, debouncedSearch, { force: true });
    } catch (err) {
      toast.error(err?.data?.message || err?.message || "Could not extend trial.");
      throw err;
    }
  };

  const handleSubscriptionRevoke = async (inv, reason) => {
    try {
      await revokeClientSubscriptionInviteService({
        subscriptionId: inv.subscription_id,
        reason: reason,
      });
      toast.success(`Subscription invitation for ${inv.name} revoked successfully.`);
      fetchReferralList(currentPage, debouncedSearch, { force: true });
    } catch (err) {
      toast.error(err?.data?.message || err?.message || "Could not revoke subscription invite.");
      throw err; // Re-throw to handle in the modal
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">Referrals</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          Send invites, and track which clients have
          been invited. Select a plan and the client receives a code for that plan.
        </p>
      </div>

      <PartnerCodeCard code={partnerCode} name={name} />

      <InviteForm partnerCode={partnerCode} onInviteSent={handleInviteSent} />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-[#252525] text-[14px] font-bold">
            All Clients ({summary?.total_count || 0})
          </h3>
          <div className="relative w-full sm:w-64">
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A1]"
            >
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
              <path d="M14 14L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search"
              className="w-full rounded-[10px] border border-[#E1E6ED] bg-white pl-9 pr-3 py-2 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9] transition-colors"
            />
          </div>
        </div>
        {searchTerm.trim().length > 0 &&
          searchTerm.trim().length < SEARCH_MIN_LENGTH && (
            <p className="text-[#A1A1A1] text-[11px] mb-2">
              Type at least {SEARCH_MIN_LENGTH} characters to search.
            </p>
          )}
        <PendingInvites
          invites={invites}
          onResend={handleResend}
          onRevoke={handleRevoke}
          isLoading={isLoading}
          onPageChange={handlePageChange}
          pagination={pagination}
          currentPage={currentPage}
          summary={summary}
          onSubscriptionRevoke={handleSubscriptionRevoke}
          onSubscriptionResend={handleSubscriptionResend}
          onExtend={handleExtendTrial}
        />
      </div>
    </div>
  );
}