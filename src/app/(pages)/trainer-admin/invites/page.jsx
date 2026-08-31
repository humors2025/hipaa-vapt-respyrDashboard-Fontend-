"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Cookies from "js-cookie";
import * as CountryFlags from "country-flag-icons/react/3x2";
import {
  inviteTrainerClientService,
  superAdminInviteTrainerService,
  // fetchTrainerClientInvitesService,
  fetchTrainerAdminTrainerSummaryService,
  fetchSuperAdminTrainerSummaryService,
  resendUserInviteService,
  superAdminResendTrainerInviteService,
  revokeTrainerClientInviteService,
  superAdminRevokeTrainerInviteService,
} from "@/services/authService";

import {
  validateHumanName,
  validateEmailAddress,
  validatePhoneNumber,
} from "@/utils/inputValidation";

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];

    const base64 = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(
          (char) =>
            `%${`00${char
              .charCodeAt(0)
              .toString(16)}`.slice(-2)}`
        )
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function getLoggedInUserFromCookie() {
  const token = Cookies.get("access_token");

  if (token) {
    const decoded = decodeJwt(token);

    if (decoded) {
      return decoded;
    }
  }

  const userCookie = Cookies.get("user");

  if (userCookie) {
    try {
      return JSON.parse(userCookie);
    } catch {
      return null;
    }
  }

  return null;
}

function getActorUserIdFromCookie() {
  const decoded = getLoggedInUserFromCookie();

  return (
    decoded?.user_id ??
    decoded?.email ??
    null
  );
}

// ---------------------------------------------------------------------------
// Data normalizers
// ---------------------------------------------------------------------------

function splitClientName(name = "") {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    first_name:
      parts[0] ?? "",

    last_name:
      parts
        .slice(1)
        .join(" "),
  };
}

function normalizeInvite(invite = {}) {
  const hasExplicitNames =
    invite.first_name ||
    invite.last_name ||
    invite.name;

  const {
    first_name: derivedFirst,
    last_name: derivedLast,
  } = hasExplicitNames
    ? {
        first_name:
          invite.first_name ?? "",

        last_name:
          invite.last_name ?? "",
      }
    : splitClientName(
        invite.name ??
          invite.client_name ??
          ""
      );

  return {
    id:
      invite.invitation_id ??
      invite.invite_id ??
      `${invite.email ?? invite.client_email}-${invite.created_at}`,

    name:
      invite.name ??
      `${derivedFirst} ${derivedLast}`.trim(),

    email:
      invite.email ??
      invite.client_email ??
      "",

    phone:
      invite.phone_no ??
      invite.client_mobile ??
      "",

    role:
      invite.role ??
      "trainer",

    plan:
      invite.plan ??
      null,

    status:
      invite.status ??
      "pending",

    sentAt:
      invite.sent_at ??
      invite.created_at ??
      invite.updated_at ??
      new Date().toISOString(),

    expires_at:
      invite.expires_at ??
      null,

    acceptedAt:
      invite.accepted_at ??
      invite.joined_date ??
      invite.created_at ??
      null,

    location:
      invite.location ??
      "",

    clients_count:
      invite.clients_count ??
      null,

    is_self:
      invite.is_self ??
      false,

    acceptedProfileId:
      invite.accepted_profile_id ??
      invite.partner_code ??
      null,

    trainer_name:
      invite.trainer_name ??
      [invite.first_name, invite.last_name]
        .filter(Boolean)
        .join(" ") ??
      "",

    trainer_code:
      invite.partner_code ??
      invite.trainer_code ??
      "",

    invited_by_user_id:
      invite.invited_by_user_id ??
      null,

    parent_user_id:
      invite.parent_user_id ??
      null,

    can_resend:
      invite.can_resend ??
      true,

    can_revoke:
      invite.can_revoke ??
      true,
  };
}

function isInvitationExpired(invitation) {
  if (
    String(
      invitation?.status || ""
    ).toLowerCase() ===
    "expired"
  ) {
    return true;
  }

  if (
    !invitation?.expires_at
  ) {
    return false;
  }

  const expiresAt = new Date(
    String(
      invitation.expires_at
    ).replace(
      " ",
      "T"
    )
  );

  if (
    Number.isNaN(
      expiresAt.getTime()
    )
  ) {
    return false;
  }

  return (
    expiresAt.getTime() <
    Date.now()
  );
}

function formatInviteDate(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const normalized =
    typeof dateValue ===
    "string"
      ? dateValue.replace(
          " ",
          "T"
        )
      : dateValue;

  const date =
    new Date(normalized);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(
      dateValue
    );
  }

  return date.toLocaleString(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  );
}

// ---------------------------------------------------------------------------
// Country dial codes
// ---------------------------------------------------------------------------

const COUNTRIES = [
  {
    code: "AF",
    name: "Afghanistan",
    dial: "+93",
  },
  {
    code: "AL",
    name: "Albania",
    dial: "+355",
  },
  {
    code: "DZ",
    name: "Algeria",
    dial: "+213",
  },
  {
    code: "AR",
    name: "Argentina",
    dial: "+54",
  },
  {
    code: "AU",
    name: "Australia",
    dial: "+61",
  },
  {
    code: "AT",
    name: "Austria",
    dial: "+43",
  },
  {
    code: "BH",
    name: "Bahrain",
    dial: "+973",
  },
  {
    code: "BD",
    name: "Bangladesh",
    dial: "+880",
  },
  {
    code: "BE",
    name: "Belgium",
    dial: "+32",
  },
  {
    code: "BR",
    name: "Brazil",
    dial: "+55",
  },
  {
    code: "BG",
    name: "Bulgaria",
    dial: "+359",
  },
  {
    code: "CA",
    name: "Canada",
    dial: "+1",
  },
  {
    code: "CL",
    name: "Chile",
    dial: "+56",
  },
  {
    code: "CN",
    name: "China",
    dial: "+86",
  },
  {
    code: "CO",
    name: "Colombia",
    dial: "+57",
  },
  {
    code: "HR",
    name: "Croatia",
    dial: "+385",
  },
  {
    code: "CZ",
    name: "Czechia",
    dial: "+420",
  },
  {
    code: "DK",
    name: "Denmark",
    dial: "+45",
  },
  {
    code: "EG",
    name: "Egypt",
    dial: "+20",
  },
  {
    code: "FI",
    name: "Finland",
    dial: "+358",
  },
  {
    code: "FR",
    name: "France",
    dial: "+33",
  },
  {
    code: "DE",
    name: "Germany",
    dial: "+49",
  },
  {
    code: "GR",
    name: "Greece",
    dial: "+30",
  },
  {
    code: "HK",
    name: "Hong Kong",
    dial: "+852",
  },
  {
    code: "HU",
    name: "Hungary",
    dial: "+36",
  },
  {
    code: "IN",
    name: "India",
    dial: "+91",
  },
  {
    code: "ID",
    name: "Indonesia",
    dial: "+62",
  },
  {
    code: "IE",
    name: "Ireland",
    dial: "+353",
  },
  {
    code: "IL",
    name: "Israel",
    dial: "+972",
  },
  {
    code: "IT",
    name: "Italy",
    dial: "+39",
  },
  {
    code: "JP",
    name: "Japan",
    dial: "+81",
  },
  {
    code: "JO",
    name: "Jordan",
    dial: "+962",
  },
  {
    code: "KE",
    name: "Kenya",
    dial: "+254",
  },
  {
    code: "KW",
    name: "Kuwait",
    dial: "+965",
  },
  {
    code: "MY",
    name: "Malaysia",
    dial: "+60",
  },
  {
    code: "MX",
    name: "Mexico",
    dial: "+52",
  },
  {
    code: "MA",
    name: "Morocco",
    dial: "+212",
  },
  {
    code: "NL",
    name: "Netherlands",
    dial: "+31",
  },
  {
    code: "NZ",
    name: "New Zealand",
    dial: "+64",
  },
  {
    code: "NG",
    name: "Nigeria",
    dial: "+234",
  },
  {
    code: "NO",
    name: "Norway",
    dial: "+47",
  },
  {
    code: "OM",
    name: "Oman",
    dial: "+968",
  },
  {
    code: "PK",
    name: "Pakistan",
    dial: "+92",
  },
  {
    code: "PH",
    name: "Philippines",
    dial: "+63",
  },
  {
    code: "PL",
    name: "Poland",
    dial: "+48",
  },
  {
    code: "PT",
    name: "Portugal",
    dial: "+351",
  },
  {
    code: "QA",
    name: "Qatar",
    dial: "+974",
  },
  {
    code: "RO",
    name: "Romania",
    dial: "+40",
  },
  {
    code: "RU",
    name: "Russia",
    dial: "+7",
  },
  {
    code: "SA",
    name: "Saudi Arabia",
    dial: "+966",
  },
  {
    code: "SG",
    name: "Singapore",
    dial: "+65",
  },
  {
    code: "ZA",
    name: "South Africa",
    dial: "+27",
  },
  {
    code: "KR",
    name: "South Korea",
    dial: "+82",
  },
  {
    code: "ES",
    name: "Spain",
    dial: "+34",
  },
  {
    code: "LK",
    name: "Sri Lanka",
    dial: "+94",
  },
  {
    code: "SE",
    name: "Sweden",
    dial: "+46",
  },
  {
    code: "CH",
    name: "Switzerland",
    dial: "+41",
  },
  {
    code: "TW",
    name: "Taiwan",
    dial: "+886",
  },
  {
    code: "TH",
    name: "Thailand",
    dial: "+66",
  },
  {
    code: "TR",
    name: "Turkey",
    dial: "+90",
  },
  {
    code: "UA",
    name: "Ukraine",
    dial: "+380",
  },
  {
    code: "AE",
    name:
      "United Arab Emirates",
    dial: "+971",
  },
  {
    code: "GB",
    name:
      "United Kingdom",
    dial: "+44",
  },
  {
    code: "US",
    name:
      "United States",
    dial: "+1",
  },
  {
    code: "VN",
    name: "Vietnam",
    dial: "+84",
  },
]
  .filter(
    (country) =>
      CountryFlags[
        country.code
      ]
  )
  .sort(
    (a, b) =>
      a.name.localeCompare(
        b.name
      )
  );

function CountryFlag({
  code,
  className,
}) {
  const Flag =
    CountryFlags[code];

  if (!Flag) {
    return null;
  }

  return (
    <Flag
      title={code}
      className={
        className
      }
    />
  );
}

function CountryCodeSelect({
  value,
  onChange,
  buttonClass,
  disabled,
}) {
  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const ref =
    useRef(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onClickOutside =
      (event) => {
        if (
          ref.current &&
          !ref.current.contains(
            event.target
          )
        ) {
          setOpen(false);
          setQuery("");
        }
      };

    document.addEventListener(
      "mousedown",
      onClickOutside
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        onClickOutside
      );
  }, [open]);

  const selected =
    COUNTRIES.find(
      (country) =>
        `${country.code}-${country.dial}` ===
        value
    ) ||
    COUNTRIES[0];

  const filtered =
    COUNTRIES.filter(
      (country) => {
        const search =
          query
            .trim()
            .toLowerCase();

        if (!search) {
          return true;
        }

        return (
          country.name
            .toLowerCase()
            .includes(
              search
            ) ||
          country.dial.includes(
            search
          ) ||
          country.code
            .toLowerCase()
            .includes(
              search
            )
        );
      }
    );

  return (
    <div
      className="relative"
      ref={ref}
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (oldValue) =>
              !oldValue
          )
        }
        disabled={
          disabled
        }
        className={`${buttonClass} flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-60`}
      >
        <CountryFlag
          code={
            selected.code
          }
          className="w-5 h-auto rounded-[2px]"
        />

        <span className="text-[#252525]">
          {
            selected.dial
          }
        </span>

        <svg
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="none"
          className="text-[#A1A1A1]"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-[10px] border border-[#E1E6ED] bg-white shadow-lg">
          <div className="p-2 border-b border-[#F5F7FA]">
            <input
              autoFocus
              value={
                query
              }
              onChange={(
                event
              ) =>
                setQuery(
                  event
                    .target
                    .value
                )
              }
              placeholder="Search country or code"
              className="w-full rounded-[8px] border border-[#E1E6ED] bg-white px-2.5 py-1.5 text-[12px] text-[#252525] focus:outline-none focus:border-[#308BF9]"
            />
          </div>

          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length ===
            0 ? (
              <li className="px-3 py-2 text-[12px] text-[#A1A1A1]">
                No matches
              </li>
            ) : (
              filtered.map(
                (
                  country
                ) => (
                  <li
                    key={`${country.code}-${country.dial}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onChange(
                          `${country.code}-${country.dial}`
                        );

                        setOpen(
                          false
                        );

                        setQuery(
                          ""
                        );
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F5F7FA] cursor-pointer"
                    >
                      <CountryFlag
                        code={
                          country.code
                        }
                        className="w-5 h-auto rounded-[2px] shrink-0"
                      />

                      <span className="flex-1 text-[#252525]">
                        {
                          country.name
                        }
                      </span>

                      <span className="text-[#A1A1A1]">
                        {
                          country.dial
                        }
                      </span>
                    </button>
                  </li>
                )
              )
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

const AUDIT_ACTION_STYLES =
  {
    invited:
      "bg-[#E5F6EE] text-[#1F7A4A]",

    resent:
      "bg-[#EEF4FE] text-[#308BF9]",

    revoked:
      "bg-[#FCEAEB] text-[#B5363A]",

    rejected:
      "bg-[#FFF4E0] text-[#A66B00]",

    "accepted (email)":
      "bg-[#E5F6EE] text-[#1F7A4A]",

    "accepted (phone)":
      "bg-[#E5F6EE] text-[#1F7A4A]",
  };

function formatAuditTimestamp(
  dateValue
) {
  if (!dateValue) {
    return "";
  }

  const date =
    new Date(
      dateValue
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(
      dateValue
    );
  }

  return date.toLocaleString(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  );
}

// ---------------------------------------------------------------------------
// Invite form
// ---------------------------------------------------------------------------

const PLANS = [
  {
    id:
      "free_trial",

    label:
      "Free Trial",

    price:
      "$0",

    badge:
      "Free",

    badgeColor:
      "bg-[#E5F6EE] text-[#1F7A4A]",
  },

  {
    id:
      "monthly",

    label:
      "Monthly Plan",

    price:
      "$50",

    badge:
      "$50/mo",

    badgeColor:
      "bg-[#EEF4FE] text-[#308BF9]",
  },

  {
    id:
      "lease",

    label:
      "Lease (Quarterly)",

    price:
      "$150",

    badge:
      "$150",

    badgeColor:
      "bg-[#FFF4E0] text-[#A66B00]",
  },

  {
    id:
      "yearly",

    label:
      "Yearly Plan",

    price:
      "$300",

    badge:
      "$300/yr",

    badgeColor:
      "bg-[#F3EEFE] text-[#6B45BC]",
  },
];

function InviteForm({
  onSent,
}) {
  const [
    firstName,
    setFirstName,
  ] =
    useState("");

  const [
    lastName,
    setLastName,
  ] =
    useState("");

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    countryCode,
    setCountryCode,
  ] =
    useState(
      "US-+1"
    );

  const [
    phone,
    setPhone,
  ] =
    useState("");

  const [
    selectedPlan,
    setSelectedPlan,
  ] =
    useState(
      "free_trial"
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(
      false
    );

  const dialCode =
    countryCode.split(
      "-"
    )[1] ||
    "+1";

  const reset =
    () => {
      setFirstName("");
      setLastName("");
      setEmail("");
      setCountryCode(
        "US-+1"
      );
      setPhone("");
      setSelectedPlan(
        "free_trial"
      );
    };

  const onSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      /*
      |--------------------------------------------------------------------------
      | First Name
      |--------------------------------------------------------------------------
      */

      const firstNameResult =
        validateHumanName(
          firstName,
          "First name",
          {
            minLength:
              2,

            maxLength:
              100,
          }
        );

      if (
        !firstNameResult.ok
      ) {
        return toast.error(
          firstNameResult.message
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Last Name
      |--------------------------------------------------------------------------
      */

      const lastNameResult =
        validateHumanName(
          lastName,
          "Last name",
          {
            minLength:
              1,

            maxLength:
              100,
          }
        );

      if (
        !lastNameResult.ok
      ) {
        return toast.error(
          lastNameResult.message
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Email
      |--------------------------------------------------------------------------
      */

      const emailResult =
        validateEmailAddress(
          email,
          "Email"
        );

      if (
        !emailResult.ok
      ) {
        return toast.error(
          emailResult.message
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Phone
      |--------------------------------------------------------------------------
      |
      | Validate the original phone input BEFORE removing characters.
      |
      | Do not do this before validation:
      |
      | phone.replace(/\D/g, "")
      |
      | because:
      |
      | +91<script>alert(1)</script>9876543210
      |
      | could otherwise become a valid-looking number.
      |--------------------------------------------------------------------------
      */

      const phoneResult =
        validatePhoneNumber(
          `${dialCode}${phone.trim()}`,
          "Phone",
          {
            required:
              true,

            minDigits:
              7,

            maxDigits:
              15,
          }
        );

      if (
        !phoneResult.ok
      ) {
        return toast.error(
          phoneResult.message
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Use only validated / normalized data after this point
      |--------------------------------------------------------------------------
      */

      const validatedFirstName =
        firstNameResult.value;

      const validatedLastName =
        lastNameResult.value;

      const validatedEmail =
        emailResult.value;

      const validatedPhone =
        phoneResult.value;

      setSubmitting(
        true
      );

      try {
        /*
        |--------------------------------------------------------------------------
        | Endpoint selection
        |--------------------------------------------------------------------------
        */

        const role =
          String(
            getLoggedInUserFromCookie()
              ?.role ||
              ""
          ).toLowerCase();

        const invite =
          role ===
          "super_admin"
            ? superAdminInviteTrainerService
            : inviteTrainerClientService;

        /*
        |--------------------------------------------------------------------------
        | Send validated values only
        |--------------------------------------------------------------------------
        */

        const response =
          await invite({
            firstName:
              validatedFirstName,

            lastName:
              validatedLastName,

            email:
              validatedEmail,

            phone:
              validatedPhone,
          });

        await onSent({
          invite_id:
            response
              ?.data
              ?.invite_id ??
            response
              ?.data
              ?.invitation_id ??
            `invite-${Date.now()}`,

          client_name:
            response
              ?.data
              ?.client_name ??
            response
              ?.data
              ?.invited_name ??
            `${validatedFirstName} ${validatedLastName}`,

          client_mobile:
            response
              ?.data
              ?.client_mobile ??
            response
              ?.data
              ?.invited_phone ??
            validatedPhone,

          client_email:
            response
              ?.data
              ?.client_email ??
            response
              ?.data
              ?.invited_email ??
            validatedEmail,

          plan:
            response
              ?.data
              ?.plan ??
            selectedPlan,

          status:
            response
              ?.data
              ?.invite_status ??
            response
              ?.data
              ?.status ??
            "pending",

          created_at:
            response
              ?.data
              ?.created_at ??
            new Date().toISOString(),

          trainer_name:
            response
              ?.data
              ?.trainer_name ??
            "",

          trainer_code:
            response
              ?.data
              ?.trainer_code ??
            response
              ?.data
              ?.partner_code ??
            "",
        });

        toast.success(
          `Invite sent to ${validatedFirstName} ${validatedLastName}`
        );

        reset();
      } catch (
        error
      ) {
        toast.error(
          error?.data?.message ||
            error?.message ||
            "Could not send invite. Please try again."
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };

  const fieldClass =
    "w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] placeholder-[#C4C9D4] focus:outline-none focus:border-[#308BF9] transition-colors";

  const labelClass =
    "text-[#535359] text-[12px] font-semibold";

  return (
    <form
      onSubmit={
        onSubmit
      }
      className="bg-[#F5F7FA] rounded-[10px] p-5 flex flex-col gap-4"
    >
      <div>
        <h3 className="text-[#252525] text-[14px] font-bold">
          Invite a Trainer
        </h3>

        <p className="text-[#535359] text-[12px] mt-1">
          They&apos;ll
          receive an email
          invite. Once they
          sign up,
          they&apos;ll be
          linked to your
          trainer account.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label
            className={
              labelClass
            }
          >
            First name{" "}
            <span className="text-red-500">
              *
            </span>
          </label>

          <input
            className={
              fieldClass
            }
            value={
              firstName
            }
            onChange={(
              event
            ) =>
              setFirstName(
                event
                  .target
                  .value
              )
            }
            placeholder="Marcus"
            disabled={
              submitting
            }
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className={
              labelClass
            }
          >
            Last name{" "}
            <span className="text-red-500">
              *
            </span>
          </label>

          <input
            className={
              fieldClass
            }
            value={
              lastName
            }
            onChange={(
              event
            ) =>
              setLastName(
                event
                  .target
                  .value
              )
            }
            placeholder="Hill"
            disabled={
              submitting
            }
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className={
              labelClass
            }
          >
            Email{" "}
            <span className="text-red-500">
              *
            </span>
          </label>

          <input
            className={
              fieldClass
            }
            value={
              email
            }
            onChange={(
              event
            ) =>
              setEmail(
                event
                  .target
                  .value
              )
            }
            placeholder="marcus@example.com"
            inputMode="email"
            disabled={
              submitting
            }
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className={
              labelClass
            }
          >
            Phone{" "}
            <span className="text-red-500">
              *
            </span>
          </label>

          <div className="flex items-stretch rounded-[10px] border border-[#E1E6ED] bg-white transition-colors focus-within:border-[#308BF9]">
            <CountryCodeSelect
              value={
                countryCode
              }
              onChange={
                setCountryCode
              }
              disabled={
                submitting
              }
              buttonClass="px-2.5 py-2.5 text-[13px] border-r border-[#E1E6ED] rounded-l-[10px] hover:bg-[#F5F7FA] focus:outline-none transition-colors"
            />

            <input
              className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[13px] text-[#252525] placeholder-[#C4C9D4] rounded-r-[10px] focus:outline-none disabled:opacity-60"
              value={
                phone
              }
              onChange={(
                event
              ) =>
                setPhone(
                  event
                    .target
                    .value
                )
              }
              placeholder="555 123 4567"
              inputMode="tel"
              disabled={
                submitting
              }
            />
          </div>
        </div>
      </div>

      {/* Plan selector currently disabled in your existing page. */}
      {/* <div className="flex flex-col gap-1.5">
        <label className={labelClass}>
          Plan <span className="text-red-500">*</span>
        </label>

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
              <span
                className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 mb-1.5 ${plan.badgeColor}`}
              >
                {plan.badge}
              </span>

              <p className="text-[12px] font-semibold text-[#252525]">
                {plan.label}
              </p>
            </button>
          ))}
        </div>
      </div> */}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={
            submitting
          }
          className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-5 py-2.5 disabled:opacity-60 hover:bg-[#1a76e8] transition-colors cursor-pointer"
        >
          {submitting
            ? "Sending…"
            : "Send invite"}
        </button>

        <span className="text-[#A1A1A1] text-[11px]">
          {
            PLANS.find(
              (plan) =>
                plan.id ===
                selectedPlan
            )?.label
          }{" "}
          — client will
          receive a code for
          this plan.
        </span>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function SectionSearch({
  value,
  onChange,
  placeholder,
}) {
  return (
    <div className="relative w-full sm:w-64 shrink-0">
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A1]"
      >
        <circle
          cx="9"
          cy="9"
          r="6"
          stroke="currentColor"
          strokeWidth="2"
        />

        <path
          d="M14 14L17 17"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      <input
        value={
          value
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target
              .value
          )
        }
        placeholder={
          placeholder
        }
        className="w-full rounded-[10px] border border-[#E1E6ED] bg-white pl-9 pr-8 py-2 text-[12px] text-[#252525] focus:outline-none focus:border-[#308BF9]"
      />

      {value && (
        <button
          type="button"
          onClick={() =>
            onChange("")
          }
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A1A1A1] hover:text-[#535359] cursor-pointer text-[14px] leading-none"
          aria-label="Clear search"
        >
          &times;
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function Pagination({
  meta,
  page,
  onPageChange,
  disabled,
}) {
  const total =
    meta?.total ??
    0;

  const limit =
    meta?.limit ??
    10;

  const offset =
    meta?.offset ??
    (page - 1) *
      limit;

  const hasMore =
    meta?.has_more ??
    false;

  const from =
    total === 0
      ? 0
      : Math.min(
          offset + 1,
          total
        );

  const to =
    Math.min(
      offset + limit,
      total
    );

  const canPrev =
    page > 1 &&
    !disabled;

  const canNext =
    hasMore &&
    !disabled;

  return (
    <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
      <p className="text-[#A1A1A1] text-[11px]">
        Showing {from}
        &ndash;{to} of{" "}
        {total}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            onPageChange(
              page - 1
            )
          }
          disabled={
            !canPrev
          }
          className="rounded-[8px] border border-[#E1E6ED] text-[#535359] text-[11px] font-semibold px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5F7FA] cursor-pointer"
        >
          Previous
        </button>

        <span className="text-[#535359] text-[11px] font-semibold">
          Page {page}
        </span>

        <button
          type="button"
          onClick={() =>
            onPageChange(
              page + 1
            )
          }
          disabled={
            !canNext
          }
          className="rounded-[8px] border border-[#E1E6ED] text-[#535359] text-[11px] font-semibold px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5F7FA] cursor-pointer"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accepted clients table
// ---------------------------------------------------------------------------

function AcceptedClientsTable({
  clients,
  hasSearch,
}) {
  if (
    clients.length ===
    0
  ) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
        {hasSearch
          ? "No trainers match your search."
          : "No accepted trainers yet."}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[#F5F7FA] text-[#535359] text-left">
            <th className="py-2.5 px-4 font-semibold">
              Name
            </th>

            <th className="py-2.5 px-4 font-semibold">
              Email
            </th>

            <th className="py-2.5 px-4 font-semibold">
              Phone
            </th>

            <th className="py-2.5 px-4 font-semibold">
              Profile ID
            </th>

            <th className="py-2.5 px-4 font-semibold">
              Clients
            </th>

            <th className="py-2.5 px-4 font-semibold">
              Status
            </th>

            <th className="py-2.5 px-4 font-semibold">
              Joined
            </th>
          </tr>
        </thead>

        <tbody>
          {clients.map(
            (client) => (
              <tr
                key={
                  client.id
                }
                className="border-t border-[#F5F7FA]"
              >
                <td className="py-2.5 px-4 text-[#252525] font-semibold">
                  {
                    client.name
                  }

                  {client.is_self && (
                    <span className="ml-1.5 inline-flex rounded-full bg-[#F3EEFE] text-[#6B45BC] text-[10px] font-semibold px-2 py-0.5">
                      You
                    </span>
                  )}
                </td>

                <td className="py-2.5 px-4 text-[#535359]">
                  {
                    client.email
                  }
                </td>

                <td className="py-2.5 px-4 text-[#535359]">
                  {
                    client.phone
                  }
                </td>

                <td className="py-2.5 px-4 text-[#535359] font-mono">
                  {client.acceptedProfileId ||
                    "-"}
                </td>

                <td className="py-2.5 px-4 text-[#535359]">
                  {client.clients_count ??
                    "-"}
                </td>

                <td className="py-2.5 px-4">
                  <span className="inline-flex rounded-full bg-[#E5F6EE] text-[#1F7A4A] text-[11px] font-semibold px-2.5 py-0.5">
                    {
                      client.status
                    }
                  </span>
                </td>

                <td className="py-2.5 px-4 text-[#A1A1A1]">
                  {formatInviteDate(
                    client.acceptedAt
                  )}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending invites
// ---------------------------------------------------------------------------

function PendingInvitesTable({
  invites,
  onResend,
  onRevoke,
  auditLogs,
}) {
  const [
    actionInProgress,
    setActionInProgress,
  ] =
    useState({});

  const [
    expandedRows,
    setExpandedRows,
  ] =
    useState({});

  const [
    revokeModalInvitation,
    setRevokeModalInvitation,
  ] =
    useState(
      null
    );

  const [
    revokeReason,
    setRevokeReason,
  ] =
    useState("");

  const [
    isSubmittingRevokeReason,
    setIsSubmittingRevokeReason,
  ] =
    useState(
      false
    );

  const toggleRow =
    (id) =>
      setExpandedRows(
        (previous) => ({
          ...previous,

          [id]:
            !previous[id],
        })
      );

  const handleResend =
    async (
      invitation
    ) => {
      const key =
        `resend-${invitation.id}`;

      setActionInProgress(
        (previous) => ({
          ...previous,

          [key]:
            true,
        })
      );

      try {
        await onResend(
          invitation
        );
      } finally {
        setActionInProgress(
          (previous) => ({
            ...previous,

            [key]:
              false,
          })
        );
      }
    };

  const handleRevoke =
    async (
      invitation
    ) => {
      if (
        isInvitationExpired(
          invitation
        )
      ) {
        const key =
          `revoke-${invitation.id}`;

        setActionInProgress(
          (previous) => ({
            ...previous,

            [key]:
              true,
          })
        );

        try {
          await onRevoke(
            invitation,
            ""
          );
        } finally {
          setActionInProgress(
            (previous) => ({
              ...previous,

              [key]:
                false,
            })
          );
        }

        return;
      }

      setRevokeReason(
        ""
      );

      setRevokeModalInvitation(
        invitation
      );
    };

  const closeRevokeModal =
    () => {
      if (
        isSubmittingRevokeReason
      ) {
        return;
      }

      setRevokeModalInvitation(
        null
      );

      setRevokeReason(
        ""
      );
    };

  const submitRevokeReason =
    async () => {
      const trimmedReason =
        revokeReason.trim();

      if (
        trimmedReason.length ===
        0
      ) {
        return toast.error(
          "Please provide a reason for revoking."
        );
      }

      const invitation =
        revokeModalInvitation;

      const key =
        `revoke-${invitation.id}`;

      setIsSubmittingRevokeReason(
        true
      );

      setActionInProgress(
        (previous) => ({
          ...previous,

          [key]:
            true,
        })
      );

      try {
        await onRevoke(
          invitation,
          trimmedReason
        );

        setRevokeModalInvitation(
          null
        );

        setRevokeReason(
          ""
        );
      } finally {
        setIsSubmittingRevokeReason(
          false
        );

        setActionInProgress(
          (previous) => ({
            ...previous,

            [key]:
              false,
          })
        );
      }
    };

  return (
    <>
      <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#F5F7FA] text-[#535359] text-left">
              <th className="py-2.5 px-4 font-semibold">
                Name
              </th>

              <th className="py-2.5 px-4 font-semibold">
                Email
              </th>

              <th className="py-2.5 px-4 font-semibold">
                Phone
              </th>

              <th className="py-2.5 px-4 font-semibold">
                Plan
              </th>

              <th className="py-2.5 px-4 font-semibold">
                Status
              </th>

              <th className="py-2.5 px-4 font-semibold">
                Sent
              </th>

              <th className="py-2.5 px-4 font-semibold">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {invites.map(
              (
                invitation
              ) => {
                const resendKey =
                  `resend-${invitation.id}`;

                const revokeKey =
                  `revoke-${invitation.id}`;

                const isExpanded =
                  expandedRows[
                    invitation.id
                  ];

                const logs =
                  auditLogs[
                    invitation.id
                  ] ||
                  [];

                return (
                  <Fragment
                    key={
                      invitation.id
                    }
                  >
                    <tr className="border-t border-[#F5F7FA]">
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() =>
                            toggleRow(
                              invitation.id
                            )
                          }
                          className="flex items-center gap-1.5 text-[#252525] font-semibold hover:text-[#308BF9] cursor-pointer text-left"
                        >
                          <span
                            className={`text-[10px] transition-transform ${
                              isExpanded
                                ? "rotate-90"
                                : ""
                            }`}
                          >
                            &#9654;
                          </span>

                          {
                            invitation.name
                          }

                          {logs.length >
                            0 && (
                            <span className="text-[10px] text-[#A1A1A1] font-normal">
                              (
                              {
                                logs.length
                              }
                              )
                            </span>
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-4 text-[#535359]">
                        {
                          invitation.email
                        }
                      </td>

                      <td className="py-2.5 px-4 text-[#535359]">
                        {
                          invitation.phone
                        }
                      </td>

                      <td className="py-2.5 px-4">
                        {invitation.plan ? (
                          <span
                            className={`inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${
                              PLANS.find(
                                (
                                  plan
                                ) =>
                                  plan.id ===
                                  invitation.plan
                              )
                                ?.badgeColor ||
                              "bg-[#F5F7FA] text-[#535359]"
                            }`}
                          >
                            {PLANS.find(
                              (
                                plan
                              ) =>
                                plan.id ===
                                invitation.plan
                            )?.badge ||
                              invitation.plan}
                          </span>
                        ) : (
                          <span className="text-[#A1A1A1]">
                            -
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${
                            String(
                              invitation.status
                            ).toLowerCase() ===
                            "expired"
                              ? "bg-[#FFF4E0] text-[#A66B00]"
                              : String(
                                    invitation.status
                                  ).toLowerCase() ===
                                  "revoked"
                                ? "bg-[#FCEAEB] text-[#B5363A]"
                                : String(
                                      invitation.status
                                    ).toLowerCase() ===
                                    "accepted"
                                  ? "bg-[#E5F6EE] text-[#1F7A4A]"
                                  : "bg-[#EEF4FE] text-[#308BF9]"
                          }`}
                        >
                          {
                            invitation.status
                          }
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-[#A1A1A1]">
                        {formatInviteDate(
                          invitation.sentAt
                        )}
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          {invitation.can_resend && (
                            <button
                              type="button"
                              onClick={() =>
                                handleResend(
                                  invitation
                                )
                              }
                              disabled={
                                actionInProgress[
                                  resendKey
                                ]
                              }
                              className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-2.5 py-0.5 hover:bg-[#d9e8fd] disabled:opacity-60 cursor-pointer"
                            >
                              {actionInProgress[
                                resendKey
                              ]
                                ? "Sending..."
                                : "Resend"}
                            </button>
                          )}

                          {invitation.can_revoke && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRevoke(
                                  invitation
                                )
                              }
                              disabled={
                                actionInProgress[
                                  revokeKey
                                ]
                              }
                              className="rounded-full bg-[#FCEAEB] text-[#B5363A] text-[11px] font-semibold px-2.5 py-0.5 hover:bg-[#f8d4d5] disabled:opacity-60 cursor-pointer"
                            >
                              {actionInProgress[
                                revokeKey
                              ]
                                ? "Revoking..."
                                : "Revoke"}
                            </button>
                          )}

                          {!invitation.can_resend &&
                            !invitation.can_revoke && (
                              <span className="text-[#A1A1A1] text-[11px]">
                                &mdash;
                              </span>
                            )}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-[#FAFBFC]">
                        <td
                          colSpan={
                            7
                          }
                          className="px-4 py-3"
                        >
                          <div className="ml-4 border-l-2 border-[#E1E6ED] pl-4">
                            <p className="text-[11px] font-semibold text-[#535359] mb-2">
                              Audit log
                            </p>

                            {logs.length ===
                            0 ? (
                              <p className="text-[11px] text-[#A1A1A1]">
                                No
                                activity
                                recorded
                                yet.
                              </p>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {logs.map(
                                  (
                                    log,
                                    index
                                  ) => (
                                    <div
                                      key={
                                        index
                                      }
                                      className="flex items-center gap-2 text-[11px]"
                                    >
                                      <span
                                        className={`inline-flex rounded-full font-semibold px-2 py-0.5 ${
                                          AUDIT_ACTION_STYLES[
                                            log
                                              .action
                                          ] ||
                                          "bg-[#F5F7FA] text-[#535359]"
                                        }`}
                                      >
                                        {
                                          log.action
                                        }
                                      </span>

                                      <span className="text-[#535359]">
                                        by{" "}
                                        <span className="font-semibold">
                                          {
                                            log.actor
                                          }
                                        </span>
                                      </span>

                                      {log.detail && (
                                        <span className="text-[#535359] italic">
                                          {
                                            log.detail
                                          }
                                        </span>
                                      )}

                                      <span className="text-[#A1A1A1]">
                                        {formatAuditTimestamp(
                                          log.timestamp
                                        )}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              }
            )}

            {invites.length ===
              0 && (
              <tr>
                <td
                  colSpan={
                    7
                  }
                  className="py-8 px-4 text-center text-[#A1A1A1] text-[12px]"
                >
                  No pending
                  invites found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {revokeModalInvitation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={
            closeRevokeModal
          }
        >
          <div
            className="w-full max-w-[420px] rounded-[12px] bg-white p-5 shadow-xl"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <h3 className="text-[#252525] text-[15px] font-bold">
              Revoke invite
            </h3>

            <p className="text-[#535359] text-[12px] mt-1">
              Tell{" "}
              {revokeModalInvitation.first_name ||
                revokeModalInvitation.name ||
                revokeModalInvitation.email ||
                "this user"}{" "}
              why their invite
              is being revoked.
            </p>

            <label className="block mt-4 text-[#535359] text-[12px] font-semibold">
              Reason{" "}
              <span className="text-red-500">
                *
              </span>
            </label>

            <textarea
              value={
                revokeReason
              }
              onChange={(
                event
              ) =>
                setRevokeReason(
                  event
                    .target
                    .value
                )
              }
              placeholder="e.g. Wrong email"
              rows={
                3
              }
              disabled={
                isSubmittingRevokeReason
              }
              className="mt-1 w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9] resize-none"
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={
                  closeRevokeModal
                }
                disabled={
                  isSubmittingRevokeReason
                }
                className="rounded-[10px] bg-[#F5F7FA] text-[#535359] text-[12px] font-semibold px-4 py-2 disabled:opacity-60 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  submitRevokeReason
                }
                disabled={
                  isSubmittingRevokeReason
                }
                className="rounded-[10px] bg-[#B5363A] text-white text-[12px] font-semibold px-4 py-2 disabled:opacity-60 cursor-pointer"
              >
                {isSubmittingRevokeReason
                  ? "Revoking..."
                  : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TrainerAdminInvitesPage() {
  const [
    user,
    setUser,
  ] =
    useState(
      null
    );

  const [
    checkingSession,
    setCheckingSession,
  ] =
    useState(
      true
    );

  const [
    acceptedClients,
    setAcceptedClients,
  ] =
    useState([]);

  const [
    pendingInvites,
    setPendingInvites,
  ] =
    useState([]);

  const [
    expiredInvites,
    setExpiredInvites,
  ] =
    useState([]);

  const [
    revokedInvites,
    setRevokedInvites,
  ] =
    useState([]);

  const [
    totals,
    setTotals,
  ] =
    useState({
      accepted_count:
        0,

      pending_count:
        0,

      expired_count:
        0,

      revoked_count:
        0,
    });

  const [
    auditLogs,
    setAuditLogs,
  ] =
    useState({});

  const [
    loadingInvites,
    setLoadingInvites,
  ] =
    useState(
      false
    );

  const [
    inviteListError,
    setInviteListError,
  ] =
    useState("");

  const PAGE_LIMIT =
    10;

  const [
    page,
    setPage,
  ] =
    useState(
      1
    );

  const [
    paginationMeta,
    setPaginationMeta,
  ] =
    useState(
      null
    );

  const MIN_SEARCH_LENGTH =
    3;

  const [
    searchTerms,
    setSearchTerms,
  ] =
    useState({
      accepted:
        "",

      pending:
        "",

      expired:
        "",

      revoked:
        "",
    });

  const updateSearchTerm =
    (
      key,
      value
    ) => {
      setSearchTerms(
        (previous) => ({
          ...previous,

          [key]:
            value,
        })
      );
    };

  const toEffectiveSearch =
    (term) => {
      const trimmed =
        term.trim();

      return trimmed.length >=
        MIN_SEARCH_LENGTH
        ? trimmed
        : "";
    };

  const effectiveSearch =
    {
      accepted:
        toEffectiveSearch(
          searchTerms.accepted
        ),

      pending:
        toEffectiveSearch(
          searchTerms.pending
        ),

      expired:
        toEffectiveSearch(
          searchTerms.expired
        ),

      revoked:
        toEffectiveSearch(
          searchTerms.revoked
        ),
    };

  const addAuditEntry =
    (
      inviteId,
      action,
      detail = null
    ) => {
      const actor =
        user?.email ||
        user?.user_id ||
        "Unknown";

      setAuditLogs(
        (previous) => ({
          ...previous,

          [inviteId]: [
            ...(
              previous[
                inviteId
              ] ||
              []
            ),

            {
              action,

              actor,

              timestamp:
                new Date().toISOString(),

              detail,
            },
          ],
        })
      );
    };

  const loadInvites =
    async (
      requestedPage = 1
    ) => {
      setLoadingInvites(
        true
      );

      setInviteListError(
        ""
      );

      try {
        const role =
          String(
            getLoggedInUserFromCookie()
              ?.role ||
              ""
          ).toLowerCase();

        const fetchSummary =
          role ===
          "super_admin"
            ? fetchSuperAdminTrainerSummaryService
            : fetchTrainerAdminTrainerSummaryService;

        const response =
          await fetchSummary({
            page:
              requestedPage,

            limit:
              PAGE_LIMIT,

            acceptedSearch:
              effectiveSearch.accepted,

            pendingSearch:
              effectiveSearch.pending,

            expiredSearch:
              effectiveSearch.expired,

            revokedSearch:
              effectiveSearch.revoked,
          });

        setPage(
          requestedPage
        );

        setPaginationMeta(
          response?.pagination ||
          null
        );

        const acceptedTrainerList =
          Array.isArray(
            response
              ?.accepted_trainers
          )
            ? response.accepted_trainers
            : [];

        const pendingInviteList =
          Array.isArray(
            response
              ?.pending_invites
          )
            ? response.pending_invites
            : [];

        const expiredInviteList =
          Array.isArray(
            response
              ?.expired_invites
          )
            ? response.expired_invites
            : [];

        const revokedInviteList =
          Array.isArray(
            response
              ?.revoked_invites
          )
            ? response.revoked_invites
            : [];

        setAcceptedClients(
          acceptedTrainerList.map(
            normalizeInvite
          )
        );

        setPendingInvites(
          pendingInviteList.map(
            normalizeInvite
          )
        );

        setExpiredInvites(
          expiredInviteList.map(
            normalizeInvite
          )
        );

        setRevokedInvites(
          revokedInviteList.map(
            normalizeInvite
          )
        );

        if (
          response?.summary
        ) {
          setTotals({
            accepted_count:
              response
                .summary
                .accepted_count ||
              0,

            pending_count:
              response
                .summary
                .pending_count ||
              0,

            expired_count:
              response
                .summary
                .expired_count ||
              0,

            revoked_count:
              response
                .summary
                .revoked_count ||
              0,
          });
        }
      } catch (
        error
      ) {
        const message =
          error?.data?.message ||
          error?.message ||
          "Could not fetch trainer summary.";

        setInviteListError(
          message
        );

        toast.error(
          message
        );
      } finally {
        setLoadingInvites(
          false
        );
      }
    };

  const listPagination =
    (key) => ({
      total:
        paginationMeta?.[
          `${key}_total`
        ] ??
        totals?.[
          `${key}_count`
        ] ??
        0,

      limit:
        paginationMeta
          ?.limit ??
        PAGE_LIMIT,

      offset:
        paginationMeta
          ?.offset ??
        (page - 1) *
          PAGE_LIMIT,

      has_more:
        !!paginationMeta?.[
          `${key}_has_more`
        ],
    });

  useEffect(() => {
    const loggedInUser =
      getLoggedInUserFromCookie();

    setUser(
      loggedInUser
    );

    setCheckingSession(
      false
    );
  }, []);

  const effectiveSearchKey =
    [
      effectiveSearch.accepted,
      effectiveSearch.pending,
      effectiveSearch.expired,
      effectiveSearch.revoked,
    ].join("|");

  useEffect(() => {
    const timeoutId =
      setTimeout(
        () => {
          loadInvites(
            1
          );
        },
        400
      );

    return () =>
      clearTimeout(
        timeoutId
      );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    effectiveSearchKey,
  ]);

  if (
    checkingSession
  ) {
    return (
      <div className="text-[#A1A1A1] text-[13px]">
        Loading&hellip;
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-[#A1A1A1] text-[13px]">
        Session expired.
        Please log in
        again.
      </div>
    );
  }

  const handleInviteSent =
    async (
      invitation
    ) => {
      const normalizedInvite =
        normalizeInvite(
          invitation
        );

      setPendingInvites(
        (previous) => [
          normalizedInvite,

          ...previous.filter(
            (item) =>
              item.id !==
              normalizedInvite.id
          ),
        ]
      );

      const planLabel =
        PLANS.find(
          (plan) =>
            plan.id ===
            normalizedInvite.plan
        )?.label ||
        normalizedInvite.plan;

      addAuditEntry(
        normalizedInvite.id,
        "invited",
        `to ${normalizedInvite.email} — ${planLabel}`
      );

      await loadInvites();
    };

  const handleResendInvite =
    async (
      invitation
    ) => {
      try {
        const role =
          String(
            getLoggedInUserFromCookie()
              ?.role ||
              ""
          ).toLowerCase();

        const resend =
          role ===
          "super_admin"
            ? superAdminResendTrainerInviteService
            : resendUserInviteService;

        await resend({
          inviteId:
            invitation.id,
        });

        addAuditEntry(
          invitation.id,
          "resent",
          `to ${invitation.email}`
        );

        toast.success(
          `Invite resent to ${
            invitation.name ||
            invitation.email
          }`
        );

        await loadInvites();
      } catch (
        error
      ) {
        toast.error(
          error?.data?.message ||
            error?.message ||
            "Could not resend invite."
        );
      }
    };

  const handleRevokeInvite =
    async (
      invitation,
      reason = ""
    ) => {
      try {
        const role =
          String(
            getLoggedInUserFromCookie()
              ?.role ||
              ""
          ).toLowerCase();

        const revoke =
          role ===
          "super_admin"
            ? superAdminRevokeTrainerInviteService
            : revokeTrainerClientInviteService;

        await revoke({
          inviteId:
            invitation.id,

          reason,
        });

        addAuditEntry(
          invitation.id,
          "revoked",
          reason
            ? `reason: ${reason}`
            : null
        );

        setPendingInvites(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !==
                invitation.id
            )
        );

        toast.success(
          `Invite to ${
            invitation.name ||
            invitation.email
          } revoked.`
        );
      } catch (
        error
      ) {
        toast.error(
          error?.data?.message ||
            error?.message ||
            "Could not revoke invite."
        );
      }
    };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
          Invites Trainer
        </h1>

        <p className="text-[#535359] text-[13px] mt-1">
          Send client invites
          and track their
          status.
        </p>
      </div>

      <InviteForm
        onSent={
          handleInviteSent
        }
      />

      {inviteListError && (
        <div className="rounded-[10px] border border-[#FCEAEB] bg-[#FFF7F7] text-[#B5363A] text-[12px] p-3">
          {
            inviteListError
          }
        </div>
      )}

      {/* Totals */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          {
            label:
              "Accepted",

            value:
              totals.accepted_count,

            color:
              "text-[#1F7A4A]",
          },

          {
            label:
              "Pending",

            value:
              totals.pending_count,

            color:
              "text-[#308BF9]",
          },

          {
            label:
              "Expired",

            value:
              totals.expired_count,

            color:
              "text-[#A66B00]",
          },

          {
            label:
              "Revoked",

            value:
              totals.revoked_count,

            color:
              "text-[#B5363A]",
          },
        ].map(
          (
            tile
          ) => (
            <div
              key={
                tile.label
              }
              className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5"
            >
              <p className="text-[11px] text-[#535359] font-semibold">
                {
                  tile.label
                }
              </p>

              <p
                className={`text-[16px] font-bold ${tile.color}`}
              >
                {tile.value ??
                  0}
              </p>
            </div>
          )
        )}
      </div>

      {/* Accepted trainers */}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-[#252525] text-[14px] font-bold">
            Accepted
            trainers{" "}
            <span className="ml-2 text-[#A1A1A1] text-[12px] font-normal">
              (
              {
                totals.accepted_count
              }
              )
            </span>
          </h3>

          <SectionSearch
            value={
              searchTerms.accepted
            }
            onChange={(value) =>
              updateSearchTerm(
                "accepted",
                value
              )
            }
            placeholder="Search name, email, code"
          />
        </div>

        {loadingInvites ? (
          <div className="text-[#A1A1A1] text-[13px]">
            Loading&hellip;
          </div>
        ) : (
          <>
            <AcceptedClientsTable
              clients={
                acceptedClients
              }
              hasSearch={
                !!effectiveSearch.accepted
              }
            />

            {listPagination(
              "accepted"
            ).total >
              0 && (
              <Pagination
                meta={listPagination(
                  "accepted"
                )}
                page={
                  page
                }
                onPageChange={
                  loadInvites
                }
                disabled={
                  loadingInvites
                }
              />
            )}
          </>
        )}
      </div>

      {/* Pending invites */}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-[#252525] text-[14px] font-bold">
            Pending invites{" "}
            <span className="ml-2 text-[#A1A1A1] text-[12px] font-normal">
              (
              {
                totals.pending_count
              }
              )
            </span>
          </h3>

          <SectionSearch
            value={
              searchTerms.pending
            }
            onChange={(value) =>
              updateSearchTerm(
                "pending",
                value
              )
            }
            placeholder="Search name, email, code"
          />
        </div>

        {loadingInvites ? (
          <div className="text-[#A1A1A1] text-[13px]">
            Loading&hellip;
          </div>
        ) : (
          <>
            <PendingInvitesTable
              invites={
                pendingInvites
              }
              onResend={
                handleResendInvite
              }
              onRevoke={
                handleRevokeInvite
              }
              auditLogs={
                auditLogs
              }
            />

            {listPagination(
              "pending"
            ).total >
              0 && (
              <Pagination
                meta={listPagination(
                  "pending"
                )}
                page={
                  page
                }
                onPageChange={
                  loadInvites
                }
                disabled={
                  loadingInvites
                }
              />
            )}
          </>
        )}
      </div>

      {/* Expired invites */}

      {(
        expiredInvites.length >
          0 ||
        searchTerms.expired
      ) && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-[#252525] text-[14px] font-bold">
              Expired
              invites{" "}
              <span className="ml-2 text-[#A1A1A1] text-[12px] font-normal">
                (
                {
                  totals.expired_count
                }
                )
              </span>
            </h3>

            <SectionSearch
              value={
                searchTerms.expired
              }
              onChange={(value) =>
                updateSearchTerm(
                  "expired",
                  value
                )
              }
              placeholder="Search name, email, code"
            />
          </div>

          <PendingInvitesTable
            invites={
              expiredInvites
            }
            onResend={
              handleResendInvite
            }
            onRevoke={
              handleRevokeInvite
            }
            auditLogs={
              auditLogs
            }
          />

          {listPagination(
            "expired"
          ).total >
            0 && (
            <Pagination
              meta={listPagination(
                "expired"
              )}
              page={
                page
              }
              onPageChange={
                loadInvites
              }
              disabled={
                loadingInvites
              }
            />
          )}
        </div>
      )}

      {/* Revoked invites */}

      {(
        revokedInvites.length >
          0 ||
        searchTerms.revoked
      ) && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-[#252525] text-[14px] font-bold">
              Revoked
              invites{" "}
              <span className="ml-2 text-[#A1A1A1] text-[12px] font-normal">
                (
                {
                  totals.revoked_count
                }
                )
              </span>
            </h3>

            <SectionSearch
              value={
                searchTerms.revoked
              }
              onChange={(value) =>
                updateSearchTerm(
                  "revoked",
                  value
                )
              }
              placeholder="Search name, email, code"
            />
          </div>

          <PendingInvitesTable
            invites={
              revokedInvites
            }
            onResend={
              handleResendInvite
            }
            onRevoke={
              handleRevokeInvite
            }
            auditLogs={
              auditLogs
            }
          />

          {listPagination(
            "revoked"
          ).total >
            0 && (
            <Pagination
              meta={listPagination(
                "revoked"
              )}
              page={
                page
              }
              onPageChange={
                loadInvites
              }
              disabled={
                loadingInvites
              }
            />
          )}
        </div>
      )}
    </div>
  );
}












// "use client";

// import { Fragment, useEffect, useRef, useState } from "react";
// import { toast } from "sonner";
// import Cookies from "js-cookie";
// import * as CountryFlags from "country-flag-icons/react/3x2";
// import {
//   inviteTrainerClientService,
//   superAdminInviteTrainerService,
//   // fetchTrainerClientInvitesService,
//   fetchTrainerAdminTrainerSummaryService,
//   fetchSuperAdminTrainerSummaryService,
//   resendUserInviteService,
//   superAdminResendTrainerInviteService,
//   revokeTrainerClientInviteService,
//   superAdminRevokeTrainerInviteService,
// } from "@/services/authService";

// // ---------------------------------------------------------------------------
// // JWT helpers
// // ---------------------------------------------------------------------------
// function decodeJwt(token) {
//   try {
//     const payload = token.split(".")[1];
//     const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
//     const jsonPayload = decodeURIComponent(
//       atob(base64)
//         .split("")
//         .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
//         .join("")
//     );
//     return JSON.parse(jsonPayload);
//   } catch {
//     return null;
//   }
// }

// function getLoggedInUserFromCookie() {
//   const token = Cookies.get("access_token");
//   if (token) {
//     const decoded = decodeJwt(token);
//     if (decoded) return decoded;
//   }
//   const userCookie = Cookies.get("user");
//   if (userCookie) {
//     try { return JSON.parse(userCookie); } catch { return null; }
//   }
//   return null;
// }

// function getActorUserIdFromCookie() {
//   const decoded = getLoggedInUserFromCookie();
//   return decoded?.user_id ?? decoded?.email ?? null;
// }

// // ---------------------------------------------------------------------------
// // Data normalizers
// // ---------------------------------------------------------------------------
// function splitClientName(name = "") {
//   const parts = String(name).trim().split(/\s+/).filter(Boolean);
//   return { first_name: parts[0] ?? "", last_name: parts.slice(1).join(" ") };
// }

// function normalizeInvite(invite = {}) {
//   // const hasExplicitNames = invite.first_name || invite.last_name;
//   const hasExplicitNames =
//   invite.first_name ||
//   invite.last_name ||
//   invite.name;
//   const { first_name: derivedFirst, last_name: derivedLast } = hasExplicitNames
//     ? { first_name: invite.first_name ?? "", last_name: invite.last_name ?? "" }
//     :  splitClientName(
//     invite.name ??
//     invite.client_name ??
//     ""
//   );

//   return {
//     id: invite.invitation_id ?? invite.invite_id ?? `${invite.email ?? invite.client_email}-${invite.created_at}`,
//     // first_name: derivedFirst,
//     // last_name: derivedLast,
//     name:invite.name ?? `${derivedFirst} ${derivedLast}`.trim(),
//     email: invite.email ?? invite.client_email ?? "",
//     phone: invite.phone_no ?? invite.client_mobile ?? "",
//     role: invite.role ?? "trainer",
//     plan: invite.plan ?? null,
//     status: invite.status ?? "pending",
//     sentAt: invite.sent_at ?? invite.created_at ?? invite.updated_at ?? new Date().toISOString(),
//     expires_at: invite.expires_at ?? null,
//     acceptedAt: invite.accepted_at ?? invite.joined_date ?? invite.created_at ?? null,
//     location: invite.location ?? "",
//     clients_count: invite.clients_count ?? null,
//     is_self: invite.is_self ?? false,
//     acceptedProfileId: invite.accepted_profile_id ?? invite.partner_code ?? null,
//     trainer_name: invite.trainer_name ?? [invite.first_name, invite.last_name].filter(Boolean).join(" ") ?? "",
//     trainer_code: invite.partner_code ?? invite.trainer_code ?? "",
//     invited_by_user_id: invite.invited_by_user_id ?? null,
//     parent_user_id: invite.parent_user_id ?? null,
//     can_resend: invite.can_resend ?? true,
//     can_revoke: invite.can_revoke ?? true,
//   };
// }

// function isInvitationExpired(invitation) {
//   if (String(invitation?.status || "").toLowerCase() === "expired") return true;
//   if (!invitation?.expires_at) return false;
//   const expiresAt = new Date(String(invitation.expires_at).replace(" ", "T"));
//   if (Number.isNaN(expiresAt.getTime())) return false;
//   return expiresAt.getTime() < Date.now();
// }

// function formatInviteDate(dateValue) {
//   if (!dateValue) return "-";
//   const normalized = typeof dateValue === "string" ? dateValue.replace(" ", "T") : dateValue;
//   const date = new Date(normalized);
//   if (Number.isNaN(date.getTime())) return String(dateValue);
//   return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
// }

// // ---------------------------------------------------------------------------
// // Validators
// // ---------------------------------------------------------------------------
// const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
// const isValidPhone = (p) => /^\+?[0-9\s\-()]{7,}$/.test(p);

// // Country dial codes for the phone input
// const COUNTRIES = [
//   { code: "AF", name: "Afghanistan", dial: "+93" },
//   { code: "AL", name: "Albania", dial: "+355" },
//   { code: "DZ", name: "Algeria", dial: "+213" },
//   { code: "AR", name: "Argentina", dial: "+54" },
//   { code: "AU", name: "Australia", dial: "+61" },
//   { code: "AT", name: "Austria", dial: "+43" },
//   { code: "BH", name: "Bahrain", dial: "+973" },
//   { code: "BD", name: "Bangladesh", dial: "+880" },
//   { code: "BE", name: "Belgium", dial: "+32" },
//   { code: "BR", name: "Brazil", dial: "+55" },
//   { code: "BG", name: "Bulgaria", dial: "+359" },
//   { code: "CA", name: "Canada", dial: "+1" },
//   { code: "CL", name: "Chile", dial: "+56" },
//   { code: "CN", name: "China", dial: "+86" },
//   { code: "CO", name: "Colombia", dial: "+57" },
//   { code: "HR", name: "Croatia", dial: "+385" },
//   { code: "CZ", name: "Czechia", dial: "+420" },
//   { code: "DK", name: "Denmark", dial: "+45" },
//   { code: "EG", name: "Egypt", dial: "+20" },
//   { code: "FI", name: "Finland", dial: "+358" },
//   { code: "FR", name: "France", dial: "+33" },
//   { code: "DE", name: "Germany", dial: "+49" },
//   { code: "GR", name: "Greece", dial: "+30" },
//   { code: "HK", name: "Hong Kong", dial: "+852" },
//   { code: "HU", name: "Hungary", dial: "+36" },
//   { code: "IN", name: "India", dial: "+91" },
//   { code: "ID", name: "Indonesia", dial: "+62" },
//   { code: "IE", name: "Ireland", dial: "+353" },
//   { code: "IL", name: "Israel", dial: "+972" },
//   { code: "IT", name: "Italy", dial: "+39" },
//   { code: "JP", name: "Japan", dial: "+81" },
//   { code: "JO", name: "Jordan", dial: "+962" },
//   { code: "KE", name: "Kenya", dial: "+254" },
//   { code: "KW", name: "Kuwait", dial: "+965" },
//   { code: "MY", name: "Malaysia", dial: "+60" },
//   { code: "MX", name: "Mexico", dial: "+52" },
//   { code: "MA", name: "Morocco", dial: "+212" },
//   { code: "NL", name: "Netherlands", dial: "+31" },
//   { code: "NZ", name: "New Zealand", dial: "+64" },
//   { code: "NG", name: "Nigeria", dial: "+234" },
//   { code: "NO", name: "Norway", dial: "+47" },
//   { code: "OM", name: "Oman", dial: "+968" },
//   { code: "PK", name: "Pakistan", dial: "+92" },
//   { code: "PH", name: "Philippines", dial: "+63" },
//   { code: "PL", name: "Poland", dial: "+48" },
//   { code: "PT", name: "Portugal", dial: "+351" },
//   { code: "QA", name: "Qatar", dial: "+974" },
//   { code: "RO", name: "Romania", dial: "+40" },
//   { code: "RU", name: "Russia", dial: "+7" },
//   { code: "SA", name: "Saudi Arabia", dial: "+966" },
//   { code: "SG", name: "Singapore", dial: "+65" },
//   { code: "ZA", name: "South Africa", dial: "+27" },
//   { code: "KR", name: "South Korea", dial: "+82" },
//   { code: "ES", name: "Spain", dial: "+34" },
//   { code: "LK", name: "Sri Lanka", dial: "+94" },
//   { code: "SE", name: "Sweden", dial: "+46" },
//   { code: "CH", name: "Switzerland", dial: "+41" },
//   { code: "TW", name: "Taiwan", dial: "+886" },
//   { code: "TH", name: "Thailand", dial: "+66" },
//   { code: "TR", name: "Turkey", dial: "+90" },
//   { code: "UA", name: "Ukraine", dial: "+380" },
//   { code: "AE", name: "United Arab Emirates", dial: "+971" },
//   { code: "GB", name: "United Kingdom", dial: "+44" },
//   { code: "US", name: "United States", dial: "+1" },
//   { code: "VN", name: "Vietnam", dial: "+84" },
// ]
//   .filter((c) => CountryFlags[c.code])
//   .sort((a, b) => a.name.localeCompare(b.name));

// // Renders the SVG flag for a given ISO country code
// function CountryFlag({ code, className }) {
//   const Flag = CountryFlags[code];
//   if (!Flag) return null;
//   return <Flag title={code} className={className} />;
// }

// function CountryCodeSelect({ value, onChange, buttonClass, disabled }) {
//   const [open, setOpen] = useState(false);
//   const [query, setQuery] = useState("");
//   const ref = useRef(null);

//   useEffect(() => {
//     if (!open) return;
//     const onClickOutside = (e) => {
//       if (ref.current && !ref.current.contains(e.target)) {
//         setOpen(false);
//         setQuery("");
//       }
//     };
//     document.addEventListener("mousedown", onClickOutside);
//     return () => document.removeEventListener("mousedown", onClickOutside);
//   }, [open]);

//   const selected =
//     COUNTRIES.find((c) => `${c.code}-${c.dial}` === value) || COUNTRIES[0];

//   const filtered = COUNTRIES.filter((c) => {
//     const q = query.trim().toLowerCase();
//     if (!q) return true;
//     return (
//       c.name.toLowerCase().includes(q) ||
//       c.dial.includes(q) ||
//       c.code.toLowerCase().includes(q)
//     );
//   });

//   return (
//     <div className="relative" ref={ref}>
//       <button
//         type="button"
//         onClick={() => setOpen((o) => !o)}
//         disabled={disabled}
//         className={`${buttonClass} flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-60`}
//       >
//         <CountryFlag code={selected.code} className="w-5 h-auto rounded-[2px]" />
//         <span className="text-[#252525]">{selected.dial}</span>
//         <svg width="12" height="12" viewBox="0 0 20 20" fill="none" className="text-[#A1A1A1]">
//           <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
//         </svg>
//       </button>

//       {open && (
//         <div className="absolute z-20 mt-1 w-64 rounded-[10px] border border-[#E1E6ED] bg-white shadow-lg">
//           <div className="p-2 border-b border-[#F5F7FA]">
//             <input
//               autoFocus
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//               placeholder="Search country or code"
//               className="w-full rounded-[8px] border border-[#E1E6ED] bg-white px-2.5 py-1.5 text-[12px] text-[#252525] focus:outline-none focus:border-[#308BF9]"
//             />
//           </div>
//           <ul className="max-h-56 overflow-y-auto py-1">
//             {filtered.length === 0 ? (
//               <li className="px-3 py-2 text-[12px] text-[#A1A1A1]">No matches</li>
//             ) : (
//               filtered.map((c) => (
//                 <li key={`${c.code}-${c.dial}`}>
//                   <button
//                     type="button"
//                     onClick={() => {
//                       onChange(`${c.code}-${c.dial}`);
//                       setOpen(false);
//                       setQuery("");
//                     }}
//                     className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F5F7FA] cursor-pointer"
//                   >
//                     <CountryFlag code={c.code} className="w-5 h-auto rounded-[2px] shrink-0" />
//                     <span className="flex-1 text-[#252525]">{c.name}</span>
//                     <span className="text-[#A1A1A1]">{c.dial}</span>
//                   </button>
//                 </li>
//               ))
//             )}
//           </ul>
//         </div>
//       )}
//     </div>
//   );
// }

// const AUDIT_ACTION_STYLES = {
//   invited: "bg-[#E5F6EE] text-[#1F7A4A]",
//   resent: "bg-[#EEF4FE] text-[#308BF9]",
//   revoked: "bg-[#FCEAEB] text-[#B5363A]",
//   rejected: "bg-[#FFF4E0] text-[#A66B00]",
//   "accepted (email)": "bg-[#E5F6EE] text-[#1F7A4A]",
//   "accepted (phone)": "bg-[#E5F6EE] text-[#1F7A4A]",
// };

// function formatAuditTimestamp(dateValue) {
//   if (!dateValue) return "";
//   const d = new Date(dateValue);
//   if (Number.isNaN(d.getTime())) return String(dateValue);
//   return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
// }

// // ---------------------------------------------------------------------------
// // InviteForm
// // ---------------------------------------------------------------------------
// const PLANS = [
//   { id: "free_trial", label: "Free Trial", price: "$0", badge: "Free", badgeColor: "bg-[#E5F6EE] text-[#1F7A4A]" },
//   { id: "monthly", label: "Monthly Plan", price: "$50", badge: "$50/mo", badgeColor: "bg-[#EEF4FE] text-[#308BF9]" },
//   { id: "lease", label: "Lease (Quarterly)", price: "$150", badge: "$150", badgeColor: "bg-[#FFF4E0] text-[#A66B00]" },
//   { id: "yearly", label: "Yearly Plan", price: "$300", badge: "$300/yr", badgeColor: "bg-[#F3EEFE] text-[#6B45BC]" },
// ];

// function InviteForm({ onSent }) {
//   const [firstName, setFirstName] = useState("");
//   const [lastName, setLastName] = useState("");
//   const [email, setEmail] = useState("");
//   const [countryCode, setCountryCode] = useState("US-+1");
//   const [phone, setPhone] = useState("");
//   const [selectedPlan, setSelectedPlan] = useState("free_trial");
//   const [submitting, setSubmitting] = useState(false);

//   const dialCode = countryCode.split("-")[1] || "+1";
//   const fullPhone = `${dialCode}${phone.replace(/\D/g, "")}`.trim();

//   const reset = () => { setFirstName(""); setLastName(""); setEmail(""); setCountryCode("US-+1"); setPhone(""); setSelectedPlan("free_trial"); };

//   const onSubmit = async (e) => {
//     e.preventDefault();
//     if (firstName.trim().length < 2) return toast.error("First name required.");
//     if (lastName.trim().length < 1) return toast.error("Last name required.");
//     if (!isValidEmail(email)) return toast.error("Valid email required.");
//     if (!phone.trim() || !isValidPhone(fullPhone)) return toast.error("Valid phone required.");

//     setSubmitting(true);
//     try {
//       // Super admins invite trainers through their own endpoint
//       // (super-admin-invite-trainer.php); trainer admins use the trainer-admin
//       // endpoint. Both take the same payload, so we just swap the service.
//       const role = String(getLoggedInUserFromCookie()?.role || "").toLowerCase();
//       const invite =
//         role === "super_admin"
//           ? superAdminInviteTrainerService
//           : inviteTrainerClientService;

//       const res = await invite({
//         firstName: firstName.trim(),
//         lastName: lastName.trim(),
//         email: email.trim(),
//         phone: fullPhone,
//       });

//       await onSent({
//         invite_id: res?.data?.invite_id ?? res?.data?.invitation_id ?? `invite-${Date.now()}`,
//         client_name: res?.data?.client_name ?? res?.data?.invited_name ?? `${firstName.trim()} ${lastName.trim()}`,
//         client_mobile: res?.data?.client_mobile ?? res?.data?.invited_phone ?? fullPhone,
//         client_email: res?.data?.client_email ?? res?.data?.invited_email ?? email.trim(),
//         plan: res?.data?.plan ?? selectedPlan,
//         status: res?.data?.invite_status ?? res?.data?.status ?? "pending",
//         created_at: res?.data?.created_at ?? new Date().toISOString(),
//         trainer_name: res?.data?.trainer_name ?? "",
//         trainer_code: res?.data?.trainer_code ?? res?.data?.partner_code ?? "",
//       });

//       toast.success(`Invite sent to ${firstName.trim()} ${lastName.trim()}`);
//       reset();
//     } catch (err) {
//       toast.error(err?.message || "Could not send invite. Please try again.");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const fieldClass = "w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] placeholder-[#C4C9D4] focus:outline-none focus:border-[#308BF9] transition-colors";
//   const labelClass = "text-[#535359] text-[12px] font-semibold";

//   return (
//     <form onSubmit={onSubmit} className="bg-[#F5F7FA] rounded-[10px] p-5 flex flex-col gap-4">
//       <div>
//         <h3 className="text-[#252525] text-[14px] font-bold">Invite a Trainer</h3>
//         <p className="text-[#535359] text-[12px] mt-1">
//           They&apos;ll receive an email invite. Once they sign up, they&apos;ll be linked to your trainer account.
//         </p>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
//         <div className="flex flex-col gap-1">
//           <label className={labelClass}>First name <span className="text-red-500">*</span></label>
//           <input className={fieldClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Marcus" />
//         </div>
//         <div className="flex flex-col gap-1">
//           <label className={labelClass}>Last name <span className="text-red-500">*</span></label>
//           <input className={fieldClass} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Hill" />
//         </div>
//         <div className="flex flex-col gap-1">
//           <label className={labelClass}>Email <span className="text-red-500">*</span></label>
//           <input className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="marcus@example.com" inputMode="email" />
//         </div>
//         <div className="flex flex-col gap-1">
//           <label className={labelClass}>Phone <span className="text-red-500">*</span></label>
//           <div className="flex items-stretch rounded-[10px] border border-[#E1E6ED] bg-white transition-colors focus-within:border-[#308BF9]">
//             <CountryCodeSelect
//               value={countryCode}
//               onChange={setCountryCode}
//               disabled={submitting}
//               buttonClass="px-2.5 py-2.5 text-[13px] border-r border-[#E1E6ED] rounded-l-[10px] hover:bg-[#F5F7FA] focus:outline-none transition-colors"
//             />
//             <input
//               className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[13px] text-[#252525] placeholder-[#C4C9D4] rounded-r-[10px] focus:outline-none"
//               value={phone}
//               onChange={(e) => setPhone(e.target.value.replace(/[^\d\s\-()]/g, ""))}
//               placeholder="555 123 4567"
//               inputMode="tel"
//             />
//           </div>
//         </div>
//       </div>

//       {/* <div className="flex flex-col gap-1.5">
//         <label className={labelClass}>Plan <span className="text-red-500">*</span></label>
//         <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
//           {PLANS.map((plan) => (
//             <button
//               key={plan.id}
//               type="button"
//               onClick={() => setSelectedPlan(plan.id)}
//               className={`rounded-[10px] border px-3 py-2.5 text-left transition-all cursor-pointer ${
//                 selectedPlan === plan.id
//                   ? "border-[#308BF9] bg-[#EEF4FE] ring-1 ring-[#308BF9]"
//                   : "border-[#E1E6ED] bg-white hover:border-[#C4C9D4]"
//               }`}
//             >
//               <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 mb-1.5 ${plan.badgeColor}`}>{plan.badge}</span>
//               <p className="text-[12px] font-semibold text-[#252525]">{plan.label}</p>
//             </button>
//           ))}
//         </div>
//       </div> */}

//       <div className="flex items-center gap-3">
//         <button type="submit" disabled={submitting} className="rounded-[10px] bg-[#308BF9] text-white text-[13px] font-semibold px-5 py-2.5 disabled:opacity-60 hover:bg-[#1a76e8] transition-colors cursor-pointer">
//           {submitting ? "Sending\u2026" : "Send invite"}
//         </button>
//         <span className="text-[#A1A1A1] text-[11px]">
//           {PLANS.find((p) => p.id === selectedPlan)?.label} — client will receive a code for this plan.
//         </span>
//       </div>
//     </form>
//   );
// }

// // ---------------------------------------------------------------------------
// // SectionSearch — server-side search box shown next to each section heading.
// // The summary endpoint takes a separate search term per list
// // (accepted_search / pending_search / expired_search / revoked_search).
// // ---------------------------------------------------------------------------
// function SectionSearch({ value, onChange, placeholder }) {
//   return (
//     <div className="relative w-full sm:w-64 shrink-0">
//       <svg
//         width="14"
//         height="14"
//         viewBox="0 0 20 20"
//         fill="none"
//         className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A1]"
//       >
//         <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
//         <path d="M14 14L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
//       </svg>
//       <input
//         value={value}
//         onChange={(e) => onChange(e.target.value)}
//         placeholder={placeholder}
//         className="w-full rounded-[10px] border border-[#E1E6ED] bg-white pl-9 pr-8 py-2 text-[12px] text-[#252525] focus:outline-none focus:border-[#308BF9]"
//       />
//       {value && (
//         <button
//           type="button"
//           onClick={() => onChange("")}
//           className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A1A1A1] hover:text-[#535359] cursor-pointer text-[14px] leading-none"
//           aria-label="Clear search"
//         >
//           &times;
//         </button>
//       )}
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // Pagination — the summary endpoint pages all four lists with one shared
// // `page`, returning per-list totals and has_more flags. Each section shows
// // its own "Showing X–Y of Z" but Previous/Next moves the shared page.
// // ---------------------------------------------------------------------------
// function Pagination({ meta, page, onPageChange, disabled }) {
//   const total = meta?.total ?? 0;
//   const limit = meta?.limit ?? 10;
//   const offset = meta?.offset ?? (page - 1) * limit;
//   const hasMore = meta?.has_more ?? false;

//   const from = total === 0 ? 0 : Math.min(offset + 1, total);
//   const to = Math.min(offset + limit, total);
//   const canPrev = page > 1 && !disabled;
//   const canNext = hasMore && !disabled;

//   return (
//     <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
//       <p className="text-[#A1A1A1] text-[11px]">
//         Showing {from}&ndash;{to} of {total}
//       </p>
//       <div className="flex items-center gap-2">
//         <button
//           type="button"
//           onClick={() => onPageChange(page - 1)}
//           disabled={!canPrev}
//           className="rounded-[8px] border border-[#E1E6ED] text-[#535359] text-[11px] font-semibold px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5F7FA] cursor-pointer"
//         >
//           Previous
//         </button>
//         <span className="text-[#535359] text-[11px] font-semibold">
//           Page {page}
//         </span>
//         <button
//           type="button"
//           onClick={() => onPageChange(page + 1)}
//           disabled={!canNext}
//           className="rounded-[8px] border border-[#E1E6ED] text-[#535359] text-[11px] font-semibold px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5F7FA] cursor-pointer"
//         >
//           Next
//         </button>
//       </div>
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // AcceptedClientsTable — search is server-side (accepted_search), so this
// // just renders whatever the summary endpoint returned.
// // ---------------------------------------------------------------------------
// function AcceptedClientsTable({ clients, hasSearch }) {
//   if (clients.length === 0) {
//     return (
//       <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
//         {hasSearch ? "No trainers match your search." : "No accepted trainers yet."}
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
//             <th className="py-2.5 px-4 font-semibold">Profile ID</th>
//             <th className="py-2.5 px-4 font-semibold">Clients</th>
//             <th className="py-2.5 px-4 font-semibold">Status</th>
//             <th className="py-2.5 px-4 font-semibold">Joined</th>
//           </tr>
//         </thead>
//         <tbody>
//           {clients.map((client) => (
//             <tr key={client.id} className="border-t border-[#F5F7FA]">
//               <td className="py-2.5 px-4 text-[#252525] font-semibold">
//                 {client.name}
//                 {client.is_self && (
//                   <span className="ml-1.5 inline-flex rounded-full bg-[#F3EEFE] text-[#6B45BC] text-[10px] font-semibold px-2 py-0.5">You</span>
//                 )}
//               </td>
//               <td className="py-2.5 px-4 text-[#535359]">{client.email}</td>
//               <td className="py-2.5 px-4 text-[#535359]">{client.phone}</td>
//               <td className="py-2.5 px-4 text-[#535359] font-mono">{client.acceptedProfileId || "-"}</td>
//               <td className="py-2.5 px-4 text-[#535359]">{client.clients_count ?? "-"}</td>
//               <td className="py-2.5 px-4">
//                 <span className="inline-flex rounded-full bg-[#E5F6EE] text-[#1F7A4A] text-[11px] font-semibold px-2.5 py-0.5">{client.status}</span>
//               </td>
//               <td className="py-2.5 px-4 text-[#A1A1A1]">{formatInviteDate(client.acceptedAt)}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // PendingInvitesTable
// // ---------------------------------------------------------------------------
// function PendingInvitesTable({ invites, onResend, onRevoke, auditLogs }) {
//   const [actionInProgress, setActionInProgress] = useState({});
//   const [expandedRows, setExpandedRows] = useState({});
//   const [revokeModalInvitation, setRevokeModalInvitation] = useState(null);
//   const [revokeReason, setRevokeReason] = useState("");
//   const [isSubmittingRevokeReason, setIsSubmittingRevokeReason] = useState(false);

//   const toggleRow = (id) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

//   const handleResend = async (inv) => {
//     const key = `resend-${inv.id}`;
//     setActionInProgress((prev) => ({ ...prev, [key]: true }));
//     try { await onResend(inv); } finally { setActionInProgress((prev) => ({ ...prev, [key]: false })); }
//   };

//   const handleRevoke = async (inv) => {
//     if (isInvitationExpired(inv)) {
//       const key = `revoke-${inv.id}`;
//       setActionInProgress((prev) => ({ ...prev, [key]: true }));
//       try { await onRevoke(inv, ""); } finally { setActionInProgress((prev) => ({ ...prev, [key]: false })); }
//       return;
//     }
//     setRevokeReason("");
//     setRevokeModalInvitation(inv);
//   };

//   const closeRevokeModal = () => { if (isSubmittingRevokeReason) return; setRevokeModalInvitation(null); setRevokeReason(""); };

//   const submitRevokeReason = async () => {
//     const trimmedReason = revokeReason.trim();
//     if (trimmedReason.length === 0) return toast.error("Please provide a reason for revoking.");
//     const inv = revokeModalInvitation;
//     const key = `revoke-${inv.id}`;
//     setIsSubmittingRevokeReason(true);
//     setActionInProgress((prev) => ({ ...prev, [key]: true }));
//     try {
//       await onRevoke(inv, trimmedReason);
//       setRevokeModalInvitation(null);
//       setRevokeReason("");
//     } finally {
//       setIsSubmittingRevokeReason(false);
//       setActionInProgress((prev) => ({ ...prev, [key]: false }));
//     }
//   };

//   return (
//     <>
//       <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
//         <table className="w-full text-[12px]">
//           <thead>
//             <tr className="bg-[#F5F7FA] text-[#535359] text-left">
//               <th className="py-2.5 px-4 font-semibold">Name</th>
//               <th className="py-2.5 px-4 font-semibold">Email</th>
//               <th className="py-2.5 px-4 font-semibold">Phone</th>
//               <th className="py-2.5 px-4 font-semibold">Plan</th>
//               <th className="py-2.5 px-4 font-semibold">Status</th>
//               <th className="py-2.5 px-4 font-semibold">Sent</th>
//               <th className="py-2.5 px-4 font-semibold">Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {invites.map((inv) => {
//               const resendKey = `resend-${inv.id}`;
//               const revokeKey = `revoke-${inv.id}`;
//               const isExpanded = expandedRows[inv.id];
//               const logs = auditLogs[inv.id] || [];
//               return (
//                 <Fragment key={inv.id}>
//                   <tr className="border-t border-[#F5F7FA]">
//                     <td className="py-2.5 px-4">
//                       <button type="button" onClick={() => toggleRow(inv.id)} className="flex items-center gap-1.5 text-[#252525] font-semibold hover:text-[#308BF9] cursor-pointer text-left">
//                         <span className={`text-[10px] transition-transform ${isExpanded ? "rotate-90" : ""}`}>&#9654;</span>
//                         {inv.name}
//                         {logs.length > 0 && <span className="text-[10px] text-[#A1A1A1] font-normal">({logs.length})</span>}
//                       </button>
//                     </td>
//                     <td className="py-2.5 px-4 text-[#535359]">{inv.email}</td>
//                     <td className="py-2.5 px-4 text-[#535359]">{inv.phone}</td>
//                     <td className="py-2.5 px-4">
//                       {inv.plan ? (
//                         <span className={`inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${PLANS.find((p) => p.id === inv.plan)?.badgeColor || "bg-[#F5F7FA] text-[#535359]"}`}>
//                           {PLANS.find((p) => p.id === inv.plan)?.badge || inv.plan}
//                         </span>
//                       ) : <span className="text-[#A1A1A1]">-</span>}
//                     </td>
//                     <td className="py-2.5 px-4">
//                       <span className={`inline-flex rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${
//                         String(inv.status).toLowerCase() === "expired" ? "bg-[#FFF4E0] text-[#A66B00]"
//                         : String(inv.status).toLowerCase() === "revoked" ? "bg-[#FCEAEB] text-[#B5363A]"
//                         : String(inv.status).toLowerCase() === "accepted" ? "bg-[#E5F6EE] text-[#1F7A4A]"
//                         : "bg-[#EEF4FE] text-[#308BF9]"
//                       }`}>{inv.status}</span>
//                     </td>
//                     <td className="py-2.5 px-4 text-[#A1A1A1]">{formatInviteDate(inv.sentAt)}</td>
//                     <td className="py-2.5 px-4">
//                       <div className="flex items-center gap-2">
//                         {inv.can_resend && (
//                           <button type="button" onClick={() => handleResend(inv)} disabled={actionInProgress[resendKey]} className="rounded-full bg-[#EEF4FE] text-[#308BF9] text-[11px] font-semibold px-2.5 py-0.5 hover:bg-[#d9e8fd] disabled:opacity-60 cursor-pointer">
//                             {actionInProgress[resendKey] ? "Sending..." : "Resend"}
//                           </button>
//                         )}
//                         {inv.can_revoke && (
//                           <button type="button" onClick={() => handleRevoke(inv)} disabled={actionInProgress[revokeKey]} className="rounded-full bg-[#FCEAEB] text-[#B5363A] text-[11px] font-semibold px-2.5 py-0.5 hover:bg-[#f8d4d5] disabled:opacity-60 cursor-pointer">
//                             {actionInProgress[revokeKey] ? "Revoking..." : "Revoke"}
//                           </button>
//                         )}
//                         {!inv.can_resend && !inv.can_revoke && <span className="text-[#A1A1A1] text-[11px]">&mdash;</span>}
//                       </div>
//                     </td>
//                   </tr>
//                   {isExpanded && (
//                     <tr className="bg-[#FAFBFC]">
//                       <td colSpan={7} className="px-4 py-3">
//                         <div className="ml-4 border-l-2 border-[#E1E6ED] pl-4">
//                           <p className="text-[11px] font-semibold text-[#535359] mb-2">Audit log</p>
//                           {logs.length === 0 ? (
//                             <p className="text-[11px] text-[#A1A1A1]">No activity recorded yet.</p>
//                           ) : (
//                             <div className="flex flex-col gap-1.5">
//                               {logs.map((log, idx) => (
//                                 <div key={idx} className="flex items-center gap-2 text-[11px]">
//                                   <span className={`inline-flex rounded-full font-semibold px-2 py-0.5 ${AUDIT_ACTION_STYLES[log.action] || "bg-[#F5F7FA] text-[#535359]"}`}>{log.action}</span>
//                                   <span className="text-[#535359]">by <span className="font-semibold">{log.actor}</span></span>
//                                   {log.detail && <span className="text-[#535359] italic">{log.detail}</span>}
//                                   <span className="text-[#A1A1A1]">{formatAuditTimestamp(log.timestamp)}</span>
//                                 </div>
//                               ))}
//                             </div>
//                           )}
//                         </div>
//                       </td>
//                     </tr>
//                   )}
//                 </Fragment>
//               );
//             })}
//             {invites.length === 0 && (
//               <tr><td colSpan={7} className="py-8 px-4 text-center text-[#A1A1A1] text-[12px]">No pending invites found</td></tr>
//             )}
//           </tbody>
//         </table>
//       </div>

//       {revokeModalInvitation && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={closeRevokeModal}>
//           <div className="w-full max-w-[420px] rounded-[12px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
//             <h3 className="text-[#252525] text-[15px] font-bold">Revoke invite</h3>
//             <p className="text-[#535359] text-[12px] mt-1">
//               Tell {revokeModalInvitation.first_name || revokeModalInvitation.email || "this user"} why their invite is being revoked.
//             </p>
//             <label className="block mt-4 text-[#535359] text-[12px] font-semibold">Reason <span className="text-red-500">*</span></label>
//             <textarea value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} placeholder="e.g. Wrong email" rows={3} disabled={isSubmittingRevokeReason} className="mt-1 w-full rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5 text-[13px] text-[#252525] focus:outline-none focus:border-[#308BF9] resize-none" />
//             <div className="mt-4 flex items-center justify-end gap-2">
//               <button type="button" onClick={closeRevokeModal} disabled={isSubmittingRevokeReason} className="rounded-[10px] bg-[#F5F7FA] text-[#535359] text-[12px] font-semibold px-4 py-2 disabled:opacity-60 cursor-pointer">Cancel</button>
//               <button type="button" onClick={submitRevokeReason} disabled={isSubmittingRevokeReason} className="rounded-[10px] bg-[#B5363A] text-white text-[12px] font-semibold px-4 py-2 disabled:opacity-60 cursor-pointer">
//                 {isSubmittingRevokeReason ? "Revoking..." : "Submit"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// // ---------------------------------------------------------------------------
// // Page
// // ---------------------------------------------------------------------------
// export default function TrainerAdminInvitesPage() {
//   const [user, setUser] = useState(null);
//   const [checkingSession, setCheckingSession] = useState(true);

//   const [acceptedClients, setAcceptedClients] = useState([]);
//   const [pendingInvites, setPendingInvites] = useState([]);
//   const [expiredInvites, setExpiredInvites] = useState([]);
//   const [revokedInvites, setRevokedInvites] = useState([]);
//   const [totals, setTotals] = useState({ accepted_count: 0, pending_count: 0, expired_count: 0, revoked_count: 0 });

//   const [auditLogs, setAuditLogs] = useState({});
//   const [loadingInvites, setLoadingInvites] = useState(false);
//   const [inviteListError, setInviteListError] = useState("");

//   // Pagination: the summary endpoint pages all four lists with one shared
//   // `page` (limit 10) and returns per-list `*_total` / `*_has_more` flags in
//   // `pagination`. Previous/Next replaces the lists with the requested page.
//   const PAGE_LIMIT = 10;
//   const [page, setPage] = useState(1);
//   const [paginationMeta, setPaginationMeta] = useState(null);

//   // Per-list server-side search (accepted_search / pending_search /
//   // expired_search / revoked_search on the summary endpoint). Terms shorter
//   // than MIN_SEARCH_LENGTH are treated as empty so the full list is shown.
//   const MIN_SEARCH_LENGTH = 3;
//   const [searchTerms, setSearchTerms] = useState({ accepted: "", pending: "", expired: "", revoked: "" });

//   const updateSearchTerm = (key, value) => {
//     setSearchTerms((prev) => ({ ...prev, [key]: value }));
//   };

//   const toEffectiveSearch = (term) => {
//     const trimmed = term.trim();
//     return trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : "";
//   };

//   const effectiveSearch = {
//     accepted: toEffectiveSearch(searchTerms.accepted),
//     pending: toEffectiveSearch(searchTerms.pending),
//     expired: toEffectiveSearch(searchTerms.expired),
//     revoked: toEffectiveSearch(searchTerms.revoked),
//   };

//   const addAuditEntry = (inviteId, action, detail = null) => {
//     const actor = user?.email || user?.user_id || "Unknown";
//     setAuditLogs((prev) => ({
//       ...prev,
//       [inviteId]: [...(prev[inviteId] || []), { action, actor, timestamp: new Date().toISOString(), detail }],
//     }));
//   };

//   const loadInvites = async (page = 1) => {
//     setLoadingInvites(true);
//     setInviteListError("");

//     try {
//       // Super admins read their trainer summary from the super-admin endpoint;
//       // trainer admins use the trainer-admin endpoint. Both return the same shape.
//       const role = String(getLoggedInUserFromCookie()?.role || "").toLowerCase();
//       const fetchSummary =
//         role === "super_admin"
//           ? fetchSuperAdminTrainerSummaryService
//           : fetchTrainerAdminTrainerSummaryService;

//       const res = await fetchSummary({
//         page,
//         limit: PAGE_LIMIT,
//         acceptedSearch: effectiveSearch.accepted,
//         pendingSearch: effectiveSearch.pending,
//         expiredSearch: effectiveSearch.expired,
//         revokedSearch: effectiveSearch.revoked,
//       });

//       setPage(page);
//       setPaginationMeta(res?.pagination || null);

//       const acceptedTrainerList = Array.isArray(res?.accepted_trainers)
//         ? res.accepted_trainers
//         : [];

//       const pendingInviteList = Array.isArray(res?.pending_invites)
//         ? res.pending_invites
//         : [];

//       const expiredInviteList = Array.isArray(res?.expired_invites)
//         ? res.expired_invites
//         : [];

//       const revokedInviteList = Array.isArray(res?.revoked_invites)
//         ? res.revoked_invites
//         : [];

//       setAcceptedClients(acceptedTrainerList.map(normalizeInvite));
//       setPendingInvites(pendingInviteList.map(normalizeInvite));
//       setExpiredInvites(expiredInviteList.map(normalizeInvite));
//       setRevokedInvites(revokedInviteList.map(normalizeInvite));

//       if (res?.summary) {
//         setTotals({
//           accepted_count: res.summary.accepted_count || 0,
//           pending_count: res.summary.pending_count || 0,
//           expired_count: res.summary.expired_count || 0,
//           revoked_count: res.summary.revoked_count || 0,
//         });
//       }
  
//     } catch (err) {
//       const message =
//         err?.message || "Could not fetch trainer summary.";
  
//       setInviteListError(message);
  
//       toast.error(message);
//     } finally {
//       setLoadingInvites(false);
//     }
//   };

//   // Per-list view of the shared pagination block returned by the API,
//   // shaped for the Pagination component. The super-admin endpoint returns
//   // per-list totals in `pagination` (accepted_total, ...); the trainer-admin
//   // endpoint omits them, so fall back to the `summary` counts.
//   const listPagination = (key) => ({
//     total: paginationMeta?.[`${key}_total`] ?? totals?.[`${key}_count`] ?? 0,
//     limit: paginationMeta?.limit ?? PAGE_LIMIT,
//     offset: paginationMeta?.offset ?? (page - 1) * PAGE_LIMIT,
//     has_more: !!paginationMeta?.[`${key}_has_more`],
//   });

//   useEffect(() => {
//     const loggedInUser = getLoggedInUserFromCookie();
//     setUser(loggedInUser);
//     setCheckingSession(false);
//   }, []);

//   // Debounced: re-fetch from page 1 whenever an effective search term
//   // (>= MIN_SEARCH_LENGTH chars) changes. Typing 1-2 characters does not
//   // trigger a request. Also covers the initial load on mount.
//   const effectiveSearchKey = [
//     effectiveSearch.accepted,
//     effectiveSearch.pending,
//     effectiveSearch.expired,
//     effectiveSearch.revoked,
//   ].join("|");

//   useEffect(() => {
//     const timeoutId = setTimeout(() => {
//       loadInvites(1);
//     }, 400);
//     return () => clearTimeout(timeoutId);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [effectiveSearchKey]);

//   if (checkingSession) return <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div>;
//   if (!user) return <div className="text-[#A1A1A1] text-[13px]">Session expired. Please log in again.</div>;

//   const handleInviteSent = async (invite) => {
//     const normalizedInvite = normalizeInvite(invite);
//     setPendingInvites((prev) => [normalizedInvite, ...prev.filter((item) => item.id !== normalizedInvite.id)]);
//     const planLabel = PLANS.find((p) => p.id === normalizedInvite.plan)?.label || normalizedInvite.plan;
//     addAuditEntry(normalizedInvite.id, "invited", `to ${normalizedInvite.email} — ${planLabel}`);
//     await loadInvites();
//   };

//   const handleResendInvite = async (inv) => {
//     try {
//       // Super admins resend through their own endpoint
//       // (super-admin-resend-trainers.php); trainer admins use the shared one.
//       const role = String(getLoggedInUserFromCookie()?.role || "").toLowerCase();
//       const resend =
//         role === "super_admin"
//           ? superAdminResendTrainerInviteService
//           : resendUserInviteService;

//       await resend({ inviteId: inv.id });
//       addAuditEntry(inv.id, "resent", `to ${inv.email}`);
//       toast.success(`Invite resent to ${inv.name || inv.email}`);
//       await loadInvites();
//     } catch (error) {
//       toast.error(error?.data?.message || error?.message || "Could not resend invite.");
//     }
//   };

//   const handleRevokeInvite = async (inv, reason = "") => {
//     try {
//       // Super admins revoke through their own endpoint
//       // (super-admin-revoke-trainers.php); trainer admins use the shared one.
//       const role = String(getLoggedInUserFromCookie()?.role || "").toLowerCase();
//       const revoke =
//         role === "super_admin"
//           ? superAdminRevokeTrainerInviteService
//           : revokeTrainerClientInviteService;

//       await revoke({ inviteId: inv.id, reason });
//       addAuditEntry(inv.id, "revoked", reason ? `reason: ${reason}` : null);
//       setPendingInvites((prev) => prev.filter((item) => item.id !== inv.id));
//       toast.success(`Invite to ${inv.name || inv.email} revoked.`);
//     } catch (error) {
//       toast.error(error?.message || "Could not revoke invite.");
//     }
//   };

//   return (
//     <div className="flex flex-col gap-6">
//       <div>
//         <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
//           Invites Trainer
//         </h1>
//         <p className="text-[#535359] text-[13px] mt-1">
//           Send client invites and track their status.
//         </p>
//       </div>

//       <InviteForm onSent={handleInviteSent} />

//       {inviteListError && (
//         <div className="rounded-[10px] border border-[#FCEAEB] bg-[#FFF7F7] text-[#B5363A] text-[12px] p-3">{inviteListError}</div>
//       )}

//       {/* Totals strip */}
//       <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
//         {[
//           { label: "Accepted", value: totals.accepted_count, color: "text-[#1F7A4A]" },
//           { label: "Pending", value: totals.pending_count, color: "text-[#308BF9]" },
//           { label: "Expired", value: totals.expired_count, color: "text-[#A66B00]" },
//           { label: "Revoked", value: totals.revoked_count, color: "text-[#B5363A]" },
//         ].map((tile) => (
//           <div key={tile.label} className="rounded-[10px] border border-[#E1E6ED] bg-white px-3 py-2.5">
//             <p className="text-[11px] text-[#535359] font-semibold">{tile.label}</p>
//             <p className={`text-[16px] font-bold ${tile.color}`}>{tile.value ?? 0}</p>
//           </div>
//         ))}
//       </div>

//       {/* Accepted trainers */}
//       <div>
//         <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
//           <h3 className="text-[#252525] text-[14px] font-bold">
//             Accepted trainers <span className="ml-2 text-[#A1A1A1] text-[12px] font-normal">({totals.accepted_count})</span>
//           </h3>
//           <SectionSearch value={searchTerms.accepted} onChange={(v) => updateSearchTerm("accepted", v)} placeholder="Search name, email, code" />
//         </div>
//         {loadingInvites ? <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div> : (
//           <>
//             <AcceptedClientsTable clients={acceptedClients} hasSearch={!!effectiveSearch.accepted} />
//             {listPagination("accepted").total > 0 && (
//               <Pagination meta={listPagination("accepted")} page={page} onPageChange={loadInvites} disabled={loadingInvites} />
//             )}
//           </>
//         )}
//       </div>

//       {/* Pending invites */}
//       <div>
//         <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
//           <h3 className="text-[#252525] text-[14px] font-bold">
//             Pending invites <span className="ml-2 text-[#A1A1A1] text-[12px] font-normal">({totals.pending_count})</span>
//           </h3>
//           <SectionSearch value={searchTerms.pending} onChange={(v) => updateSearchTerm("pending", v)} placeholder="Search name, email, code" />
//         </div>
//         {loadingInvites ? <div className="text-[#A1A1A1] text-[13px]">Loading&hellip;</div> : (
//           <>
//             <PendingInvitesTable invites={pendingInvites} onResend={handleResendInvite} onRevoke={handleRevokeInvite} auditLogs={auditLogs} />
//             {listPagination("pending").total > 0 && (
//               <Pagination meta={listPagination("pending")} page={page} onPageChange={loadInvites} disabled={loadingInvites} />
//             )}
//           </>
//         )}
//       </div>

//       {/* Expired invites — stays visible while a search is active so the
//           user can clear or refine a search that returned no rows */}
//       {(expiredInvites.length > 0 || searchTerms.expired) && (
//         <div>
//           <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
//             <h3 className="text-[#252525] text-[14px] font-bold">
//               Expired invites <span className="ml-2 text-[#A1A1A1] text-[12px] font-normal">({totals.expired_count})</span>
//             </h3>
//             <SectionSearch value={searchTerms.expired} onChange={(v) => updateSearchTerm("expired", v)} placeholder="Search name, email, code" />
//           </div>
//           <PendingInvitesTable invites={expiredInvites} onResend={handleResendInvite} onRevoke={handleRevokeInvite} auditLogs={auditLogs} />
//           {listPagination("expired").total > 0 && (
//             <Pagination meta={listPagination("expired")} page={page} onPageChange={loadInvites} disabled={loadingInvites} />
//           )}
//         </div>
//       )}

//       {/* Revoked invites */}
//       {(revokedInvites.length > 0 || searchTerms.revoked) && (
//         <div>
//           <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
//             <h3 className="text-[#252525] text-[14px] font-bold">
//               Revoked invites <span className="ml-2 text-[#A1A1A1] text-[12px] font-normal">({totals.revoked_count})</span>
//             </h3>
//             <SectionSearch value={searchTerms.revoked} onChange={(v) => updateSearchTerm("revoked", v)} placeholder="Search name, email, code" />
//           </div>
//           <PendingInvitesTable invites={revokedInvites} onResend={handleResendInvite} onRevoke={handleRevokeInvite} auditLogs={auditLogs} />
//           {listPagination("revoked").total > 0 && (
//             <Pagination meta={listPagination("revoked")} page={page} onPageChange={loadInvites} disabled={loadingInvites} />
//           )}
//         </div>
//       )}
//     </div>
//   );
// }
