"use client";

export default function DiscardConfirmationPopup({
  onClose,
  onConfirm,
  count = 0,
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[360px] rounded-[16px] bg-white p-5 shadow-lg">
        <h2 className="text-[#252525] text-[16px] font-semibold leading-normal tracking-[-0.32px]">
          Discard changes?
        </h2>

        <p className="mt-2 text-[#738298] text-[13px] font-normal leading-[150%] tracking-[-0.26px]">
          You have {count} unsaved change{count === 1 ? "" : "s"}. This action
          cannot be undone.
        </p>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[6px] border border-[#E1E6ED] text-[#535359] text-[12px] font-semibold cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-[6px] bg-[#E76F51] text-white text-[12px] font-semibold cursor-pointer"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
