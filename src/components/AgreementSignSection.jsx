'use client'

// "Sign to accept" block shared by both agreement steps: the signer's name and
// email (from the invite, read-only) and their name written as a signature in
// a handwriting font. Nothing is drawn by hand; renderSignaturePng() turns the
// same name into the image that goes in the signed PDF.

import { Dancing_Script } from 'next/font/google'

const signatureFont = Dancing_Script({ subsets: ['latin'], weight: '600', display: 'swap' })

const INK = '#1b2a4a'

// PNG data URL of the name in the signature font, rendered at a size that
// stays crisp in the PDF. Waits for the font so the image never falls back.
export async function renderSignaturePng(name) {
  const text = (name || '').trim()
  if (!text) return null
  const font = `600 96px ${signatureFont.style.fontFamily}`
  try {
    await document.fonts.load(font, text)
  } catch {
    // Draw with the fallback font rather than block signup.
  }
  const measure = document.createElement('canvas').getContext('2d')
  measure.font = font
  const m = measure.measureText(text)
  const pad = 24
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(m.width + pad * 2)
  canvas.height = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + pad * 2)
  const ctx = canvas.getContext('2d')
  ctx.font = font
  ctx.fillStyle = INK
  ctx.fillText(text, pad, pad + m.actualBoundingBoxAscent)
  return canvas.toDataURL('image/png')
}

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

export default function AgreementSignSection({ userName, userEmail }) {
  return (
    <div className="px-7 pt-[18px] pb-[18px] flex flex-col gap-3">
      <div className="text-[10px] font-semibold text-[#738298] tracking-[0.03em] uppercase">Sign to accept</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ReadOnlyField id="agreementSignName" label="Full name" value={userName} />
        <ReadOnlyField id="agreementSignEmail" label="Email" value={userEmail} />
      </div>
      <div className="relative h-[104px] rounded-[10px] bg-white border border-[#e1e6ed] px-[18px]">
        <div
          aria-label="Signature"
          className={`${signatureFont.className} absolute left-[18px] right-[18px] bottom-[34px] text-[34px] leading-none text-[#1b2a4a] truncate`}
        >
          {userName}
        </div>
        <div className="absolute left-[18px] right-[18px] bottom-[28px] border-b border-[#e1e6ed]" />
        <div className="absolute left-[18px] bottom-[9px] text-[10px] text-[#738298]">Signature</div>
      </div>
      <p className="text-[10.5px] text-[#738298] leading-[1.5] m-0">
        Your name, email and signature are added to a PDF copy of these terms and saved with your account.
      </p>
    </div>
  )
}
