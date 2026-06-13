'use client'

import { useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

// html2canvas (1.4.x) can't parse modern `oklch()` colors that Tailwind v4 /
// shadcn themes emit. Before capturing, walk the cloned DOM and rewrite any
// oklch color value to an RGB equivalent (a canvas 2D context normalizes any
// valid CSS color the browser understands into rgb/hex form).
const OKLCH_PROPS = [
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'textDecorationColor',
  'columnRuleColor',
  'fill',
  'stroke',
]

function makeColorConverter() {
  const ctx = document.createElement('canvas').getContext('2d')
  return (value) => {
    try {
      ctx.fillStyle = '#000000'
      ctx.fillStyle = value
      return ctx.fillStyle
    } catch {
      return null
    }
  }
}

function scrubOklch(doc) {
  try {
    const win = doc.defaultView || window
    const convert = makeColorConverter()
    const els = [doc.documentElement, doc.body, ...doc.querySelectorAll('*')]
    for (const el of els) {
      if (!el || el.nodeType !== 1) continue
      const cs = win.getComputedStyle(el)
      for (const prop of OKLCH_PROPS) {
        const v = cs[prop]
        if (v && v.indexOf('oklch') !== -1) {
          const rgb = convert(v)
          if (rgb) el.style[prop] = rgb
        }
      }
    }
  } catch (err) {
    console.warn('oklch scrub failed', err)
  }
}

const RespyrIcon = () => (
  <div className="w-[38px] h-[38px] bg-[#308bf9] rounded-[15px] flex items-center justify-center flex-shrink-0">
    <svg width="22" height="22" fill="none" viewBox="0 0 14.72 14.72">
      <path
        d="M6.13672 2.76172C5.59351 2.40874 5.01877 2.51886 4.59766 2.79004C4.21236 3.03824 3.91039 3.43568 3.69141 3.83301C3.25848 4.6186 2.96806 5.74033 3.16309 6.66113C3.2652 7.14297 3.52121 7.6456 4.04199 7.94434C4.20931 8.04026 4.38824 8.10647 4.57617 8.14551C4.2926 8.9109 3.98883 9.62245 3.74707 10.1494C3.57702 10.5203 3.74022 10.9589 4.11133 11.1289C4.48246 11.2988 4.92166 11.1355 5.0918 10.7646C5.4134 10.0636 5.84766 9.03289 6.21191 7.95605C6.95897 7.68793 7.85928 7.17522 8.94238 6.36523C8.73222 6.97038 8.55456 7.58863 8.4375 8.17969C8.27486 9.00094 8.21088 9.86107 8.41699 10.585C8.52328 10.9582 8.70845 11.3181 9.00781 11.6084C9.31095 11.9022 9.69408 12.0882 10.1348 12.1689C10.5364 12.2425 10.9215 11.9765 10.9951 11.5752C11.0686 11.174 10.8029 10.7894 10.4014 10.7158C10.2148 10.6817 10.1073 10.6158 10.0371 10.5479C9.96312 10.4761 9.89179 10.363 9.83984 10.1807C9.72957 9.79343 9.74074 9.20903 9.8877 8.4668C10.1777 7.00224 10.9211 5.27161 11.5293 4.12012C11.6972 3.80217 11.6121 3.40988 11.3271 3.19043C11.0421 2.971 10.6398 2.98798 10.375 3.23145C8.83131 4.6506 7.64164 5.54149 6.74512 6.06641C6.85678 5.53988 6.92654 5.02245 6.92285 4.55859C6.91804 3.95541 6.78389 3.18242 6.13672 2.76172ZM5.37988 4.09375C5.41447 4.18971 5.44252 4.34389 5.44434 4.57031C5.44797 5.02628 5.34518 5.63236 5.16309 6.32227C5.12914 6.45088 5.0929 6.58125 5.05469 6.71191C4.89386 6.71612 4.81117 6.68249 4.77734 6.66309C4.73032 6.63606 4.65518 6.56615 4.61035 6.35449C4.51157 5.88765 4.66386 5.13282 4.9873 4.5459C5.12917 4.28855 5.26805 4.13104 5.36523 4.05566C5.37005 4.06622 5.37464 4.07922 5.37988 4.09375Z"
        fill="white"
      />
    </svg>
  </div>
)

const CheckIcon = ({ size = 10 }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24">
    <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CHECKBOX_ITEMS = [
  <>I have read and agree to the <strong>NDA &amp; Device Evaluation Program Terms and Conditions</strong> above.</>,
  <>I agree that I am <strong>financially responsible</strong> for the device(s) assigned to me for the duration of this testing period.</>,
  <>I agree to <strong>ship the Respyr device(s)</strong> back upon request once the trial / feedback period has ended, after receiving a free return shipping label from Atlas Human Systems LLC.</>,
  <>I agree to <strong>fill out and submit the feedback forms</strong> provided at least twice monthly.</>,
  <>I agree to <strong>join at least one monthly video conference call</strong> (1–2 hours) with the Respyr Team to give feedback and discuss with other trainers.</>,
]

export default function Agreement({ onAccept, onDecline }) {
  const [checks, setChecks] = useState(Array(5).fill(false))
  const [selectAll, setSelectAll] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [generating, setGenerating] = useState(false)

  // The T&C section (header + full terms) is snapshotted into a PDF on accept.
  const termsRef = useRef(null)

  const allChecked = checks.every(Boolean)

  function handleSelectAll() {
    const next = !selectAll
    setSelectAll(next)
    setChecks(Array(5).fill(next))
  }

  function handleItemCheck(idx) {
    const next = checks.map((v, i) => (i === idx ? !v : v))
    setChecks(next)
    setSelectAll(next.every(Boolean))
  }

  function handleScroll(e) {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) setScrolledToBottom(true)
  }

  // Render the terms section to a multi-page A4 PDF and return it as a File.
  async function buildAgreementPdf(el) {
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      // The terms live inside a fixed-height scroll box; expand it (and hide the
      // "scroll to read" hint) in the clone so the whole document is captured.
      onclone: (doc) => {
        scrubOklch(doc)
        doc.querySelectorAll('.tc-scroll').forEach((n) => {
          n.style.maxHeight = 'none'
          n.style.overflow = 'visible'
        })
        doc.querySelectorAll('[data-pdf-hide]').forEach((n) => {
          n.style.display = 'none'
        })
      },
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let heightLeft = imgHeight
    let position = 0
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    const blob = pdf.output('blob')
    return new File([blob], 'device-evaluation-agreement.pdf', { type: 'application/pdf' })
  }

  async function handleAccept() {
    if (!allChecked || generating) return
    setGenerating(true)
    try {
      const pdf = termsRef.current ? await buildAgreementPdf(termsRef.current) : null
      onAccept?.(pdf)
    } catch (err) {
      console.error('Failed to generate agreement PDF', err)
      // Don't block the user if PDF capture fails — continue without it.
      onAccept?.(null)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div
      className="w-full max-w-[680px] max-h-[94vh] overflow-y-auto bg-white rounded-[15px] border border-[#e1e6ed] shadow-modal animate-modal-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tcTitle"
    >
      <div className="px-7 pt-5 pb-[18px] border-b border-[#e1e6ed] flex items-center gap-3">
        <RespyrIcon />
        <div className="flex-1">
          <div id="tcTitle" className="text-[15px] font-semibold text-[#252525] tracking-[-0.02em] leading-tight">
            Device Evaluation Agreement
          </div>
          <div className="text-[10px] text-[#738298] tracking-[-0.02em] mt-px">
            Please read and accept before continuing
          </div>
        </div>
      </div>

      <div className="flex items-center px-7 py-[14px] pb-4 bg-[#f5f7fa] border-b border-[#e1e6ed]">
        <div className="flex items-center gap-[7px] flex-shrink-0">
          <div className="w-[22px] h-[22px] rounded-full bg-[#3faf58] flex items-center justify-center">
            <CheckIcon size={9} />
          </div>
          <span className="text-[11px] font-medium text-[#252525] tracking-[-0.02em] whitespace-nowrap">
            Review Agreement
          </span>
        </div>

        <div className="flex-1 h-[2px] bg-[#e1e6ed] rounded-full mx-2.5 overflow-hidden">
          <div className="h-full w-0 bg-[#3faf58] rounded-full" />
        </div>

        <div className="flex items-center gap-[7px] flex-shrink-0">
          <div className="w-[22px] h-[22px] rounded-full bg-[#e1e6ed] flex items-center justify-center text-[10px] font-semibold text-[#a1a1a1]">
            2
          </div>
          <span className="text-[11px] font-medium text-[#a1a1a1] tracking-[-0.02em] whitespace-nowrap">
            Set Password
          </span>
        </div>
      </div>

      <div ref={termsRef} className="mx-7 mt-5 border border-[#e1e6ed] rounded-[10px] overflow-hidden relative">
        <div className="flex items-center gap-2 px-[18px] py-3 bg-[#f5f7fa] border-b border-[#e1e6ed] text-[10px] font-semibold text-[#535359] tracking-[0.04em]">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          DEVICE EVALUATION PROGRAM TERMS AND CONDITIONS
        </div>

        <div className="tc-scroll max-h-[260px] overflow-y-auto px-[22px] py-[18px] scroll-smooth" onScroll={handleScroll}>
          <div className="text-[11px] text-[#535359] leading-[1.7] tracking-[-0.02em]">
            <p className="text-[10px] text-[#738298] mb-3 px-2.5 py-2 bg-[#f5f7fa] rounded-[6px] border-l-[3px] border-[#308bf9]">
              Effective Date: The date on which Physical Trainer (&ldquo;PT&rdquo;) enrolls in the Device Evaluation Program and accepts these Terms and Conditions.
            </p>

            <p className="text-[11px] font-medium text-[#252525] mb-3.5 px-3 py-2.5 bg-[#fff8ed] border border-[#e48326]/20 rounded-[8px]">
              PLEASE READ THESE TERMS CAREFULLY. By selecting the checkbox indicating acceptance of these Terms and Conditions and enrolling in the Device Evaluation Program, PT agrees to be bound by these Terms and Conditions. If PT does not agree to these Terms and Conditions, PT may not enroll in the Device Evaluation Program or receive any Devices. These Terms and Conditions constitute a legally binding agreement between Atlas Sales Partners (&ldquo;Atlas Sales Partners&rdquo;) and the enrolling Physical Trainer (&ldquo;PT&rdquo;).
            </p>

            <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">1. PURPOSE</h3>
            <p className="mb-2">
              Atlas Sales Partners agrees to provide PT with one or more wellness devices (&ldquo;Devices&rdquo;) solely for a temporary evaluation and testing period. PT may use the Devices personally and/or permit use by PT&apos;s customers solely for evaluation purposes consistent with this Agreement. This Agreement does not transfer ownership of any Device to PT or any customer.
            </p>

            <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">2. TEST PERIOD</h3>
            <p className="mb-2">
              The evaluation period shall begin on the Effective Date and continue for sixty (60) calendar days (&ldquo;Test Period&rdquo;) unless terminated earlier pursuant to this Agreement. Any extension of the Test Period must be agreed to in writing by both Parties. No verbal extension shall be valid.
            </p>

            <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">3. DEVICE CUSTODY, CARE, AND RETURN</h3>
            <p className="mb-2">
              <strong>3.1 Custody and Responsibility</strong><br />
              PT acknowledges that all Devices remain the sole property of Atlas Sales Partners at all times. PT shall exercise reasonable care in the custody, handling, storage, and use of the Devices. PT agrees to keep Devices in clean, safe conditions; use them per instructions; prevent misuse; restrict use to PT and PT&apos;s customers under PT&apos;s supervision.
            </p>
            <p className="mb-2">
              <strong>3.2 Condition of Devices</strong><br />
              PT shall return all Devices in substantially the same condition as received, excluding reasonable wear and tear. PT shall promptly notify Atlas Sales Partners of any loss, malfunction, damage, or suspected defect.
            </p>
            <p className="mb-2">
              <strong>3.3 No Alterations</strong><br />
              PT shall not alter, disassemble, reverse engineer, repair, relabel, or modify any Device without Atlas Sales Partners&apos;s prior written consent.
            </p>

            <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">4. APPROVED CLAIMS AND REPRESENTATIONS</h3>
            <p className="mb-2">
              PT agrees that any statements regarding the Devices shall strictly conform to the claims, indications, warnings, limitations, and instructions provided by Atlas Sales Partners. PT shall not make unauthorized medical, therapeutic, diagnostic, or performance claims, nor provide guarantees regarding health outcomes.
            </p>

            <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">5. CUSTOMER FEEDBACK AND PUBLIC COMMUNICATIONS</h3>
            <p className="mb-2">
              <strong>5.1 No Public Reviews or Statements</strong><br />
              During the Test Period and thereafter unless authorized in writing, PT shall not post, publish, or permit publication of reviews, testimonials, performance claims, ratings, photos, videos, social media posts, public comments, or promotional statements regarding the Devices.
            </p>
            <p className="mb-2">
              <strong>5.2 Private Feedback to Atlas Sales Partners</strong><br />
              All feedback, observations, complaints, and evaluation results shall be communicated privately to Atlas Sales Partners via email, written report, phone call, or verbal discussion.
            </p>

            <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">6. CUSTOMER HEALTH INFORMATION AND PRIVACY</h3>
            <p className="mb-2">
              PT acknowledges that customer health-related information may be visible through the Device portal. PT agrees to access customer information only as necessary; keep it confidential; use reasonable care to protect customer privacy. The Device portal is designed to be HIPAA-compliant.
            </p>

            <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">7. DEFECTIVE DEVICES AND RETURN SHIPPING</h3>
            <p className="mb-2">
              PT shall promptly notify Atlas Sales Partners of any Device believed to be defective, damaged, or unsafe. Returned Devices shall be securely packaged. Atlas Sales Partners shall provide a prepaid return shipping label and bear reasonable return shipping costs.
            </p>

            <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">8. DISCLAIMER</h3>
            <p className="mb-2">
              PT acknowledges that the Devices are being provided for evaluation purposes only. Except as expressly stated in writing, Atlas Sales Partners makes no warranties, express or implied, including warranties of merchantability or fitness for a particular purpose.
            </p>

            <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">9. LIMITATION OF LIABILITY</h3>
            <p className="mb-2">
              To the maximum extent permitted by law, neither Party shall be liable to the other for any indirect, incidental, consequential, special, or punitive damages. Atlas Sales Partners&apos;s aggregate liability shall not exceed the value of the Devices provided.
            </p>

            <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">10. TERMINATION</h3>
            <p className="mb-2">
              Atlas Sales Partners may terminate this Agreement immediately upon written notice if PT breaches any material provision. Upon termination or expiration, PT shall promptly cease use of the Devices and return them per Section 7.
            </p>

            <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">11. GOVERNING LAW</h3>
            <p className="mb-2">
              This Agreement shall be governed by and construed in accordance with the laws of the State of Texas, without regard to conflict of law principles.
            </p>

            <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">12. ENTIRE AGREEMENT</h3>
            <p className="mb-2">
              This Agreement constitutes the entire agreement between the Parties and supersedes all prior discussions or understandings. Any amendment must be in writing and signed by both Parties.
            </p>

            <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">13. ELECTRONIC ACCEPTANCE</h3>
            <p>
              PT acknowledges that selecting the acceptance checkbox constitutes PT&apos;s electronic signature and acceptance of this Agreement. Electronic acceptance shall have the same force and effect as a handwritten signature.
            </p>
          </div>
        </div>

        <div
          data-pdf-hide
          className="absolute bottom-0 left-0 right-0 px-3.5 pb-2.5 pt-[18px] bg-gradient-to-b from-transparent via-white/95 to-white/95 flex items-center justify-center gap-[5px] text-[10px] text-[#738298] pointer-events-none transition-opacity duration-300"
          style={{ opacity: scrolledToBottom ? 0 : 1 }}
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Scroll to read all terms
        </div>
      </div>

      <div className="px-7 pt-5 pb-1 flex flex-col gap-[13px]">
        <div className="text-[10px] font-semibold text-[#738298] tracking-[0.03em] uppercase mb-1">
          Please confirm all of the following to continue:
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer select-none bg-[#e9f3ff] border-[1.5px] border-[#308bf9]/25 rounded-[8px] px-4 py-3">
          <input type="checkbox" className="sr-only" checked={selectAll} onChange={handleSelectAll} />
          <span className={`flex-shrink-0 w-[18px] h-[18px] rounded-[4px] border-[1.5px] flex items-center justify-center mt-px transition-all duration-150 ${selectAll ? 'bg-[#3faf58] border-[#3faf58]' : 'bg-white border-[#308bf9]/40'}`}>
            <span style={{ opacity: selectAll ? 1 : 0 }} className="transition-opacity duration-150">
              <CheckIcon size={10} />
            </span>
          </span>
          <span className="text-[12px] font-semibold text-[#308bf9] tracking-[-0.02em]">
            Select all
          </span>
        </label>

        <div className="h-px bg-[#e1e6ed]" />

        {CHECKBOX_ITEMS.map((text, idx) => (
          <label key={idx} className="flex items-start gap-2.5 cursor-pointer select-none">
            <input type="checkbox" className="sr-only" checked={checks[idx]} onChange={() => handleItemCheck(idx)} />
            <span className={`flex-shrink-0 w-[18px] h-[18px] rounded-[4px] border-[1.5px] flex items-center justify-center mt-px transition-all duration-150 ${checks[idx] ? 'bg-[#3faf58] border-[#3faf58]' : 'bg-white border-[#e1e6ed]'}`}>
              <span style={{ opacity: checks[idx] ? 1 : 0 }} className="transition-opacity duration-150">
                <CheckIcon size={10} />
              </span>
            </span>
            <span className="text-[11px] text-[#535359] tracking-[-0.02em] leading-[1.5]">
              {text}
            </span>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3 px-7 py-4 pb-[22px] sticky bottom-0 bg-white border-t border-[#e1e6ed] z-10">
        <button
          onClick={onDecline}
          className="h-11 px-[22px] bg-white text-[#e74c3c] border-[1.5px] border-[#e74c3c]/25 rounded-[15px] text-[12px] font-semibold tracking-[-0.02em] cursor-pointer whitespace-nowrap transition-all duration-150 hover:bg-[#fff5f5] hover:border-[#e74c3c]/50"
        >
          Decline
        </button>

        <button
          onClick={handleAccept}
          disabled={!allChecked || generating}
          className="flex-1 h-11 bg-[#252525] text-white rounded-[15px] text-[13px] font-semibold tracking-[-0.02em] cursor-pointer flex items-center justify-center gap-2 transition-all duration-150 shadow-btn hover:bg-[#3a3a3a] hover:-translate-y-px active:translate-y-0 disabled:opacity-55 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        >
          {generating ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Preparing…</span>
            </>
          ) : (
            <>
              <span>I Agree &amp; Continue</span>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}