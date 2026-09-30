/**
 * Print-ready QR poster.
 *
 * Derek needs one download that he can take straight to a print shop and put on
 * a gym wall, so this composes the sticker's QR into a branded A4-proportion
 * poster rather than handing over a bare QR image.
 *
 * Drawn at 300 dpi (2480 x 3508 = A4). The QR is painted from the page's own
 * <canvas>, pixel-doubled with smoothing off, so the modules stay hard-edged
 * and the code is never resampled into something a scanner can misread.
 */

const W = 2480;
const H = 3508;

// Brand tokens, taken from the website's dark theme so print matches screen.
const INK = "#0f1114";        // --page
const PANEL = "#171a1f";      // --panel
const BLUE = "#308bf9";       // --blue
const BLUE_HI = "#1f7ce8";    // --blue-hi
const BLUE_DEEP = "#14294a";  // --blue-light (dark theme)
const PAPER = "#ffffff";
const SOFT = "#b9bfc9";       // --text-secondary
const MUTED = "#818a97";      // --text-muted
const FAINT = "#5c636d";      // --text-disabled

const font = (size, weight = 400) =>
  `${weight} ${size}px Poppins, Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Centre one line of text and return the baseline it ended on. */
function line(ctx, text, y, { size, weight = 400, color = PAPER, spacing = 0 } = {}) {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  if (!spacing) {
    ctx.fillText(text, W / 2, y);
    return y;
  }
  // Canvas has no letter-spacing everywhere yet, so lay the glyphs out by hand.
  const chars = [...text];
  const width = chars.reduce((a, c) => a + ctx.measureText(c).width + spacing, -spacing);
  let x = W / 2 - width / 2;
  ctx.textAlign = "left";
  for (const c of chars) {
    ctx.fillText(c, x, y);
    x += ctx.measureText(c).width + spacing;
  }
  ctx.textAlign = "center";
  return y;
}

/** Never let a slow asset hang the download; the poster falls back to wordmark. */
function loadImage(src, ms = 4000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error("image timeout: " + src)), ms);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error("image failed: " + src)); };
    img.src = src;
  });
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((r) => setTimeout(r, ms))]);
}

/**
 * @param {HTMLCanvasElement} qrCanvas  the QR already rendered on the page
 * @param {object} opts  { code?, facilityName?, stickerId?, url, kind }
 *
 * The poster never changes once it is printed. A batch is printed unassigned,
 * Derek carries the prints, and the mapping from sticker to gym happens later
 * in the database — the sheet on the wall is the same sheet either way. So
 * nothing gym-specific is painted on it: the QR carries the sticker, and the
 * sticker resolves to whichever partner it is mapped to at scan time.
 * @returns {Promise<string>} a PNG data URL
 */
export async function buildQrPoster(qrCanvas, { code, stickerId, url, kind = "facility" } = {}) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");

  // Poppins must be resolved before measuring text, but a font that never
  // settles must not block the download either.
  try {
    await withTimeout(document.fonts.ready, 3000);
  } catch {}

  // ── ground ────────────────────────────────────────────────────────────────
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  // The ground stays flat #0f1114, exactly as rysflo.com renders in dark mode.
  // Blue appears only where it means something: the top rule, the price band
  // and the fallback code — not as a wash across the paper.
  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, W, 26);

  // ── logo ──────────────────────────────────────────────────────────────────
  let y = 300;
  try {
    const logo = await loadImage("/brand/logo-white.svg");
    const lw = 620;
    const lh = (logo.height / logo.width) * lw;
    ctx.drawImage(logo, W / 2 - lw / 2, y - lh, lw, lh);
  } catch {
    line(ctx, "rysflo", y, { size: 130, weight: 600 });
  }

  // Sits with the logo rather than the headline: it says what Rysflo is, to a
  // reader who has never heard of it and is walking past a gym wall.
  y = 400;
  line(ctx, "Metabolism tracker for everyday gym members", y, {
    size: 54,
    weight: 500,
    color: BLUE,
    spacing: 2,
  });

  // ── headline ──────────────────────────────────────────────────────────────
  y = 810;
  line(ctx, "See what your body", y, { size: 158, weight: 600 });
  y += 185;
  line(ctx, "is running on", y, { size: 158, weight: 600 });

  y += 135;
  line(ctx, "One 60-second breath each morning shows whether you are", y, { size: 60, color: SOFT });
  y += 88;
  line(ctx, "burning fat, absorbing your food, or fermenting sugar.", y, { size: 60, color: SOFT });

  // ── QR card ───────────────────────────────────────────────────────────────
  const card = 1120;
  const cardX = W / 2 - card / 2;
  const cardY = 1470;
  ctx.fillStyle = PANEL;
  roundRect(ctx, cardX - 34, cardY - 34, card + 68, card + 68, 92);
  ctx.fill();
  ctx.strokeStyle = "rgba(48,139,249,0.55)";
  ctx.lineWidth = 4;
  roundRect(ctx, cardX - 34, cardY - 34, card + 68, card + 68, 92);
  ctx.stroke();

  ctx.fillStyle = PAPER;
  roundRect(ctx, cardX, cardY, card, card, 72);
  ctx.fill();

  // The QR itself: nearest-neighbour so modules stay crisp at print size.
  const pad = 92;
  const qrSize = card - pad * 2;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrCanvas, cardX + pad, cardY + pad, qrSize, qrSize);
  ctx.imageSmoothingEnabled = true;

  // ── call to action ────────────────────────────────────────────────────────
  y = cardY + card + 130;
  line(ctx, "Point your phone camera at the code", y, { size: 66, weight: 500 });

  // ── price band ────────────────────────────────────────────────────────────
  y += 110;
  const bandH = 230;
  const btn = ctx.createLinearGradient(0, y, 0, y + bandH);
  btn.addColorStop(0, BLUE);
  btn.addColorStop(1, BLUE_HI);
  ctx.fillStyle = btn;
  roundRect(ctx, 250, y, W - 500, bandH, 46);
  ctx.fill();

  line(ctx, "$29 a month with this code", y + 95, { size: 76, weight: 600, color: PAPER });
  line(ctx, "Normally $49 \u00b7 device included \u00b7 nothing upfront", y + 172, { size: 48, color: "rgba(255,255,255,0.86)" });
  y += bandH;

  // ── footer ────────────────────────────────────────────────
  // No gym name and no partner code: the printed sheet is identical before and
  // after the sticker is mapped, so one print run serves every partner. The id
  // below is an inventory mark for the field team, not a code for the member.
  y += 92;
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(250, y, W - 500, 2);
  y += 78;

  line(ctx, "rysflo.com", y, { size: 52, weight: 500, color: SOFT });
  y += 78;

  const mark = stickerId || code;
  if (mark) {
    line(ctx, mark, y, { size: 38, color: FAINT, spacing: 6 });
    y += 60;
  }

  line(
    ctx,
    "Rysflo is a wellness tracker. It does not diagnose any condition.",
    y,
    { size: 38, color: FAINT }
  );

  return c.toDataURL("image/png");
}
