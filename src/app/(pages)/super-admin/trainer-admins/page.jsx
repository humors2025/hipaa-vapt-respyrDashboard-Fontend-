"use client";

import { Fragment, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import Cookies from "js-cookie";
import * as CountryFlags from "country-flag-icons/react/3x2";
import {
  fetchTrainerAdminListService,
  inviteTrainerAdminService,
  resendTrainerAdminInviteService,
  revokeTrainerAdminInviteService,
} from "@/services/authService";
import { getCurrentUser } from "@/lib/user";
import TrainersList from "@/components/super-admin/TrainersList";


const isValidEmail = (emailAddress) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress);

const isValidPhone = (phoneNumber) =>
  /^\+?[0-9\s\-()]{7,}$/.test(phoneNumber);

// Country dial codes for the phone input
const COUNTRIES = [
  { code: "AF", name: "Afghanistan", dial: "+93" },
  { code: "AL", name: "Albania", dial: "+355" },
  { code: "DZ", name: "Algeria", dial: "+213" },
  { code: "AR", name: "Argentina", dial: "+54" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "AT", name: "Austria", dial: "+43" },
  { code: "BH", name: "Bahrain", dial: "+973" },
  { code: "BD", name: "Bangladesh", dial: "+880" },
  { code: "BE", name: "Belgium", dial: "+32" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "BG", name: "Bulgaria", dial: "+359" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "CL", name: "Chile", dial: "+56" },
  { code: "CN", name: "China", dial: "+86" },
  { code: "CO", name: "Colombia", dial: "+57" },
  { code: "HR", name: "Croatia", dial: "+385" },
  { code: "CZ", name: "Czechia", dial: "+420" },
  { code: "DK", name: "Denmark", dial: "+45" },
  { code: "EG", name: "Egypt", dial: "+20" },
  { code: "FI", name: "Finland", dial: "+358" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "GR", name: "Greece", dial: "+30" },
  { code: "HK", name: "Hong Kong", dial: "+852" },
  { code: "HU", name: "Hungary", dial: "+36" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "ID", name: "Indonesia", dial: "+62" },
  { code: "IE", name: "Ireland", dial: "+353" },
  { code: "IL", name: "Israel", dial: "+972" },
  { code: "IT", name: "Italy", dial: "+39" },
  { code: "JP", name: "Japan", dial: "+81" },
  { code: "JO", name: "Jordan", dial: "+962" },
  { code: "KE", name: "Kenya", dial: "+254" },
  { code: "KW", name: "Kuwait", dial: "+965" },
  { code: "MY", name: "Malaysia", dial: "+60" },
  { code: "MX", name: "Mexico", dial: "+52" },
  { code: "MA", name: "Morocco", dial: "+212" },
  { code: "NL", name: "Netherlands", dial: "+31" },
  { code: "NZ", name: "New Zealand", dial: "+64" },
  { code: "NG", name: "Nigeria", dial: "+234" },
  { code: "NO", name: "Norway", dial: "+47" },
  { code: "OM", name: "Oman", dial: "+968" },
  { code: "PK", name: "Pakistan", dial: "+92" },
  { code: "PH", name: "Philippines", dial: "+63" },
  { code: "PL", name: "Poland", dial: "+48" },
  { code: "PT", name: "Portugal", dial: "+351" },
  { code: "QA", name: "Qatar", dial: "+974" },
  { code: "RO", name: "Romania", dial: "+40" },
  { code: "RU", name: "Russia", dial: "+7" },
  { code: "SA", name: "Saudi Arabia", dial: "+966" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "KR", name: "South Korea", dial: "+82" },
  { code: "ES", name: "Spain", dial: "+34" },
  { code: "LK", name: "Sri Lanka", dial: "+94" },
  { code: "SE", name: "Sweden", dial: "+46" },
  { code: "CH", name: "Switzerland", dial: "+41" },
  { code: "TW", name: "Taiwan", dial: "+886" },
  { code: "TH", name: "Thailand", dial: "+66" },
  { code: "TR", name: "Turkey", dial: "+90" },
  { code: "UA", name: "Ukraine", dial: "+380" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "VN", name: "Vietnam", dial: "+84" },
]
  .filter((c) => CountryFlags[c.code])
  .sort((a, b) => a.name.localeCompare(b.name));

// Renders the SVG flag for a given ISO country code
function CountryFlag({ code, className }) {
  const Flag = CountryFlags[code];
  if (!Flag) return null;
  return <Flag title={code} className={className} />;
}

function CountryCodeSelect({ value, onChange, buttonClass, disabled }) {
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
        disabled={disabled}
        className={`${buttonClass} flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-60`}
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

const formatDateTime = (dateTimeValue) => {
  if (!dateTimeValue) return "-";
  return dateTimeValue;
};

function getActorEmail() {
  try {
    const token = Cookies.get("access_token");
    if (token && token.split(".").length === 3) {
      const payload = token.split(".")[1];
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(base64).split("").map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`).join("")
      );
      const decoded = JSON.parse(json);
      if (decoded?.email || decoded?.user_id) {
        return decoded.email || decoded.user_id;
      }
    }

    const userCookie = Cookies.get("user");
    if (userCookie) {
      const user = JSON.parse(userCookie);
      return user?.email || user?.user_id || "Unknown";
    }

    return "Unknown";
  } catch {
    return "Unknown";
  }
}

function formatAuditDate(dateValue) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

const AUDIT_ACTION_STYLES = {
  invited: "bg-[#E5F6EE] text-[#1F7A4A]",
  resent: "bg-[#EEF4FE] text-[#308BF9]",
  revoked: "bg-[#FCEAEB] text-[#B5363A]",
  rejected: "bg-[#FFF4E0] text-[#A66B00]",
  "accepted (email)": "bg-[#E5F6EE] text-[#1F7A4A]",
  "accepted (phone)": "bg-[#E5F6EE] text-[#1F7A4A]",
};

function isInvitationExpired(invitation) {
  if (String(invitation?.status || "").toLowerCase() === "expired") return true;
  if (!invitation?.expires_at) return false;
  const expiresAt = new Date(String(invitation.expires_at).replace(" ", "T"));
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() < Date.now();
}

const formatOverrideMonthly = (overrideMonthly) => {
  if (overrideMonthly === null || overrideMonthly === undefined) return "-";

  const numericOverride = Number(overrideMonthly);

  if (Number.isNaN(numericOverride)) {
    return String(overrideMonthly);
  }

  return numericOverride.toLocaleString("en-US");
};

function InviteForm({ onInvitationSent }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [countryCode, setCountryCode] = useState("US-+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  const dialCode = countryCode.split("-")[1] || "+1";

  const resetInviteForm = () => {
    setFirstName("");
    setLastName("");
    setEmailAddress("");
    setCountryCode("US-+1");
    setPhoneNumber("");
  };

  const handleInviteSubmit = async (formSubmitEvent) => {
    formSubmitEvent.preventDefault();

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const normalizedEmailAddress = emailAddress.trim().toLowerCase();
    const localPhoneNumber = phoneNumber.replace(/\D/g, "");
    const trimmedPhoneNumber = `${dialCode}${localPhoneNumber}`.trim();

    if (trimmedFirstName.length < 2) {
      return toast.error("First name required.");
    }

    if (trimmedLastName.length < 1) {
      return toast.error("Last name required.");
    }

    if (!isValidEmail(normalizedEmailAddress)) {
      return toast.error("Valid email required.");
    }

    if (!localPhoneNumber || !isValidPhone(trimmedPhoneNumber)) {
      return toast.error("Valid phone required.");
    }

    setIsSubmittingInvite(true);

    try {
      const invitationResponse = await inviteTrainerAdminService({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: normalizedEmailAddress,
        phone: trimmedPhoneNumber,
      });

      const invitationData = invitationResponse?.data;

      const newPendingAdminInvitation = {
        invitation_id: invitationData?.invitation_id || `local-${Date.now()}`,
        name:
          invitationData?.invited_name ||
          `${trimmedFirstName} ${trimmedLastName}`,
        first_name: invitationData?.invited_first_name || trimmedFirstName,
        last_name: invitationData?.invited_last_name || trimmedLastName,
        email: invitationData?.invited_email || normalizedEmailAddress,
        phone_no: invitationData?.invited_phone || trimmedPhoneNumber,
        role: invitationData?.invited_role || "admin",
        partner_code: invitationData?.partner_code || "-",
        invited_by_user_id:
          invitationData?.invited_by_user_id || "connect@respyr.in",
        parent_user_id:
          invitationData?.parent_user_id || "connect@respyr.in",
        status: invitationData?.status || "pending",
        expires_at: invitationData?.expires_at || null,
        sent_at: new Date().toISOString(),
        accepted_at: null,
      };

      onInvitationSent(newPendingAdminInvitation);

      toast.success(
        invitationResponse?.message ||
          `Invite sent to ${newPendingAdminInvitation.name}`
      );

      resetInviteForm();
    } catch (error) {
      console.error("Invite trainer admin failed:", error);

      toast.error(
        error?.data?.message ||
          error?.message ||
          "Could not send invite. Please try again."
      );
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const inputClassName =
    "w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]";

  const labelClassName = "text-[#535359] text-[12px] font-semibold";

  return (
    <form
      onSubmit={handleInviteSubmit}
      className="bg-[#F5F7FA] rounded-[10px] p-5 flex flex-col gap-4"
    >
      <div>
        <h3 className="text-[#252525] text-[14px] font-bold">
          Invite a Trainer Admin
        </h3>
        <p className="text-[#535359] text-[12px] mt-1">
          They'll receive an email with a verification link to complete signup.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClassName}>First name <span className="text-red-500">*</span></label>
          <input
            className={inputClassName}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="Evan"
            disabled={isSubmittingInvite}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClassName}>Last name <span className="text-red-500">*</span></label>
          <input
            className={inputClassName}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Gaudet"
            disabled={isSubmittingInvite}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClassName}>Email <span className="text-red-500">*</span></label>
          <input
            className={inputClassName}
            value={emailAddress}
            onChange={(event) => setEmailAddress(event.target.value)}
            placeholder="evan@example.com"
            inputMode="email"
            disabled={isSubmittingInvite}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClassName}>Phone <span className="text-red-500">*</span></label>
          <div className="flex items-stretch rounded-[10px] border border-[#E1E6ED] bg-white transition-colors focus-within:border-[#308BF9]">
            <CountryCodeSelect
              value={countryCode}
              onChange={setCountryCode}
              disabled={isSubmittingInvite}
              buttonClass="px-2.5 py-2.5 text-[13px] border-r border-[#E1E6ED] rounded-l-[10px] hover:bg-[#F5F7FA] focus:outline-none transition-colors"
            />
            <input
              className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[13px] text-[#252525] rounded-r-[10px] focus:outline-none disabled:opacity-60"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value.replace(/[^\d\s\-()]/g, ""))}
              placeholder="555 123 4567"
              inputMode="tel"
              disabled={isSubmittingInvite}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmittingInvite}
          className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-5 py-2.5 disabled:opacity-60 cursor-pointer"
        >
          {isSubmittingInvite ? "Sending..." : "Send invite"}
        </button>

        <span className="text-[#A1A1A1] text-[11px]">
          Invite will be sent through backend verification flow.
        </span>
      </div>
    </form>
  );
}

function ExistingTrainerAdminsTable({ existingTrainerAdmins, onSelectTrainerAdmin }) {
  if (existingTrainerAdmins.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
        No Trainer Admins found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[#F5F7FA] text-[#535359] text-left">
            <th className="py-2.5 px-4 font-semibold">Name</th>
            <th className="py-2.5 px-4 font-semibold">Partner code</th>
            <th className="py-2.5 px-4 font-semibold text-right">
              Trainers
            </th>
            <th className="py-2.5 px-4 font-semibold text-right">Clients</th>
            <th className="py-2.5 px-4 font-semibold">Status</th>
          </tr>
        </thead>

        <tbody>
          {existingTrainerAdmins.map((trainerAdmin) => {
            const trainerAdminStatus = trainerAdmin?.status || "active";

            return (
              <tr
                key={trainerAdmin.role_id || trainerAdmin.user_id}
                className="border-t border-[#F5F7FA] hover:bg-[#F5F7FA]"
              >
                <td className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => onSelectTrainerAdmin(trainerAdmin)}
                    className="text-[#308BF9] font-semibold hover:underline cursor-pointer text-left"
                  >
                    {trainerAdmin.name || "-"}
                  </button>

                  <div className="text-[#A1A1A1] text-[11px]">
                    {trainerAdmin.email || "-"}
                  </div>
                </td>

                <td className="py-2.5 px-4 text-[#535359] font-mono">
                  {trainerAdmin.partner_code || "-"}
                </td>

                <td className="py-2.5 px-4 text-right text-[#252525]">
                  {trainerAdmin.trainers_count ?? 0}
                </td>

                <td className="py-2.5 px-4 text-right text-[#252525]">
                  {trainerAdmin.clients_count ?? 0}
                </td>

                <td className="py-2.5 px-4">
                  <span
                    className={`inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${
                      trainerAdminStatus === "active"
                        ? "bg-[#E5F6EE] text-[#1F7A4A]"
                        : "bg-[#FCEAEB] text-[#B5363A]"
                    }`}
                  >
                    {trainerAdminStatus}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PendingAdminInvitationsTable({ pendingAdminInvitations, onResend, onRevoke, auditLogs }) {
  const [actionInProgress, setActionInProgress] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [revokeModalInvitation, setRevokeModalInvitation] = useState(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [isSubmittingRevokeReason, setIsSubmittingRevokeReason] = useState(false);

  const toggleRow = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleResend = async (invitation) => {
    const key = `resend-${invitation.invitation_id}`;
    setActionInProgress((prev) => ({ ...prev, [key]: true }));
    try {
      await onResend(invitation);
    } finally {
      setActionInProgress((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleRevoke = async (invitation) => {
    if (isInvitationExpired(invitation)) {
      const key = `revoke-${invitation.invitation_id}`;
      setActionInProgress((prev) => ({ ...prev, [key]: true }));
      try {
        await onRevoke(invitation, "");
      } finally {
        setActionInProgress((prev) => ({ ...prev, [key]: false }));
      }
      return;
    }

    setRevokeReason("");
    setRevokeModalInvitation(invitation);
  };

  const closeRevokeModal = () => {
    if (isSubmittingRevokeReason) return;
    setRevokeModalInvitation(null);
    setRevokeReason("");
  };

  const submitRevokeReason = async () => {
    const trimmedReason = revokeReason.trim();
    if (trimmedReason.length === 0) {
      return toast.error("Please provide a reason for revoking.");
    }

    const invitation = revokeModalInvitation;
    const key = `revoke-${invitation.invitation_id}`;
    setIsSubmittingRevokeReason(true);
    setActionInProgress((prev) => ({ ...prev, [key]: true }));
    try {
      await onRevoke(invitation, trimmedReason);
      setRevokeModalInvitation(null);
      setRevokeReason("");
    } finally {
      setIsSubmittingRevokeReason(false);
      setActionInProgress((prev) => ({ ...prev, [key]: false }));
    }
  };

  if (pendingAdminInvitations.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
        No invites pending. Use the form above to invite a new Trainer Admin.
      </div>
    );
  }

  return (
    <>
    <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[#F5F7FA] text-[#535359] text-left">
            <th className="py-2.5 px-4 font-semibold">Name</th>
            <th className="py-2.5 px-4 font-semibold">Email</th>
            <th className="py-2.5 px-4 font-semibold">Phone</th>
            <th className="py-2.5 px-4 font-semibold">Partner code</th>
            <th className="py-2.5 px-4 font-semibold">Status</th>
            <th className="py-2.5 px-4 font-semibold">Expires</th>
            <th className="py-2.5 px-4 font-semibold">Actions</th>
          </tr>
        </thead>

        <tbody>
          {pendingAdminInvitations.map((pendingInvitation) => {
            const invId = pendingInvitation.invitation_id;
            const resendKey = `resend-${invId}`;
            const revokeKey = `revoke-${invId}`;
            const isExpanded = expandedRows[invId];
            const logs = auditLogs[invId] || [];

            return (
              <Fragment key={invId}>
                <tr className="border-t border-[#F5F7FA]">
                  <td className="py-2.5 px-4">
                    <button
                      type="button"
                      onClick={() => toggleRow(invId)}
                      className="flex items-center gap-1.5 text-[#252525] font-semibold hover:text-[#308BF9] cursor-pointer text-left"
                    >
                      <span className={`text-[10px] transition-transform ${isExpanded ? "rotate-90" : ""}`}>&#9654;</span>
                      {pendingInvitation.name || "-"}
                      {logs.length > 0 && (
                        <span className="text-[10px] text-[#A1A1A1] font-normal">({logs.length})</span>
                      )}
                    </button>
                  </td>

                  <td className="py-2.5 px-4 text-[#535359]">
                    {pendingInvitation.email || "-"}
                  </td>

                  <td className="py-2.5 px-4 text-[#535359]">
                    {pendingInvitation.phone_no || "-"}
                  </td>

                  <td className="py-2.5 px-4 text-[#535359] font-mono">
                    {pendingInvitation.partner_code || "-"}
                  </td>

                  <td className="py-2.5 px-4">
                    <span className="inline-flex rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-2.5 py-0.5">
                      {pendingInvitation.status || "pending"}
                    </span>
                  </td>

                  <td className="py-2.5 px-4 text-[#A1A1A1]">
                    {formatDateTime(pendingInvitation.expires_at)}
                  </td>

                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleResend(pendingInvitation)}
                        disabled={actionInProgress[resendKey]}
                        className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-2.5 py-0.5 hover:bg-[#d9e8fd] disabled:opacity-60 cursor-pointer"
                      >
                        {actionInProgress[resendKey] ? "Sending..." : "Resend"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevoke(pendingInvitation)}
                        disabled={actionInProgress[revokeKey]}
                        className="rounded-full bg-[#FCEAEB] text-[#B5363A] text-[11px] font-semibold px-2.5 py-0.5 hover:bg-[#f8d4d5] disabled:opacity-60 cursor-pointer"
                      >
                        {actionInProgress[revokeKey] ? "Revoking..." : "Revoke"}
                      </button>
                    </div>
                  </td>
                </tr>

                {isExpanded && (
                  <tr className="bg-[#FAFBFC]">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="ml-4 border-l-2 border-[#E1E6ED] pl-4">
                        <p className="text-[11px] font-semibold text-[#535359] mb-2">Audit log</p>
                        {logs.length === 0 ? (
                          <p className="text-[11px] text-[#A1A1A1]">No activity recorded yet.</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {logs.map((log, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-[11px]">
                                <span className={`inline-flex rounded-full font-semibold px-2 py-0.5 ${AUDIT_ACTION_STYLES[log.action] || "bg-[#F5F7FA] text-[#535359]"}`}>
                                  {log.action}
                                </span>
                                <span className="text-[#535359]">by <span className="font-semibold">{log.actor}</span></span>
                                {log.detail && <span className="text-[#535359] italic">{log.detail}</span>}
                                <span className="text-[#A1A1A1]">{formatAuditDate(log.timestamp)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>

    {revokeModalInvitation && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        onClick={closeRevokeModal}
      >
        <div
          className="w-full max-w-[420px] rounded-[12px] bg-white p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-[#252525] text-[15px] font-bold">
            Revoke invite
          </h3>
          <p className="text-[#535359] text-[12px] mt-1">
            Tell {revokeModalInvitation.name || revokeModalInvitation.email || "this user"} why their invite is being revoked.
          </p>

          <label className="block mt-4 text-[#535359] text-[12px] font-semibold">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            placeholder="e.g. Wrong email"
            rows={3}
            disabled={isSubmittingRevokeReason}
            className="mt-1 w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9] resize-none"
          />

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeRevokeModal}
              disabled={isSubmittingRevokeReason}
              className="rounded-[10px] bg-[#F5F7FA] text-[#535359] text-[12px] font-semibold px-4 py-2 disabled:opacity-60 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitRevokeReason}
              disabled={isSubmittingRevokeReason}
              className="rounded-[10px] bg-[#B5363A] text-white text-[12px] font-semibold px-4 py-2 disabled:opacity-60 cursor-pointer"
            >
              {isSubmittingRevokeReason ? "Revoking..." : "Submit"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default function TrainerAdminsPage() {
  const [existingTrainerAdmins, setExistingTrainerAdmins] = useState([]);
  const [pendingAdminInvitations, setPendingAdminInvitations] = useState([]);
  const [trainerAdminTotals, setTrainerAdminTotals] = useState({
    accepted_count: 0,
    pending_count: 0,
    total_trainers: 0,
    total_clients: 0,
  });

  const [auditLogs, setAuditLogs] = useState({});

  const [isLoadingTrainerAdmins, setIsLoadingTrainerAdmins] = useState(true);
  const [trainerAdminsErrorMessage, setTrainerAdminsErrorMessage] =
    useState("");

  const [selectedTrainerAdmin, setSelectedTrainerAdmin] = useState(null);

  const addAuditEntry = (invitationId, action, detail = null) => {
    setAuditLogs((prev) => ({
      ...prev,
      [invitationId]: [
        ...(prev[invitationId] || []),
        { action, actor: getActorEmail(), timestamp: new Date().toISOString(), detail },
      ],
    }));
  };

  const loadTrainerAdmins = async () => {
    setIsLoadingTrainerAdmins(true);
    setTrainerAdminsErrorMessage("");

    try {
      const trainerAdminsResponse = await fetchTrainerAdminListService();

      const existingFromApi = trainerAdminsResponse?.existing || [];

      const currentUser = getCurrentUser();
      if (currentUser?.role === "super_admin" && currentUser?.partner_code) {
        const alreadyInList = existingFromApi.some(
          (ta) => ta.user_id === currentUser.user_id || ta.partner_code === currentUser.partner_code
        );
        if (!alreadyInList) {
          const taClientsCount = existingFromApi.reduce((sum, ta) => sum + (ta.clients_count ?? 0), 0);
          const totalClients = trainerAdminsResponse?.totals?.total_clients ?? 0;

          existingFromApi.unshift({
            role_id: "sa-self",
            user_id: currentUser.user_id,
            name: `${currentUser.first_name} ${currentUser.last_name}`.trim() || "Super Admin",
            email: currentUser.email || currentUser.user_id,
            partner_code: currentUser.partner_code,
            trainers_count: existingFromApi.length,
            clients_count: Math.max(0, totalClients - taClientsCount),
            status: "active",
          });
        }
      }

      setExistingTrainerAdmins(existingFromApi);
      setPendingAdminInvitations(
        trainerAdminsResponse?.pending_invites || []
      );
      setTrainerAdminTotals(
        trainerAdminsResponse?.totals || {
          accepted_count: 0,
          pending_count: 0,
          total_trainers: 0,
          total_clients: 0,
        }
      );
    } catch (error) {
      console.error("Fetch trainer admin list failed:", error);

      const errorMessage =
        error?.data?.message ||
        error?.message ||
        "Could not load Trainer Admins.";

      setTrainerAdminsErrorMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoadingTrainerAdmins(false);
    }
  };

  useEffect(() => {
    loadTrainerAdmins();
  }, []);

  const handleAdminInvitationSent = (newAdminInvitation) => {
    setPendingAdminInvitations((currentPendingInvitations) => [
      newAdminInvitation,
      ...currentPendingInvitations,
    ]);

    setTrainerAdminTotals((currentTotals) => ({
      ...currentTotals,
      pending_count: Number(currentTotals.pending_count || 0) + 1,
    }));

    addAuditEntry(newAdminInvitation.invitation_id, "invited", `to ${newAdminInvitation.email}`);
  };

  const handleResendInvite = async (invitation) => {
    try {
      await resendTrainerAdminInviteService({
        invitationId: invitation.invitation_id,
      });
      addAuditEntry(invitation.invitation_id, "resent", `to ${invitation.email}`);
      toast.success(`Invite resent to ${invitation.name || invitation.email}`);
    } catch (error) {
      toast.error(
        error?.data?.message || error?.message || "Could not resend invite."
      );
    }
  };

  const handleRevokeInvite = async (invitation, reason = "") => {
    try {
      await revokeTrainerAdminInviteService({
        invitationId: invitation.invitation_id,
        reason,
      });
      addAuditEntry(
        invitation.invitation_id,
        "revoked",
        reason ? `reason: ${reason}` : null
      );
      setPendingAdminInvitations((current) =>
        current.filter((inv) => inv.invitation_id !== invitation.invitation_id)
      );
      setTrainerAdminTotals((currentTotals) => ({
        ...currentTotals,
        pending_count: Math.max(0, Number(currentTotals.pending_count || 0) - 1),
      }));
      toast.success(`Invite to ${invitation.name || invitation.email} revoked.`);
    } catch (error) {
      toast.error(
        error?.data?.message || error?.message || "Could not revoke invite."
      );
    }
  };

  if (selectedTrainerAdmin) {
    return (
      <TrainersList
        trainerAdmin={selectedTrainerAdmin}
        onBack={() => setSelectedTrainerAdmin(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
            Trainer Admins
          </h1>

          <p className="text-[#535359] text-[13px] mt-1">
            Invite and manage Trainer Admins. They onboard their own trainers
            and earn commission on their network.
          </p>
        </div>

        <button
          type="button"
          onClick={loadTrainerAdmins}
          disabled={isLoadingTrainerAdmins}
          className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-3 py-1 disabled:opacity-60 cursor-pointer"
        >
          {isLoadingTrainerAdmins ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-[10px] border border-[#E1E6ED] p-4">
          <p className="text-[#A1A1A1] text-[11px] font-semibold">
            Accepted Admins
          </p>
          <h3 className="text-[#252525] text-[20px] font-bold mt-1">
            {trainerAdminTotals.accepted_count ?? 0}
          </h3>
        </div>

        <div className="rounded-[10px] border border-[#E1E6ED] p-4">
          <p className="text-[#A1A1A1] text-[11px] font-semibold">
            Pending Invites
          </p>
          <h3 className="text-[#252525] text-[20px] font-bold mt-1">
            {trainerAdminTotals.pending_count ?? 0}
          </h3>
        </div>

        <div className="rounded-[10px] border border-[#E1E6ED] p-4">
          <p className="text-[#A1A1A1] text-[11px] font-semibold">
            Total Trainers
          </p>
          <h3 className="text-[#252525] text-[20px] font-bold mt-1">
            {trainerAdminTotals.total_trainers ?? 0}
          </h3>
        </div>

        <div className="rounded-[10px] border border-[#E1E6ED] p-4">
          <p className="text-[#A1A1A1] text-[11px] font-semibold">
            Total Clients
          </p>
          <h3 className="text-[#252525] text-[20px] font-bold mt-1">
            {trainerAdminTotals.total_clients ?? 0}
          </h3>
        </div>
      </div>

      <InviteForm onInvitationSent={handleAdminInvitationSent} />

      {trainerAdminsErrorMessage ? (
        <div className="rounded-[10px] border border-[#FCEAEB] bg-[#FFF7F7] p-4 text-[#B5363A] text-[12px]">
          {trainerAdminsErrorMessage}
        </div>
      ) : null}

      <div>
        <h3 className="text-[#252525] text-[14px] font-bold mb-3">
          Existing Trainer Admins
        </h3>

        {isLoadingTrainerAdmins ? (
          <div className="rounded-[10px] border border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
            Loading Trainer Admins...
          </div>
        ) : (
          <ExistingTrainerAdminsTable
            existingTrainerAdmins={existingTrainerAdmins}
            onSelectTrainerAdmin={setSelectedTrainerAdmin}
          />
        )}
      </div>

      <div>
        <h3 className="text-[#252525] text-[14px] font-bold mb-3">
          Pending invites
        </h3>

        {isLoadingTrainerAdmins ? (
          <div className="rounded-[10px] border border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
            Loading pending invites...
          </div>
        ) : (
          <PendingAdminInvitationsTable
            pendingAdminInvitations={pendingAdminInvitations}
            onResend={handleResendInvite}
            onRevoke={handleRevokeInvite}
            auditLogs={auditLogs}
          />
        )}
      </div>
    </div>
  );
}















// "use client";

// import { useState } from "react";
// import Link from "next/link";
// import { toast } from "sonner";
// import {
//   TRAINER_ADMINS,
//   trainersOf,
//   clientsUnderTA,
//   taOverrideThisMonth,
//   fmtUSDCents,
// } from "@/lib/demo-data";
// import { isSuspended } from "@/lib/demo-state";

// async function inviteTrainerAdmin({ firstName, lastName, email, phone }) {
//   await new Promise((r) => setTimeout(r, 400));
//   return {
//     ok: true,
//     invite: {
//       id: `local-${Date.now()}`,
//       first_name: firstName,
//       last_name: lastName,
//       email,
//       phone,
//       status: "Sent",
//       sentAt: new Date().toISOString(),
//     },
//   };
// }

// const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
// const isValidPhone = (p) => /^\+?[0-9\s\-()]{7,}$/.test(p);

// function InviteForm({ onSent }) {
//   const [firstName, setFirstName] = useState("");
//   const [lastName, setLastName] = useState("");
//   const [email, setEmail] = useState("");
//   const [phone, setPhone] = useState("");
//   const [submitting, setSubmitting] = useState(false);

//   const reset = () => {
//     setFirstName(""); setLastName(""); setEmail(""); setPhone("");
//   };

//   const onSubmit = async (e) => {
//     e.preventDefault();
//     if (firstName.trim().length < 2) return toast.error("First name required.");
//     if (lastName.trim().length < 1)  return toast.error("Last name required.");
//     if (!isValidEmail(email))         return toast.error("Valid email required.");
//     if (!isValidPhone(phone))         return toast.error("Valid phone required.");

//     setSubmitting(true);
//     try {
//       const res = await inviteTrainerAdmin({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim() });
//       if (!res.ok) throw new Error("Failed");
//       onSent(res.invite);
//       toast.success(`Invite sent to ${res.invite.first_name} ${res.invite.last_name}`);
//       reset();
//     } catch {
//       toast.error("Could not send invite. Please try again.");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const fieldClass = "w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9]";
//   const labelClass = "text-[#535359] text-[12px] font-semibold";

//   return (
//     <form onSubmit={onSubmit} className="bg-[#F5F7FA] rounded-[10px] p-5 flex flex-col gap-4">
//       <div>
//         <h3 className="text-[#252525] text-[14px] font-bold">Invite a Trainer Admin</h3>
//         <p className="text-[#535359] text-[12px] mt-1">
//           They'll receive an email with a verification link to complete signup.
//         </p>
//       </div>
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
//         <div className="flex flex-col gap-1"><label className={labelClass}>First name</label><input className={fieldClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Evan" /></div>
//         <div className="flex flex-col gap-1"><label className={labelClass}>Last name</label><input className={fieldClass} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Gaudet" /></div>
//         <div className="flex flex-col gap-1"><label className={labelClass}>Email</label><input className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="evan@example.com" inputMode="email" /></div>
//         <div className="flex flex-col gap-1"><label className={labelClass}>Phone</label><input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" inputMode="tel" /></div>
//       </div>
//       <div className="flex items-center gap-3">
//         <button type="submit" disabled={submitting} className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-5 py-2.5 disabled:opacity-60">
//           {submitting ? "Sending..." : "Send invite"}
//         </button>
//         <span className="text-[#A1A1A1] text-[11px]">Backend wiring (Resend email + verification flow) is pending.</span>
//       </div>
//     </form>
//   );
// }

// function ExistingTAsTable() {
//   return (
//     <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
//       <table className="w-full text-[12px]">
//         <thead>
//           <tr className="bg-[#F5F7FA] text-[#535359] text-left">
//             <th className="py-2.5 px-4 font-semibold">Name</th>
//             <th className="py-2.5 px-4 font-semibold">Partner code</th>
//             <th className="py-2.5 px-4 font-semibold text-right">Trainers</th>
//             <th className="py-2.5 px-4 font-semibold text-right">Clients</th>
//             <th className="py-2.5 px-4 font-semibold text-right">Override / mo</th>
//             <th className="py-2.5 px-4 font-semibold">Status</th>
//           </tr>
//         </thead>
//         <tbody>
//           {TRAINER_ADMINS.map((ta) => {
//             const taSuspended = isSuspended(ta.id);
//             return (
//               <tr key={ta.id} className="border-t border-[#F5F7FA] hover:bg-[#F5F7FA]">
//                 <td className="py-2.5 px-4">
//                   <Link href={`/super-admin/trainer-admins/${ta.id}`} className="text-[#308BF9] font-semibold hover:underline">
//                     {ta.first_name} {ta.last_name}
//                   </Link>
//                   <div className="text-[#A1A1A1] text-[11px]">{ta.email}</div>
//                 </td>
//                 <td className="py-2.5 px-4 text-[#535359] font-mono">{ta.partner_code}</td>
//                 <td className="py-2.5 px-4 text-right text-[#252525]">{trainersOf(ta.id).length}</td>
//                 <td className="py-2.5 px-4 text-right text-[#252525]">{clientsUnderTA(ta.id).length}</td>
//                 <td className="py-2.5 px-4 text-right text-[#252525] font-semibold">{fmtUSDCents(taOverrideThisMonth(ta.id))}</td>
//                 <td className="py-2.5 px-4">
//                   <span className={`inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${
//                     taSuspended ? "bg-[#FCEAEB] text-[#B5363A]" :
//                     ta.status === "active" ? "bg-[#E5F6EE] text-[#1F7A4A]" :
//                     "bg-[#FCEAEB] text-[#B5363A]"
//                   }`}>
//                     {taSuspended ? "suspended" : ta.status}
//                   </span>
//                 </td>
//               </tr>
//             );
//           })}
//         </tbody>
//       </table>
//     </div>
//   );
// }

// function PendingInvitesTable({ rows }) {
//   if (rows.length === 0) {
//     return (
//       <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
//         No invites pending. Use the form above to invite a new Trainer Admin.
//       </div>
//     );
//   }
//   return (
//     <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
//       <table className="w-full text-[12px]">
//         <thead>
//           <tr className="bg-[#F5F7FA] text-[#535359] text-left">
//             <th className="py-2.5 px-4 font-semibold">Name</th>
//             <th className="py-2.5 px-4 font-semibold">Email</th>
//             <th className="py-2.5 px-4 font-semibold">Phone</th>
//             <th className="py-2.5 px-4 font-semibold">Status</th>
//             <th className="py-2.5 px-4 font-semibold">Sent</th>
//           </tr>
//         </thead>
//         <tbody>
//           {rows.map((r) => (
//             <tr key={r.id} className="border-t border-[#F5F7FA]">
//               <td className="py-2.5 px-4 text-[#252525] font-semibold">{r.first_name} {r.last_name}</td>
//               <td className="py-2.5 px-4 text-[#535359]">{r.email}</td>
//               <td className="py-2.5 px-4 text-[#535359]">{r.phone}</td>
//               <td className="py-2.5 px-4"><span className="inline-flex rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-2.5 py-0.5">{r.status}</span></td>
//               <td className="py-2.5 px-4 text-[#A1A1A1]">{new Date(r.sentAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }

// export default function TrainerAdminsPage() {
//   const [invites, setInvites] = useState([]);

//   return (
//     <div className="flex flex-col gap-6">
//       <div className="flex items-start justify-between gap-4 flex-wrap">
//         <div>
//           <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
//             Trainer Admins
//           </h1>
//           <p className="text-[#535359] text-[13px] mt-1">
//             Invite and manage Trainer Admins. They onboard their own trainers and earn 20% override commission on their network.
//           </p>
//         </div>
//         <span className="rounded-full bg-[#FFF4E0] text-[#A66B00] text-[11px] font-semibold px-3 py-1">Demo data</span>
//       </div>

//       <InviteForm onSent={(inv) => setInvites((list) => [inv, ...list])} />

//       <div>
//         <h3 className="text-[#252525] text-[14px] font-bold mb-3">Existing Trainer Admins</h3>
//         <ExistingTAsTable />
//       </div>

//       <div>
//         <h3 className="text-[#252525] text-[14px] font-bold mb-3">Pending invites</h3>
//         <PendingInvitesTable rows={invites} />
//       </div>
//     </div>
//   );
// }
