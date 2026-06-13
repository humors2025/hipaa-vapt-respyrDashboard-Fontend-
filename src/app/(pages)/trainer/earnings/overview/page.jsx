// TODO: replace placeholder values once backend exposes commission data.
// Suggested endpoint shape: GET /dietitian/api/web/get_trainer_earnings.php
// returning { this_month, lifetime, pending_payout, next_payout_date,
//   active_clients: { coach, lease, owned }, recent_activity: [...] }

const PLACEHOLDER = "—";

const KPIS = [
  {
    label: "This-month commission",
    value: PLACEHOLDER,
    hint: "Updated daily as clients are billed",
    accent: true,
  },
  {
    label: "Lifetime earnings",
    value: PLACEHOLDER,
    hint: "Total commission paid since you joined",
  },
  {
    label: "Pending payout",
    value: PLACEHOLDER,
    hint: "Next payout: —",
  },
  {
    label: "Active referred clients",
    value: PLACEHOLDER,
    hint: "Across all tiers",
  },
];

const TIER_MIX = [
  { label: "Coach's Device", value: PLACEHOLDER, color: "#308BF9" },
  { label: "Lease to Own", value: PLACEHOLDER, color: "#2EAF6A" },
  { label: "Owned", value: PLACEHOLDER, color: "#F2A93B" },
];

function KpiCard({ label, value, hint, accent }) {
  if (accent) {
    return (
      <div className="bg-[#308BF9] rounded-[10px] p-5 text-white flex flex-col gap-1">
        <div className="text-[12px] opacity-80">{label}</div>
        <div className="text-[28px] font-bold leading-none mt-1">{value}</div>
        <div className="text-[11px] opacity-80 mt-1">{hint}</div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-[10px] p-5 border border-[#E1E6ED] flex flex-col gap-1">
      <div className="text-[#535359] text-[12px]">{label}</div>
      <div className="text-[#252525] text-[28px] font-bold leading-none mt-1">
        {value}
      </div>
      <div className="text-[#A1A1A1] text-[11px] mt-1">{hint}</div>
    </div>
  );
}

function TierMixCard() {
  return (
    <div className="bg-[#F5F7FA] rounded-[10px] p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-[#252525] text-[14px] font-bold">Client mix</h3>
        <span className="text-[#A1A1A1] text-[11px]">By subscription tier</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {TIER_MIX.map((t) => (
          <div
            key={t.label}
            className="bg-white rounded-[10px] p-4 border border-[#E1E6ED] flex flex-col gap-1"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: t.color }}
                aria-hidden
              />
              <span className="text-[#535359] text-[12px]">{t.label}</span>
            </div>
            <div className="text-[#252525] text-[22px] font-bold">{t.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentActivity() {
  // When backend ships, replace with the fetched activity list.
  const items = [];

  if (items.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#E1E6ED] p-6 text-[#A1A1A1] text-[12px] text-center">
        No activity yet. As clients subscribe, click your invite links, and
        payouts process, you'll see them listed here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[10px] border border-[#E1E6ED]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[#F5F7FA] text-[#535359] text-left">
            <th className="py-2.5 px-4 font-semibold">Event</th>
            <th className="py-2.5 px-4 font-semibold">Client</th>
            <th className="py-2.5 px-4 font-semibold">Amount</th>
            <th className="py-2.5 px-4 font-semibold">When</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-[#F5F7FA]">
              <td className="py-2.5 px-4 text-[#252525] font-semibold">{it.event}</td>
              <td className="py-2.5 px-4 text-[#535359]">{it.client}</td>
              <td className="py-2.5 px-4 text-[#535359]">{it.amount}</td>
              <td className="py-2.5 px-4 text-[#A1A1A1]">{it.when}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[#252525] text-[16px] font-bold">Overview</h2>
        <p className="text-[#535359] text-[13px] mt-1">
          A snapshot of your commissions, referred clients, and recent activity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <TierMixCard />

      <div>
        <h3 className="text-[#252525] text-[14px] font-bold mb-3">Recent activity</h3>
        <RecentActivity />
      </div>
    </div>
  );
}
