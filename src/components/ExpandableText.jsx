"use client";

// One paragraph of trainer/insight text.
// Renders nothing when `body` is empty.
export default function ExpandableText({ label, body, className = "" }) {
  if (!body) return null;

  return (
    <div className="flex flex-col gap-1 items-start w-full">
      <p
        className={`text-[#738298] text-[12px] font-normal leading-[130%] ${className}`}
      >
        {label && <b className="font-semibold">{label}</b>}
        {body}
      </p>
    </div>
  );
}
