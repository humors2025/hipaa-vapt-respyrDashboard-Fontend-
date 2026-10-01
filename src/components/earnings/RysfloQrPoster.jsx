"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import s from "./RysfloQrPoster.module.css";

/**
 * The "See What Your Body Is Running On" poster with this partner's QR and code,
 * plus a print-ready 5 x 7 in PDF (300 dpi) download.
 *
 * On screen it is laid out in the poster's own pixel coordinates (1429 x 2000)
 * scaled by container-query units; the PDF redraws the same coordinates onto a
 * canvas, reading the logo, icon, QR and chip positions back from the live DOM so
 * the two never drift. If you move something in the CSS, update drawPoster too.
 */

const POSTER_W = 1429, POSTER_H = 2000, DPI = 300, PAGE_W = 5, PAGE_H = 7;
const FONT = "RysfloPoster";
const LOGO_SRC = "/brand/rysflo-poster-logo.svg";

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function svgToImage(svg, color) {
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("class");
  clone.removeAttribute("style");
  const markup = new XMLSerializer().serializeToString(clone).replace(/currentColor/g, color);
  return loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup));
}

async function drawPoster(popup) {
  await Promise.all([
    document.fonts.load(`700 100px ${FONT}`),
    document.fonts.load(`600 100px ${FONT}`),
    document.fonts.load(`400 100px ${FONT}`),
    document.fonts.load(`italic 400 100px ${FONT}`),
  ]);
  const W = Math.round(PAGE_W * DPI), H = Math.round(PAGE_H * DPI);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.scale(W / POSTER_W, H / POSTER_H); // draw in poster pixels from here on

  const pr = popup.getBoundingClientRect(), u = pr.width / POSTER_W;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return [(r.left - pr.left) / u, (r.top - pr.top) / u, r.width / u, r.height / u];
  };
  const q = (cls) => popup.querySelector("." + cls);

  // background + top bar
  const g = ctx.createLinearGradient(0, 0, 0, POSTER_H);
  g.addColorStop(0, "#252525");
  g.addColorStop(0.775, "#252525");
  g.addColorStop(1, "#29496f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  ctx.fillStyle = "#308bf9";
  ctx.fillRect(0, 0, POSTER_W, 22);

  // QR card, card rule, bottom rule
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(357, 808, 716, 820, 60);
  ctx.fill();
  ctx.fillStyle = "#308bf9";
  ctx.fillRect(398, 1402, 633, 3);
  ctx.fillStyle = "#00234d";
  ctx.fillRect(78, 1806, 1273, 3);

  // QR is vector, so it stays hard-edged at print resolution
  {
    const img = await svgToImage(q(s.qr), "#000"), [x, y, w, h] = box(q(s.qr));
    ctx.drawImage(img, x, y, w, h);
  }

  // logo + feature icons
  {
    const logoEl = q(s.logo), [x, y, w, h] = box(logoEl);
    ctx.drawImage(await loadImage(LOGO_SRC), x, y, w, h);
  }
  for (const el of popup.querySelectorAll(`.${s.feat} svg`)) {
    const img = await svgToImage(el, "#308bf9"), [x, y, w, h] = box(el);
    ctx.drawImage(img, x, y, w, h);
  }

  // centred text; baseline = cap-top + .7em, same rule the CSS uses
  const P = (w, size, i = "") => `${i}${w} ${size}px ${FONT}`;
  const centred = (runs, baseline, spacing = 0) => {
    const set = (r) => {
      ctx.font = r.font;
      ctx.letterSpacing = (r.ls ?? spacing) + "px";
    };
    const widths = runs.map((r) => {
      set(r);
      return ctx.measureText(r.text).width;
    });
    let x = (POSTER_W - widths.reduce((a, b) => a + b, 0)) / 2;
    runs.forEach((r, i) => {
      set(r);
      ctx.fillStyle = r.color;
      ctx.fillText(r.text, x, baseline);
      x += widths[i];
    });
    ctx.letterSpacing = "0px";
  };
  centred([{ text: "Metabolism Tracker For Everyday Gym Members", font: P(400, 36.8), color: "#308bf9" }], 264 + 0.7 * 36.8);
  centred([{ text: "See What Your Body", font: P(700, 108), color: "#fff" }], 394 + 0.7 * 108, -0.54);
  centred(
    [
      { text: "Is ", font: P(700, 108), color: "#fff" },
      { text: "Running On", font: P(400, 108, "italic "), color: "#fff" },
    ],
    394 + 120 + 0.7 * 108,
    -0.54
  );
  centred([{ text: "A 60-second breath each morning shows whether you are", font: P(400, 38.2), color: "#d9d9d9" }], 662 + 0.7 * 38.2);
  centred([{ text: "burning fat, absorbing your food, or fermenting sugar.", font: P(400, 38.2), color: "#d9d9d9" }], 662 + 60 + 0.7 * 38.2);
  centred([{ text: "Point Your Phone Camera At The Code", font: P(400, 30.6), color: "#308bf9" }], 1434 + 0.7 * 30.6);

  // code chip: dashed coupon box, tag, divider, code (positions read from the live layout)
  {
    const [x, y, w, h] = box(q(s.chip)), bw = 3;
    ctx.fillStyle = "#eaf3ff";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 22);
    ctx.fill();
    ctx.strokeStyle = "#308bf9";
    ctx.lineWidth = bw;
    ctx.setLineDash([12, 9]);
    ctx.beginPath();
    ctx.roundRect(x + bw / 2, y + bw / 2, w - bw, h - bw, 22 - bw / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const [dx, dy, dw, dh] = box(q(s.chipDiv));
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#308bf9";
    ctx.fillRect(dx, dy, dw, dh);
    ctx.globalAlpha = 1;
    for (const [cls, fs, weight, ls, color] of [
      [s.chipTag, 22, 600, 0.16, "#308bf9"],
      [s.chipCode, 46, 700, 0.1, "#252525"],
    ]) {
      const el = q(cls), [tx, ty] = box(el);
      ctx.font = P(weight, fs);
      ctx.letterSpacing = ls * fs + "px";
      ctx.fillStyle = color;
      ctx.fillText(el.textContent, tx, ty + 0.85 * fs);
    }
    ctx.letterSpacing = "0px";
  }
  centred([{ text: "Rysflo.com", font: P(400, 30.3), color: "#fff" }], 1841 + 0.7 * 30.3);
  centred([{ text: "Rysflo is a wellness tracker. It does not diagnose any conditions.", font: P(400, 22.8), color: "#9d9d9d" }], 1931 + 0.7 * 22.8);

  // feature labels, left edge taken from the live layout
  ctx.font = P(400, 28.2);
  ctx.fillStyle = "#fff";
  for (const f of popup.querySelectorAll("." + s.feat)) {
    const node = [...f.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    const r = document.createRange();
    r.selectNodeContents(node);
    ctx.fillText(node.textContent.trim(), (r.getBoundingClientRect().left - pr.left) / u, 1735 + 0.35 * 28.2);
  }
  return c;
}

/**
 * @param value     what the QR encodes (the partner's sign-up link)
 * @param code      shown in the coupon chip under the QR
 * @param codeLabel the chip's tag; keep it short (~10 chars) or the chip overflows
 * @param filename  PDF file name
 * @param onClose   when given, renders as a modal card with a close button
 * @param note      small line under the download button (modal only)
 */
export default function RysfloQrPoster({ value, code, codeLabel = "GYM CODE", filename = "Rysflo-QR-Poster-5x7.pdf", onClose, note }) {
  const popupRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (!popupRef.current) return;
    setBusy(true);
    try {
      const [canvas, { default: jsPDF }] = await Promise.all([drawPoster(popupRef.current), import("jspdf")]);
      const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: [PAGE_W, PAGE_H] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, PAGE_W, PAGE_H, undefined, "FAST");
      pdf.setProperties({ title: "Rysflo QR Poster 5x7" });
      pdf.save(filename);
    } catch (e) {
      console.error(e);
      toast.error("Sorry, the PDF could not be created.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={onClose ? `${s.stack} ${s.modal}` : s.stack}>
      <div ref={popupRef} className={s.popup} role={onClose ? "dialog" : undefined} aria-modal={onClose ? "true" : undefined}>
        <div className={s.topbar} />
        {onClose && (
          <button type="button" className={s.close} onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}

        <img className={s.logo} src={LOGO_SRC} alt="rysflo" width={169} height={48} />

        <p className={`${s.t} ${s.sub}`}>Metabolism Tracker For Everyday Gym Members</p>
        <h2 className={`${s.t} ${s.h}`}>
          See What Your Body
          <br />
          Is <em>Running On</em>
        </h2>
        <p className={`${s.t} ${s.body}`}>
          A 60-second breath each morning shows whether you are
          <br />
          burning fat, absorbing your food, or fermenting sugar.
        </p>

        <div className={s.card} />
        <QRCodeSVG className={s.qr} value={value} level="M" marginSize={0} bgColor="#ffffff" fgColor="#000000" role="img" aria-label="QR code" />
        <div className={s.cardRule} />
        <p className={`${s.t} ${s.label}`}>Point Your Phone Camera At The Code</p>
        <div className={s.chip}>
          <span className={s.chipTag}>{codeLabel}</span>
          <i className={s.chipDiv} />
          <span className={s.chipCode}>{code}</span>
        </div>

        <div className={`${s.feat} ${s.f1}`}>
          <svg viewBox="0 0 44 48" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
            <path d="M22 3l19 10v22L22 45 3 35V13z" />
            <path d="M3 13l19 10 19-10M22 23v22" />
            <path d="M12.5 8l19 10v8" />
          </svg>
          Device Included
        </div>
        <div className={`${s.feat} ${s.f2}`}>
          <svg viewBox="0 0 50 48" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 6.5A18 18 0 0 0 22 41.5" />
            <path d="M22 12.5A12 12 0 0 0 22 35.5" />
            <path d="M30 4v12a4 4 0 0 0 8 0V4M34 4v40" />
            <path d="M47 44V4c-4 2-6 8-6 16v6h6" />
          </svg>
          AI Meal Plans
        </div>
        <div className={`${s.feat} ${s.f3}`}>
          <svg viewBox="0 0 36 44" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 2l15 6v12c0 10-6.5 17.5-15 22C9.5 37.5 3 30 3 20V8z" />
            <path d="M11 22l5 5 9-10" />
          </svg>
          HIPAA Compliant
        </div>

        <div className={s.rule} />
        <p className={`${s.t} ${s.site}`}>Rysflo.com</p>
        <p className={`${s.t} ${s.disc}`}>Rysflo is a wellness tracker. It does not diagnose any conditions.</p>
      </div>

      <button type="button" className={s.dl} onClick={download} disabled={busy}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
        </svg>
        <span>{busy ? "Preparing PDF…" : "Download QR Poster"}</span>
        <small>PDF &middot; 5&times;7 in</small>
      </button>
      {onClose && note && <div className={s.note}>{note}</div>}
    </div>
  );
}
