"use client";

// Tab navigation for the Trainer Direction page. Phase 1 ships two tabs
// (the originals from the engineer's design); five more come in later phases.

const TABS = [
  { id: "glance",   label: "At a Glance" },
  { id: "why",      label: "Why Today's Plan" },
  { id: "brief",    label: "Coach's Brief" },
  { id: "session",  label: "Today's Session" },
  { id: "playbook", label: "Coach's Playbook" },
  { id: "food",     label: "Food Direction" },
  { id: "watch",    label: "Watch & Plan" },
];

export default function TrainerDirectionTabs({ activeTab, onChange }) {
  return (
    <nav
      aria-label="Trainer direction sections"
      className="flex gap-2 overflow-x-auto pb-1"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              "flex-shrink-0 whitespace-nowrap rounded-[10px] px-5 py-2.5 text-[13px] font-semibold transition-colors",
              isActive
                ? "bg-[#308BF9] text-white"
                : "bg-white text-[#535359] hover:bg-[#EEF4FE] border border-[#E1E6ED]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
