'use client'

// "Sign to accept" block shared by both agreement steps: the signer's name and
// email (from the invite, read-only) and a signature pad.

import { forwardRef } from 'react'
import SignaturePad from '@/components/SignaturePad'

const ReadOnlyField = ({ id, label, value }) => (
  <div className="min-w-0">
    <label htmlFor={id} className="block text-[11px] font-medium text-[#535359] tracking-[-0.02em] mb-1.5">
      {label}
    </label>
    <input
      id={id}
      readOnly
      value={value || ''}
      className="w-full h-[42px] px-3.5 bg-[#f5f7fa] border border-[#e1e6ed] rounded-[8px] text-[12px] text-[#252525] tracking-[0.02em] outline-none truncate"
    />
  </div>
)

const AgreementSignSection = forwardRef(function AgreementSignSection({ userName, userEmail, onSignatureChange }, padRef) {
  return (
    <div className="px-7 pt-[18px] pb-[18px] flex flex-col gap-3">
      <div className="text-[10px] font-semibold text-[#738298] tracking-[0.03em] uppercase">Sign to accept</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ReadOnlyField id="agreementSignName" label="Full name" value={userName} />
        <ReadOnlyField id="agreementSignEmail" label="Email" value={userEmail} />
      </div>
      <SignaturePad ref={padRef} onChange={onSignatureChange} />
      <p className="text-[10.5px] text-[#738298] leading-[1.5] m-0">
        Your name, email and signature are added to a PDF copy of these terms and saved with your account.
      </p>
    </div>
  )
})

export default AgreementSignSection
