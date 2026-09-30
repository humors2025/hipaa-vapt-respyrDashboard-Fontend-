'use client'

import { useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { toast } from 'sonner'
import { logClientEvent } from '@/lib/clientLogger'

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
  'I have read and agree to these terms.',
  'I understand I earn nothing on a member who is refunded.',
  'I will not claim Rysflo diagnoses or treats anything.',
]

// The clauses, as data. Sentence case: these are read by a gym owner on a phone,
// not filed by a legal department.
const TERMS = [
  {
    title: 'What you earn',
    body: [
      'Rysflo pays you 20% of what each member you refer pays, for every month they stay subscribed. There is no cap and no end date.',
      'Commission is on the amount actually charged. Members cut their bill by taking daily readings, so a month with the full credit earns you 20% of the lower figure. If the rate ever changes we tell you first, and the change applies only to payments after that.',
    ],
  },
  {
    title: 'Which members are yours',
    body: [
      'A member is yours if they sign up through your QR code or enter your code. This is recorded when they pay and does not move afterwards.',
    ],
  },
  {
    title: 'If a member cancels',
    body: [
      'A member can cancel within 30 days and we refund them in full. You earn nothing on a member who is refunded, and if we have already paid you, we deduct it from your next payout.',
      'After 30 days, cancelling simply stops future commission. What you have already earned stays yours. The same applies to any later refund or chargeback.',
    ],
  },
  {
    title: 'How you are paid',
    body: [
      'Monthly, through Stripe. You complete Stripe\u2019s onboarding once \u2014 bank details and W-9, with your 1099 issued at year end. Rysflo never sees your bank details.',
      'We pay out once your balance reaches $25; below that it rolls over. Commission builds up whether or not you have finished Stripe onboarding, but cannot be paid until you have.',
    ],
  },
  {
    title: 'Gyms and trainers',
    body: [
      'If you are a gym, the 20% is paid to you. You set what share of it each trainer gets, anything from 0% to 100%, for members who sign up under that trainer\u2019s code, and you can change it any time from your dashboard. A change applies to commission not yet paid out. Members who use the gym\u2019s own code are 100% the gym\u2019s.',
      'Rysflo pays trainers directly out of the gym\u2019s 20%, at the share the gym has set. We do not set that share or take part in any separate arrangement between a gym and its trainers.',
    ],
  },
  {
    title: 'What you may not claim',
    body: [
      'Rysflo is a wellness product, not a medical device. Do not say it diagnoses, treats, cures or prevents anything, do not promise health outcomes, and do not present a reading as a diagnosis.',
    ],
  },
  {
    title: 'Your codes and printed material',
    body: [
      'Codes and QR posters we issue stay ours. Do not alter them, sell them, bid on the Rysflo brand in paid ads, or refer yourself.',
    ],
  },
  {
    title: 'Member information',
    body: [
      'You see the name, email and payment history of members who signed up through you. You do not see their readings. Keep it confidential, use it only to support those members, and do not sell or share it.',
    ],
  },
  {
    title: 'Ending this',
    body: [
      'Either of us can end it at any time, with notice. Commission already earned is still paid, subject to the $25 minimum and to any refunds. Nothing new accrues after that.',
    ],
  },
  {
    title: 'The relationship',
    body: [
      'This is a referral arrangement, not employment, agency or partnership. You handle your own taxes on what you earn, and you cannot commit Rysflo to anything.',
    ],
  },
  {
    title: 'Acceptance',
    body: [
      'Ticking the boxes below is your signature. A copy of what you accepted is saved with your account.',
    ],
  },
]

export default function Agreement({ onAccept, onDecline, userEmail }) {
  const [checks, setChecks] = useState(Array(3).fill(false))
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [generating, setGenerating] = useState(false)

  // The T&C section (header + full terms) is snapshotted into a PDF on accept.
  const termsRef = useRef(null)

  const allChecked = checks.every(Boolean) && scrolledToBottom

  function handleItemCheck(idx) {
    setChecks(checks.map((v, i) => (i === idx ? !v : v)))
  }

  function handleScroll(e) {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) setScrolledToBottom(true)
  }

  // Build a multi-page A4 PDF of the agreement directly from the rendered text.
  // We deliberately avoid html2canvas here: it can't parse the modern CSS color
  // functions (oklch/oklab/color-mix) that Tailwind v4 emits and was failing to
  // produce a PDF at all. Reading the text and laying it out with jsPDF's native
  // text API is dependency-free and reliable.
  function buildAgreementPdf(el) {
    const scrollEl = el.querySelector('.tc-scroll')
    const body = ((scrollEl || el).innerText || (scrollEl || el).textContent || '').trim()

    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    const maxWidth = pageWidth - margin * 2
    const lineHeight = 5
    let y = margin

    const writeLines = (lines) => {
      for (const line of lines) {
        if (y + lineHeight > pageHeight - margin) {
          pdf.addPage()
          y = margin
        }
        pdf.text(line, margin, y)
        y += lineHeight
      }
    }

    // Title
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    writeLines(pdf.splitTextToSize('RYSFLO REFERRAL PARTNER TERMS', maxWidth))
    y += lineHeight

    // Body
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    for (const para of body.split('\n')) {
      const text = para.trim()
      if (!text) {
        y += lineHeight / 2
        continue
      }
      writeLines(pdf.splitTextToSize(text, maxWidth))
    }

    const blob = pdf.output('blob')
    return new File([blob], 'rysflo-referral-partner-terms.pdf', { type: 'application/pdf' })
  }

  function handleDecline() {
    // keepalive:true in the logger keeps this request alive across the
    // immediate router.push("/") that onDecline triggers.
    logClientEvent('agreement_decline_click', { user_email: userEmail || undefined }, 'Terms and condition page')
    onDecline?.()
  }

  async function handleAccept() {
    if (!allChecked || generating) return
    logClientEvent('agreement_agree_continue_click', { all_checked: allChecked, user_email: userEmail || undefined }, 'Terms and condition page')
    setGenerating(true)
    try {
      const pdf = termsRef.current ? await buildAgreementPdf(termsRef.current) : null
      if (!pdf) throw new Error('Agreement PDF could not be generated')
      onAccept?.(pdf)
    } catch (err) {
      console.error('Failed to generate agreement PDF', err)
      // The signed PDF is required to complete signup, so don't advance to the
      // password step without it — keep the user here and let them retry.
      toast.error('Could not prepare the agreement document. Please try again.')
    } finally {
      setGenerating(false)
    }
  }


  return (
    <div
      className="w-full max-w-[680px] max-h-[94vh] flex flex-col bg-white rounded-[15px] border border-[#e1e6ed] shadow-modal animate-modal-in overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tcTitle"
    >
      {/* Header. Sentence case and one line of purpose — the site never shouts. */}
      <div className="flex items-start gap-3.5 px-5 sm:px-7 pt-6 pb-5 border-b border-[#e1e6ed]">
        <RespyrIcon />
        <div className="min-w-0">
          <h1 id="tcTitle" className="text-[21px] font-medium text-[#252525] tracking-[-0.055em] leading-[1.2] m-0">
            Referral partner terms
          </h1>
          <p className="text-[13.5px] text-[#738298] leading-[1.5] mt-1 mb-0">
            Step 1 of 2. Read these, then set your password.
          </p>
        </div>
      </div>

      {/* The deal, stated once and large. A partner opens this screen to find
          out what they are paid; everything below is the detail on it. */}
      <div className="px-5 sm:px-7 pt-6 pb-5 bg-[#f5f7fa] border-b border-[#e1e6ed]">
        <p className="text-[52px] leading-[0.95] font-semibold text-[#252525] tracking-[-0.055em] m-0">
          20%
        </p>
        <p className="text-[15.5px] leading-[1.5] text-[#535359] mt-2 mb-0 max-w-[46ch]">
          of what every member you refer pays, every month they stay subscribed
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-4 text-[13px] text-[#738298]">
          <span>No cap, no end date</span>
          <span>Paid monthly through Stripe</span>
        </div>
      </div>

      <div ref={termsRef} className="tc-scroll flex-1 min-h-[200px] overflow-y-auto" onScroll={handleScroll}>
        {/* Terms. Numbered because these are clauses people will cite back to us,
            not because a numbered list looks orderly. */}
        <div className="px-5 sm:px-7 py-7">
          <p className="text-[13px] text-[#738298] leading-[1.6] m-0 mb-7">
            Effective from the date you accept and join the Rysflo referral programme.
          </p>

          <div className="flex flex-col gap-[26px]">
            {TERMS.map((t, i) => (
              <section key={i} className="grid grid-cols-[26px_1fr] gap-x-3">
                <span className="text-[13px] font-medium text-[#308bf9] leading-[1.55] tabular-nums pt-px">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-medium text-[#252525] tracking-[-0.03em] leading-[1.35] m-0 mb-2">
                    {t.title}
                  </h2>
                  {t.body.map((para, j) => (
                    <p key={j} className="text-[14.5px] text-[#535359] leading-[1.68] m-0 mb-2 last:mb-0 max-w-[62ch]">
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

        </div>
      </div>

      {/* Consent. Three separate acknowledgements, each ticked on its own —
          a "select all" would defeat the point of asking three times. */}
      <div className="border-t border-[#e1e6ed] bg-white">
        <div className="px-5 sm:px-7 pt-5 pb-4 flex flex-col gap-3">
          {CHECKBOX_ITEMS.map((text, idx) => (
            <label key={idx} className="group flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={checks[idx]}
                onChange={() => handleItemCheck(idx)}
              />
              <span
                className={`flex-shrink-0 w-[19px] h-[19px] rounded-[6px] border flex items-center justify-center mt-[2px] transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#308bf9] ${
                  checks[idx] ? 'bg-[#3faf58] border-[#3faf58]' : 'bg-white border-[#cdd5df] group-hover:border-[#738298]'
                }`}
              >
                <span style={{ opacity: checks[idx] ? 1 : 0 }} className="transition-opacity duration-150">
                  <CheckIcon size={11} />
                </span>
              </span>
              <span className="text-[13.5px] text-[#535359] leading-[1.55] tracking-[-0.01em]">
                {text}
              </span>
            </label>
          ))}
        </div>

        <div className="px-5 sm:px-7 pb-6 pt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={handleDecline}
            className="px-6 py-3 rounded-[33px] border border-[#e1e6ed] bg-white text-[15px] font-semibold text-[#252525] tracking-[-0.02em] transition-colors duration-150 hover:border-[#cdd5df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#308bf9]"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={!allChecked || generating}
            className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-[33px] bg-[#252525] text-white text-[15px] font-semibold tracking-[-0.02em] shadow-[0_4px_12px_rgba(37,37,37,0.25)] transition-[background,transform,box-shadow,opacity] duration-150 hover:not-disabled:bg-[#3a3a3a] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#308bf9]"
          >
            {generating ? 'Preparing your copy…' : 'Agree and continue'}
          </button>
        </div>

        {/* Says which condition is unmet, rather than leaving a dead button. */}
        <p
          aria-live="polite"
          className="px-5 sm:px-7 pb-5 -mt-2 text-[12.5px] text-[#738298] leading-[1.5] m-0"
          style={{ visibility: allChecked ? 'hidden' : 'visible' }}
        >
          {!scrolledToBottom ? 'Scroll to the end of the terms to continue.' : 'Tick all three to continue.'}
        </p>
      </div>
    </div>
  )
}
