/**
 * src/utils/inputValidation.js
 *
 * Common frontend input-validation helpers.
 *
 * IMPORTANT:
 * Frontend validation is only the first layer.
 * The backend must always perform the same validation because browser-side
 * validation can be bypassed.
 */

/*
|--------------------------------------------------------------------------
| Human Name Validation
|--------------------------------------------------------------------------
|
| Allowed:
|
| Ankur
| Mary Jane
| O'Brien
| Jean-Pierre
| José
| François
|
| Rejected:
|
| <script>alert(1)</script>
| <h1>HTML INJECTION</h1>
| {{7*7}}
| ${7*7}
|--------------------------------------------------------------------------
*/

export const HUMAN_NAME_RE =
  /^[\p{L}\p{M} .'’\-]{1,100}$/u;

/**
 * Normalize human names before validation/submission.
 */
export function normalizeHumanName(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Detailed human-name validator.
 */
export function validateHumanName(
  value,
  fieldName = "Name",
  {
    required = true,
    minLength = 1,
    maxLength = 100,
  } = {}
) {
  /*
  |--------------------------------------------------------------------------
  | Type validation
  |--------------------------------------------------------------------------
  */

  if (
    value !== null &&
    value !== undefined &&
    typeof value !== "string"
  ) {
    return {
      ok: false,
      value: "",
      message: `${fieldName} is invalid.`,
    };
  }

  const name =
    normalizeHumanName(value);

  /*
  |--------------------------------------------------------------------------
  | Required
  |--------------------------------------------------------------------------
  */

  if (!name) {
    if (!required) {
      return {
        ok: true,
        value: "",
        message: null,
      };
    }

    return {
      ok: false,
      value: "",
      message: `${fieldName} is required.`,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Length
  |--------------------------------------------------------------------------
  */

  if (name.length < minLength) {
    return {
      ok: false,
      value: "",
      message:
        `${fieldName} must be at least ${minLength} character` +
        `${minLength === 1 ? "" : "s"}.`,
    };
  }

  if (
    name.length > maxLength ||
    name.length > 100
  ) {
    return {
      ok: false,
      value: "",
      message: `${fieldName} is too long.`,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Character allowlist
  |--------------------------------------------------------------------------
  */

  if (!HUMAN_NAME_RE.test(name)) {
    return {
      ok: false,
      value: "",
      message:
        `${fieldName} contains invalid characters.`,
    };
  }

  return {
    ok: true,
    value: name,
    message: null,
  };
}

/**
 * Boolean version for form validation.
 */
export function isValidHumanName(value) {
  return validateHumanName(
    value,
    "Name"
  ).ok;
}

/*
|--------------------------------------------------------------------------
| Email Validation
|--------------------------------------------------------------------------
|
| This intentionally does NOT use:
|
| /^[^\s@]+@[^\s@]+\.[^\s@]+$/
|
| because that regex can allow values such as:
|
| <script>@example.com
|--------------------------------------------------------------------------
*/

export function validateEmailAddress(
  value,
  fieldName = "Email"
) {
  /*
  |--------------------------------------------------------------------------
  | Type
  |--------------------------------------------------------------------------
  */

  if (typeof value !== "string") {
    return {
      ok: false,
      value: "",
      message:
        `${fieldName} is required.`,
    };
  }

  const email =
    value
      .trim()
      .toLowerCase();

  /*
  |--------------------------------------------------------------------------
  | Required / max email length
  |--------------------------------------------------------------------------
  */

  if (!email) {
    return {
      ok: false,
      value: "",
      message:
        `${fieldName} is required.`,
    };
  }

  if (email.length > 254) {
    return {
      ok: false,
      value: "",
      message:
        `${fieldName} is too long.`,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Reject controls, spaces and markup/template characters
  |--------------------------------------------------------------------------
  */

  if (
    /[\x00-\x20\x7f<>"{}]/.test(
      email
    )
  ) {
    return {
      ok: false,
      value: "",
      message:
        `Enter a valid ${fieldName.toLowerCase()}.`,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Exactly one @
  |--------------------------------------------------------------------------
  */

  const parts =
    email.split("@");

  if (parts.length !== 2) {
    return {
      ok: false,
      value: "",
      message:
        `Enter a valid ${fieldName.toLowerCase()}.`,
    };
  }

  const [
    local,
    domain,
  ] = parts;

  /*
  |--------------------------------------------------------------------------
  | Local part
  |--------------------------------------------------------------------------
  */

  if (
    !local ||
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`|~-]+$/i.test(
      local
    )
  ) {
    return {
      ok: false,
      value: "",
      message:
        `Enter a valid ${fieldName.toLowerCase()}.`,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Domain
  |--------------------------------------------------------------------------
  */

  if (
    !domain ||
    domain.length > 253
  ) {
    return {
      ok: false,
      value: "",
      message:
        `Enter a valid ${fieldName.toLowerCase()}.`,
    };
  }

  const labels =
    domain.split(".");

  /*
  |--------------------------------------------------------------------------
  | Require a normal domain with TLD
  |--------------------------------------------------------------------------
  */

  if (labels.length < 2) {
    return {
      ok: false,
      value: "",
      message:
        `Enter a valid ${fieldName.toLowerCase()}.`,
    };
  }

  for (const label of labels) {
    if (
      label.length < 1 ||
      label.length > 63 ||
      !/^[a-z0-9-]+$/i.test(
        label
      ) ||
      label.startsWith("-") ||
      label.endsWith("-")
    ) {
      return {
        ok: false,
        value: "",
        message:
          `Enter a valid ${fieldName.toLowerCase()}.`,
      };
    }
  }

  return {
    ok: true,
    value: email,
    message: null,
  };
}

/**
 * Boolean email validator.
 */
export function isValidEmailAddress(value) {
  return validateEmailAddress(
    value,
    "Email"
  ).ok;
}

/**
 * Compatibility alias.
 */
export function isValidEmail(value) {
  return isValidEmailAddress(
    value
  );
}

/*
|--------------------------------------------------------------------------
| Phone Validation
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Validate BEFORE removing characters.
|
| Bad:
|
| phone.replace(/\D/g, "")
|
| on malicious input because:
|
| +91<script>alert(1)</script>9876543210
|
| could silently become digits.
|--------------------------------------------------------------------------
*/

export function validatePhoneNumber(
  value,
  fieldName = "Phone",
  {
    required = true,
    minDigits = 7,
    maxDigits = 15,
  } = {}
) {
  /*
  |--------------------------------------------------------------------------
  | Optional empty phone
  |--------------------------------------------------------------------------
  */

  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    if (!required) {
      return {
        ok: true,
        value: "",
        message: null,
      };
    }

    return {
      ok: false,
      value: "",
      message:
        `${fieldName} is required.`,
    };
  }

  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return {
      ok: false,
      value: "",
      message:
        `Enter a valid ${fieldName.toLowerCase()} number.`,
    };
  }

  const raw =
    String(value).trim();

  /*
  |--------------------------------------------------------------------------
  | Prevent unreasonable input
  |--------------------------------------------------------------------------
  */

  if (raw.length > 30) {
    return {
      ok: false,
      value: "",
      message:
        `Enter a valid ${fieldName.toLowerCase()} number.`,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Reject controls
  |--------------------------------------------------------------------------
  */

  if (
    /[\x00-\x1f\x7f]/.test(
      raw
    )
  ) {
    return {
      ok: false,
      value: "",
      message:
        `Enter a valid ${fieldName.toLowerCase()} number.`,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Character allowlist
  |--------------------------------------------------------------------------
  |
  | Allowed:
  |
  | +91 98765 43210
  | (987) 654-3210
  | 9876543210
  |--------------------------------------------------------------------------
  */

  if (
    !/^\+?[0-9\s().-]+$/.test(
      raw
    )
  ) {
    return {
      ok: false,
      value: "",
      message:
        `Enter a valid ${fieldName.toLowerCase()} number.`,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Normalize only AFTER successful validation
  |--------------------------------------------------------------------------
  */

  const digits =
    raw.replace(
      /\D/g,
      ""
    );

  if (
    digits.length < minDigits ||
    digits.length > maxDigits
  ) {
    return {
      ok: false,
      value: "",
      message:
        `Enter a valid ${fieldName.toLowerCase()} number.`,
    };
  }

  const normalized =
    raw.startsWith("+")
      ? `+${digits}`
      : digits;

  return {
    ok: true,
    value: normalized,
    message: null,
  };
}

/**
 * Boolean phone validator.
 */
export function isValidPhone(value) {
  return validatePhoneNumber(
    value,
    "Phone"
  ).ok;
}

/*
|--------------------------------------------------------------------------
| Dangerous Markup Detection
|--------------------------------------------------------------------------
|
| Optional helper for plain-text fields such as search/reason/notes.
|--------------------------------------------------------------------------
*/

export function containsDangerousMarkup(
  value
) {
  const text =
    String(value ?? "");

  if (!text) {
    return false;
  }

  return (
    /<[^>]*>/i.test(text) ||
    /javascript\s*:/i.test(text) ||
    /\{\{[\s\S]*\}\}/.test(text) ||
    /\$\{[\s\S]*\}/.test(text) ||
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(
      text
    )
  );
}