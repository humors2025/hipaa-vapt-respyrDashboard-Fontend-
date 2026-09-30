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
 * The three claims carried on rysflo.com's hero, minus the price. Icons are the
 * site's own 24px paths, stroked onto the canvas through Path2D so the poster
 * and the website say the same thing in the same marks.
 */
const FEATURES = [
  {
    label: "Device included",
    paths: [
      "M3.5 7.5 12 3.2l8.5 4.3v9L12 20.8 3.5 16.5v-9Z",
      "M3.5 7.5 12 11.8l8.5-4.3M12 11.8v9",
    ],
  },
  {
    label: "AI meal plans",
    paths: [
      "M3.4 11.2h17.2a8.6 8.6 0 0 1-17.2 0Z",
      "M9.2 8.1c0-1.3 1.2-1.9 1.2-3.1M12 7.7c0-1.5 1.4-2.1 1.4-3.4M14.8 8.1c0-1.1 1-1.7 1-2.7",
    ],
  },
  {
    label: "HIPAA compliant",
    paths: [
      "M12 2.6 4.4 5.9v5.5c0 4.7 3.1 8.4 7.6 10 4.5-1.6 7.6-5.3 7.6-10V5.9L12 2.6Z",
      "M8.7 11.9l2.3 2.3 4.3-4.6",
    ],
  },
];

/** Stroke a 24x24 icon with its top-left at (x, y). */
function icon(ctx, paths, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const d of paths) ctx.stroke(new Path2D(d));
  ctx.restore();
}

/** One centred row of icon + label, returning the height it used. */
function featureRow(ctx, y, { size = 56, gap = 22, between = 110, color = SOFT } = {}) {
  ctx.font = font(size, 500);
  const items = FEATURES.map((f) => ({
    ...f,
    w: size + gap + ctx.measureText(f.label).width,
  }));
  const total = items.reduce((a, it) => a + it.w, 0) + between * (items.length - 1);
  let x = W / 2 - total / 2;
  ctx.textAlign = "left";
  for (const it of items) {
    icon(ctx, it.paths, x, y - size * 0.82, size, color);
    ctx.fillStyle = color;
    ctx.font = font(size, 500);
    ctx.fillText(it.label, x + size + gap, y);
    x += it.w + between;
  }
  ctx.textAlign = "center";
  return size;
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

  // ── call to action ──────────────────────────────────────────────
  y = cardY + card + 120;
  line(ctx, "Point your phone camera at the code", y, { size: 60, weight: 500 });

  // ── promise band ───────────────────────────────────────────────
  // Deliberately no price. These sheets go on a wall and stay there, and the
  // price is the thing most likely to change underneath them.
  y += 80;
  const bandH = 160;
  const btn = ctx.createLinearGradient(0, y, 0, y + bandH);
  btn.addColorStop(0, BLUE);
  btn.addColorStop(1, BLUE_HI);
  ctx.fillStyle = btn;
  roundRect(ctx, 250, y, W - 500, bandH, 46);
  ctx.fill();

  line(ctx, "See how your body utilizes fuel", y + 102, { size: 76, weight: 600, color: PAPER });
  y += bandH;

  // ── what they get ──────────────────────────────────────────────
  y += 110;
  y += featureRow(ctx, y);

  // ── footer ────────────────────────────────────────────────
  // No gym name and no partner code: the printed sheet is identical before and
  // after the sticker is mapped, so one print run serves every partner. The id
  // below is an inventory mark for the field team, not a code for the member.
  y += 100;
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
