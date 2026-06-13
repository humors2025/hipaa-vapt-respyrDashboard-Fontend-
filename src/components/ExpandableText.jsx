"use client";

import { useState } from "react";

// One paragraph with its own independent "View all / View less" toggle.
// Collapsed -> 3-line preview (line-clamp-3); expanded -> full text.
// Renders nothing when `body` is empty.
export default function ExpandableText({ label, body, className = "" }) {
  const [expanded, setExpanded] = useState(false);

  if (!body) return null;

  return (
    <div className="flex flex-col gap-1 items-start w-full">
      <p
        className={`text-[#738298] text-[12px] font-normal leading-[130%] ${
          expanded ? "" : "line-clamp-3"
        } ${className}`}
      >
        {label && <b className="font-semibold">{label}</b>}
        {body}
      </p>

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="text-[#308BF9] text-[12px] font-semibold leading-normal tracking-[-0.24px] underline cursor-pointer"
      >
        {expanded ? "View less" : "View all"}
      </button>
    </div>
  );
}
