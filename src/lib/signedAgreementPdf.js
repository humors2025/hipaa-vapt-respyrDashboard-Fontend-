// Builds the signed agreement PDF that signup uploads to S3: Rysflo logo on
// every page, the terms, then an acceptance record with the signer's name,
// email, role, the boxes they ticked and their drawn signature.
//
// Laid out with jsPDF's text API. html2canvas is deliberately not used: it
// can't parse the oklch/oklab colours Tailwind v4 emits.

import { jsPDF } from 'jspdf'

const LOGO_SRC = '/icons/rysflo-logo.png'

export const ROLE_LABELS = {
  facility_admin: 'Facility admin',
  admin: 'Admin',
  trainer: 'Trainer',
}

const C = {
  dark: [37, 37, 37],
  body: [83, 83, 89],
  muted: [115, 130, 152],
  blue: [48, 139, 249],
  green: [63, 175, 88],
  border: [225, 230, 237],
  surface: [245, 247, 250],
  noticeBg: [255, 248, 237],
  noticeBorder: [248, 218, 190],
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatUtc(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`
}

let logoPromise = null

// The logo as a data URL, fetched once. Resolves to null if it can't be loaded
// so a missing image never blocks signup.
export function loadAgreementLogo() {
  if (!logoPromise) {
    logoPromise = fetch(LOGO_SRC)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`logo ${res.status}`))))
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
      )
      .catch((err) => {
        console.error('Agreement logo could not be loaded', err)
        logoPromise = null
        return null
      })
  }
  return logoPromise
}

// Reads a rendered terms element into PDF blocks. h3 → heading; p → paragraph,
// with a leading <strong> before a <br> kept as a bold lead line. Paragraphs
// can opt into a style with data-pdf="effective" or data-pdf="notice".
export function blocksFromTermsElement(el) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const blocks = []
  for (const node of el.querySelectorAll('h3, p')) {
    if (node.tagName === 'H3') {
      blocks.push({ type: 'heading', text: clean(node.textContent) })
      continue
    }
    const style = node.dataset.pdf
    if (style === 'effective' || style === 'notice') {
      blocks.push({ type: style, text: clean(node.textContent) })
      continue
    }
    const first = node.firstElementChild
    if (first && first.tagName === 'STRONG' && first.nextElementSibling?.tagName === 'BR') {
      const lead = clean(first.textContent)
      const rest = clean(node.textContent.replace(first.textContent, ''))
      blocks.push({ type: 'paragraph', lead, text: rest })
    } else {
      blocks.push({ type: 'paragraph', text: clean(node.textContent) })
    }
  }
  return blocks
}

// Filled green box with a white tick (Helvetica has no ✓ glyph).
function drawTick(pdf, x, y, s) {
  pdf.setFillColor(...C.green)
  pdf.roundedRect(x, y, s, s, 0.8, 0.8, 'F')
  pdf.setDrawColor(255, 255, 255)
  pdf.setLineWidth(0.5)
  pdf.setLineCap('round')
  pdf.setLineJoin('round')
  pdf.lines([[s * 0.2, s * 0.2], [s * 0.38, -s * 0.42]], x + s * 0.22, y + s * 0.52, [1, 1], 'S', false)
}

/**
 * @param {object}   opts
 * @param {string}   opts.fileName       File name for the returned File.
 * @param {string}   opts.title          Document title (first page + header).
 * @param {string}   [opts.version]      Small line under the header title.
 * @param {object}   [opts.deal]         { figure, text, facts[] } summary band.
 * @param {Array}    opts.blocks         { type: heading|paragraph|effective|notice, text, lead? }
 * @param {string[]} opts.confirmations  Checkbox texts the signer ticked.
 * @param {object}   opts.signer         { name, email, role }
 * @param {string}   opts.signaturePng   Data URL of the drawn signature.
 * @param {string}   [opts.logoPng]      Data URL of the Rysflo logo.
 * @param {Date}     [opts.acceptedAt]
 * @returns {File}
 */
export function buildSignedAgreementPdf({
  fileName,
  title,
  version,
  deal,
  blocks,
  confirmations,
  signer,
  signaturePng,
  logoPng,
  acceptedAt = new Date(),
}) {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const M = 18
  const maxW = W - M * 2
  const top = 30
  const bottom = H - 20
  const LH = 4.6
  let y = top

  const accepted = formatUtc(acceptedAt)
  const roleLabel = ROLE_LABELS[signer.role] || signer.role || ''

  pdf.setProperties({
    title: `${title} – ${signer.name}`,
    subject: `Accepted by ${signer.name} <${signer.email}> on ${accepted}`,
    author: signer.name,
    keywords: [signer.email, signer.role, version].filter(Boolean).join(', '),
    creator: 'Rysflo dashboard',
  })

  const font = (style, size, color) => {
    pdf.setFont('helvetica', style)
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
  }
  const newPage = () => {
    pdf.addPage()
    y = top
  }
  const ensure = (h) => {
    if (y + h > bottom) newPage()
  }
  const writeLines = (lines, x, lh = LH) => {
    for (const line of lines) {
      ensure(lh)
      pdf.text(line, x, y + lh * 0.75)
      y += lh
    }
  }
  // Paragraph in a tinted box (effective date, notice). Kept on one page.
  const boxed = (text, { bg, edge, rule, style, color }) => {
    font(style, 9, color)
    const lines = pdf.splitTextToSize(text, maxW - 9)
    const h = lines.length * 4.4 + 4.5
    ensure(h)
    pdf.setFillColor(...bg)
    if (edge) {
      pdf.setDrawColor(...edge)
      pdf.setLineWidth(0.25)
      pdf.roundedRect(M, y, maxW, h, 1.5, 1.5, 'FD')
    } else {
      pdf.rect(M, y, maxW, h, 'F')
    }
    if (rule) {
      pdf.setFillColor(...rule)
      pdf.rect(M, y, 1, h, 'F')
    }
    pdf.text(lines, M + 5, y + 5.4)
    y += h + 5
  }

  // ── Title ──────────────────────────────────────────────────────────────────
  font('bold', 17, C.dark)
  writeLines(pdf.splitTextToSize(title, maxW), M, 7.5)
  y += 1.5
  font('normal', 9, C.muted)
  pdf.text(`Accepted by ${signer.name} on ${accepted}`, M, y + 3)
  y += 9

  // ── Summary band ───────────────────────────────────────────────────────────
  if (deal) {
    const bandH = 27
    pdf.setFillColor(...C.surface)
    pdf.setDrawColor(...C.border)
    pdf.setLineWidth(0.25)
    pdf.roundedRect(M, y, maxW, bandH, 2.5, 2.5, 'FD')
    font('bold', 26, C.dark)
    pdf.text(deal.figure, M + 6, y + 13)
    font('normal', 10.5, C.body)
    pdf.text(pdf.splitTextToSize(deal.text, maxW - 50), M + 36, y + 12)
    font('normal', 8.5, C.muted)
    let fx = M + 6
    for (const fact of deal.facts || []) {
      drawTick(pdf, fx, y + 18.6, 3)
      pdf.text(fact, fx + 4.5, y + 21)
      fx += pdf.getTextWidth(fact) + 12
    }
    y += bandH + 7
  }

  // ── Terms ──────────────────────────────────────────────────────────────────
  blocks.forEach((b, i) => {
    if (b.type === 'effective') {
      boxed(b.text, { bg: C.surface, rule: C.blue, style: 'normal', color: C.muted })
    } else if (b.type === 'notice') {
      boxed(b.text, { bg: C.noticeBg, edge: C.noticeBorder, style: 'bold', color: C.dark })
    } else if (b.type === 'heading') {
      if (i > 0) y += 2
      ensure(6.5 + LH * 2) // keep a heading with at least two lines of its text
      font('bold', 10, C.dark)
      writeLines(pdf.splitTextToSize(b.text.toUpperCase(), maxW), M, 5)
      y += 1.5
    } else {
      if (b.lead) {
        ensure(LH * 3)
        font('bold', 9.5, C.dark)
        writeLines(pdf.splitTextToSize(b.lead, maxW), M)
      }
      font('normal', 9.5, C.body)
      writeLines(pdf.splitTextToSize(b.text, maxW), M)
      y += 2.6
    }
  })

  // ── Acceptance record (kept together on one page) ──────────────────────────
  font('normal', 9.5, C.body)
  const confLines = confirmations.map((t) => pdf.splitTextToSize(t, maxW - 8))
  const confH = confLines.reduce((s, l) => s + l.length * LH + 2.2, 0)
  const sigBoxH = 34
  const recordH = 14 + 4 * 6.5 + 10 + confH + 5 + sigBoxH + 4
  if (y + 4 + recordH > bottom) {
    newPage()
  } else {
    // Separator only when the record follows the terms on the same page; a
    // fresh page already has the header rule.
    y += 4
    pdf.setDrawColor(...C.border)
    pdf.setLineWidth(0.3)
    pdf.line(M, y, W - M, y)
  }
  y += 7
  font('bold', 11, C.dark)
  pdf.text('ACCEPTANCE RECORD', M, y)
  y += 7

  const rows = [
    ['Full name', signer.name],
    ['Email', signer.email],
    ['Role', roleLabel],
    ['Accepted on', accepted],
  ]
  for (const [label, value] of rows) {
    font('normal', 9, C.muted)
    pdf.text(label, M, y + 3.5)
    font('bold', 10, C.dark)
    pdf.text(String(value || '—'), M + 32, y + 3.5)
    y += 6.5
  }
  y += 3

  font('bold', 9, C.muted)
  pdf.text('CONFIRMED BY THE SIGNER', M, y + 3)
  y += 7
  confLines.forEach((lines) => {
    drawTick(pdf, M, y + 0.6, 3.4)
    font('normal', 9.5, C.body)
    pdf.text(lines, M + 6.5, y + 3.2)
    y += lines.length * LH + 2.2
  })
  y += 5

  const boxW = 90
  pdf.setDrawColor(...C.border)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(M, y, boxW, sigBoxH, 2, 2, 'S')
  if (signaturePng) {
    const img = pdf.getImageProperties(signaturePng)
    const fitW = boxW - 10
    const fitH = sigBoxH - 12
    const s = Math.min(fitW / img.width, fitH / img.height)
    const iw = img.width * s
    const ih = img.height * s
    // FAST = Flate-compressed; without it jsPDF stores the pixels raw (~800 KB).
    pdf.addImage(signaturePng, 'PNG', M + (boxW - iw) / 2, y + 3 + (fitH - ih) / 2, iw, ih, 'signature', 'FAST')
  }
  pdf.setDrawColor(...C.muted)
  pdf.setLineWidth(0.2)
  pdf.line(M + 5, y + sigBoxH - 7, M + boxW - 5, y + sigBoxH - 7)
  font('normal', 7.5, C.muted)
  pdf.text('Signature', M + 5, y + sigBoxH - 3)

  const sx = M + boxW + 8
  font('bold', 10, C.dark)
  pdf.text(signer.name, sx, y + 10)
  font('normal', 9, C.body)
  pdf.text(signer.email, sx, y + 15.5)
  font('normal', 8.5, C.muted)
  pdf.text(
    pdf.splitTextToSize(`Signed electronically on ${accepted} while setting up a Rysflo dashboard account.`, W - M - sx),
    sx,
    y + 22
  )

  // ── Header and footer on every page ────────────────────────────────────────
  const pages = pdf.getNumberOfPages()
  const logo = logoPng ? pdf.getImageProperties(logoPng) : null
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p)
    if (logo) {
      const lh = 8.5
      pdf.addImage(logoPng, 'PNG', M, 11, (logo.width / logo.height) * lh, lh, 'rysflo-logo', 'FAST')
    }
    font('bold', 8.5, C.dark)
    pdf.text(title, W - M, version ? 14 : 16, { align: 'right' })
    if (version) {
      font('normal', 7.5, C.muted)
      pdf.text(version, W - M, 18, { align: 'right' })
    }
    pdf.setDrawColor(...C.border)
    pdf.setLineWidth(0.3)
    pdf.line(M, 23, W - M, 23)

    pdf.line(M, H - 14, W - M, H - 14)
    font('normal', 7.5, C.muted)
    pdf.text(`Signed by ${signer.name} (${signer.email}) on ${accepted}`, M, H - 9.5)
    pdf.text(`Page ${p} of ${pages}`, W - M, H - 9.5, { align: 'right' })
  }

  const blob = pdf.output('blob')
  return new File([blob], fileName, { type: 'application/pdf' })
}
