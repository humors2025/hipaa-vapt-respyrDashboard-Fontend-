'use client'

// Referral partner terms shown to facility_admin invitees at signup.
// Every other role still gets the Device Evaluation Agreement (agreement.jsx).
// On accept, the terms plus the signer's name, email, ticked boxes and drawn
// signature are built into a PDF (src/lib/signedAgreementPdf.js) for S3.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { logClientEvent } from '@/lib/clientLogger'
import { buildSignedAgreementPdf, loadAgreementLogo } from '@/lib/signedAgreementPdf'
import AgreementSignSection, { renderSignaturePng } from '@/components/AgreementSignSection'

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

const TITLE = 'Referral Partner Programme Terms'
const VERSION = 'Version 2 · October 2026'
const EFFECTIVE = 'Effective from the date you accept and join the Rysflo referral programme.'

const DEAL = {
  figure: '20%',
  text: 'of what every member you refer pays, every month they stay subscribed',
  facts: ['No cap, no end date', 'Paid monthly through Stripe'],
}

// Each confirmation as plain text with its emphasised part, so the screen can
// bold it and the PDF can list it verbatim.
const CHECKBOX_ITEMS = [
  { pre: 'I have read and agree to the ', bold: 'Referral Partner Terms', post: ' above.' },
  { pre: 'I understand I ', bold: 'earn nothing on a member who is refunded', post: '.' },
  { pre: 'I will ', bold: 'not claim Rysflo diagnoses or treats', post: ' anything.' },
]
const itemText = (c) => `${c.pre}${c.bold}${c.post}`

const TERMS = [
  {
    title: 'WHAT YOU EARN',
    body: [
      'Rysflo pays you 20% of what each member you refer pays, for every month they stay subscribed. There is no cap and no end date.',
      'Commission is on the amount actually charged. Members cut their bill by taking daily readings, so a month with the full credit earns you 20% of the lower figure. If the rate ever changes we tell you first, and the change applies only to payments after that.',
    ],
  },
  {
    title: 'WHICH MEMBERS ARE YOURS',
    body: [
      'A member is yours if they sign up through your QR code or enter your code. This is recorded when they pay and does not move afterwards.',
    ],
  },
  {
    title: 'IF A MEMBER CANCELS',
    body: [
      'A member can cancel within 30 days and we refund them in full. You earn nothing on a member who is refunded, and if we have already paid you, we deduct it from your next payout.',
      'After 30 days, cancelling simply stops future commission. What you have already earned stays yours. The same applies to any later refund or chargeback.',
    ],
  },
  {
    title: 'HOW YOU ARE PAID',
    body: [
      'Monthly, through Stripe. You complete Stripe’s onboarding once — bank details and W-9, with your 1099 issued at year end. Rysflo never sees your bank details.',
      'We pay out once your balance reaches $25; below that it rolls over. Commission builds up whether or not you have finished Stripe onboarding, but cannot be paid until you have.',
    ],
  },
  {
    title: 'GYMS AND TRAINERS',
    body: [
      'If you are a gym, the 20% is paid to you. You set what share of it each trainer gets, anything from 0% to 100%, for members who sign up under that trainer’s code, and you can change it any time from your dashboard. A change applies to commission not yet paid out. Members who use the gym’s own code are 100% the gym’s.',
      'Rysflo pays trainers directly out of the gym’s 20%, at the share the gym has set. We do not set that share or take part in any separate arrangement between a gym and its trainers.',
    ],
  },
  {
    title: 'WHAT YOU MAY NOT CLAIM',
    body: [
      'Rysflo is a wellness product, not a medical device. Do not say it diagnoses, treats, cures or prevents anything, do not promise health outcomes, and do not present a reading as a diagnosis.',
    ],
  },
  {
    title: 'YOUR CODES AND PRINTED MATERIAL',
    body: [
      'Codes and QR posters we issue stay ours. Do not alter them, sell them, bid on the Rysflo brand in paid ads, or refer yourself.',
    ],
  },
  {
    title: 'MEMBER INFORMATION',
    body: [
      'You see the name, email and payment history of members who signed up through you. You do not see their readings. Keep it confidential, use it only to support those members, and do not sell or share it.',
    ],
  },
  {
    title: 'ENDING THIS',
    body: [
      'Either of us can end it at any time, with notice. Commission already earned is still paid, subject to the $25 minimum and to any refunds. Nothing new accrues after that.',
    ],
  },
  {
    title: 'THE RELATIONSHIP',
    body: [
      'This is a referral arrangement, not employment, agency or partnership. You handle your own taxes on what you earn, and you cannot commit Rysflo to anything.',
    ],
  },
  {
    title: 'ACCEPTANCE',
    body: [
      'Ticking the boxes below is your signature. A copy of what you accepted is saved with your account.',
    ],
  },
]

const PDF_BLOCKS = [
  { type: 'effective', text: EFFECTIVE },
  ...TERMS.flatMap((t, i) => [
    { type: 'heading', text: `${i + 1}. ${t.title}` },
    ...t.body.map((text) => ({ type: 'paragraph', text })),
  ]),
]

export default function FacilityAdminAgreement({ onAccept, onDecline, userName, userEmail, role = 'facility_admin' }) {
  const [checks, setChecks] = useState(Array(CHECKBOX_ITEMS.length).fill(false))
  const [selectAll, setSelectAll] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Warm the logo so building the PDF on accept doesn't wait for it.
  useEffect(() => {
    loadAgreementLogo()
  }, [])

  const allChecked = checks.every(Boolean)

  function handleSelectAll() {
    const next = !selectAll
    setSelectAll(next)
    setChecks(Array(CHECKBOX_ITEMS.length).fill(next))
    logClientEvent('agreement_select_all_click', { checked: next, user_email: userEmail || undefined }, 'Terms and condition page')
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
      const [signaturePng, logoPng] = await Promise.all([renderSignaturePng(userName), loadAgreementLogo()])
      const pdf = buildSignedAgreementPdf({
        fileName: 'rysflo-referral-partner-terms.pdf',
        title: TITLE,
        version: VERSION,
        deal: DEAL,
        blocks: PDF_BLOCKS,
        confirmations: CHECKBOX_ITEMS.map(itemText),
        signer: { name: userName, email: userEmail, role },
        signaturePng,
        logoPng,
      })
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
      className="w-full max-w-[680px] max-h-[94vh] overflow-y-auto bg-white rounded-[15px] border border-[#e1e6ed] shadow-modal animate-modal-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tcTitle"
    >
      <div className="px-7 pt-5 pb-[18px] border-b border-[#e1e6ed] flex items-center gap-3">
        <RespyrIcon />
        <div className="flex-1">
          <div id="tcTitle" className="text-[15px] font-semibold text-[#252525] tracking-[-0.02em] leading-tight">
            Referral Partner Terms
          </div>
          <div className="text-[10px] text-[#738298] tracking-[-0.02em] mt-px">
            Step 1 of 2. Read these, then set your password.
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

      {/* The deal, fixed above the scrolling terms. */}
      <div className="px-7 pt-6 pb-5 bg-[#f5f7fa] border-b border-[#e1e6ed]">
        <p className="text-[46px] sm:text-[52px] leading-[0.95] font-semibold text-[#252525] tracking-[-0.055em] m-0">
          {DEAL.figure}
        </p>
        <p className="text-[15.5px] leading-[1.5] text-[#535359] tracking-[-0.02em] mt-2 mb-0 max-w-[46ch]">
          {DEAL.text}
        </p>
        <div className="flex flex-col gap-1.5 mt-4 text-[13px] leading-[1.4] text-[#738298] tracking-[-0.02em]">
          {DEAL.facts.map((fact) => (
            <span key={fact} className="flex items-center gap-2">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-[#3faf58]">
                <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {fact}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-7 mt-5 border border-[#e1e6ed] rounded-[10px] overflow-hidden relative">
        <div className="flex items-center gap-2 px-[18px] py-3 bg-[#f5f7fa] border-b border-[#e1e6ed] text-[10px] font-semibold text-[#535359] tracking-[0.04em]">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          REFERRAL PARTNER PROGRAMME TERMS
        </div>

        <div className="tc-scroll max-h-[260px] overflow-y-auto px-[22px] py-[18px] scroll-smooth" onScroll={handleScroll}>
          <div className="text-[11px] text-[#535359] leading-[1.7] tracking-[-0.02em]">
            <p className="text-[10px] text-[#738298] mb-3 px-2.5 py-2 bg-[#f5f7fa] rounded-[6px] border-l-[3px] border-[#308bf9]">
              {EFFECTIVE}
            </p>

            {TERMS.map((t, i) => (
              <section key={t.title}>
                <h3 className="text-[11px] font-semibold text-[#252525] mt-3.5 mb-[5px]">
                  {i + 1}. {t.title}
                </h3>
                {t.body.map((para, j) => (
                  <p key={j} className="mb-2 last:mb-0">
                    {para}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>

        <div
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

        {CHECKBOX_ITEMS.map((c, idx) => (
          <label key={idx} className="flex items-start gap-2.5 cursor-pointer select-none">
            <input type="checkbox" className="sr-only" checked={checks[idx]} onChange={() => handleItemCheck(idx)} />
            <span className={`flex-shrink-0 w-[18px] h-[18px] rounded-[4px] border-[1.5px] flex items-center justify-center mt-px transition-all duration-150 ${checks[idx] ? 'bg-[#3faf58] border-[#3faf58]' : 'bg-white border-[#e1e6ed]'}`}>
              <span style={{ opacity: checks[idx] ? 1 : 0 }} className="transition-opacity duration-150">
                <CheckIcon size={10} />
              </span>
            </span>
            <span className="text-[11px] text-[#535359] tracking-[-0.02em] leading-[1.5]">
              {c.pre}<strong>{c.bold}</strong>{c.post}
            </span>
          </label>
        ))}
      </div>

      <AgreementSignSection userName={userName} userEmail={userEmail} />

      <div className="flex items-center gap-3 px-7 py-4 pb-[22px] sticky bottom-0 bg-white border-t border-[#e1e6ed] z-10">
        <button
          onClick={handleDecline}
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
