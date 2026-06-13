"use client";

export default function ApproveConfirmationPopup({
  onClose,
  onConfirm,
  isLoading = false,
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[360px] rounded-[16px] bg-white p-5 shadow-lg">
        <h2 className="text-[#252525] text-[16px] font-semibold leading-normal tracking-[-0.32px]">
          Are you sure?
        </h2>

        <p className="mt-2 text-[#738298] text-[13px] font-normal leading-[150%] tracking-[-0.26px]">
          Do you want to approve this diet plan?
        </p>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-[6px] border border-[#E1E6ED] text-[#535359] text-[12px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded-[6px] bg-[#308BF9] text-white text-[12px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Approving...
              </>
            ) : (
              "Yes, Approve"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}