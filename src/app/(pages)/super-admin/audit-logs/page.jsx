"use client";

export default function AuditLogsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[#252525] text-[20px] font-bold leading-tight tracking-[-0.4px]">
          Audit log
        </h1>
        <p className="text-[#535359] text-[13px] mt-1">
          Append-only log of every privileged action — suspensions,
          reinstatements, role changes, reattributions.
        </p>
      </div>

      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-8 text-center">
        <p className="text-[#A1A1A1] text-[13px]">
          Audit log requires a dedicated backend API.
        </p>
        <p className="text-[#A1A1A1] text-[11px] mt-2">
          Needed: GET audit log entries (actor, target, action, reason,
          timestamp), POST audit entry on privileged actions. Currently no
          backend persistence for audit events.
        </p>
      </div>
    </div>
  );
}
