'use client'

// Draw-to-sign box used on the agreement step. Strokes are kept as points so
// the canvas can be redrawn after a resize, and so toPng() can crop to the ink
// and render it at a higher resolution for the PDF.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'

const INK = '#1b2a4a'
const LINE_WIDTH = 2.2

function drawStrokes(ctx, strokes, scale = 1, dx = 0, dy = 0) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineWidth = LINE_WIDTH * scale
  for (const pts of strokes) {
    const P = (p) => ({ x: (p.x - dx) * scale, y: (p.y - dy) * scale })
    if (pts.length === 1) {
      const p = P(pts[0])
      ctx.beginPath()
      ctx.arc(p.x, p.y, (LINE_WIDTH * scale) / 2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    ctx.beginPath()
    let prev = P(pts[0])
    ctx.moveTo(prev.x, prev.y)
    for (let i = 1; i < pts.length; i++) {
      const cur = P(pts[i])
      ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2)
      prev = cur
    }
    ctx.lineTo(prev.x, prev.y)
    ctx.stroke()
  }
}

const SignaturePad = forwardRef(function SignaturePad({ onChange, placeholder = 'Sign here with your mouse or finger' }, ref) {
  const canvasRef = useRef(null)
  const strokesRef = useRef([])
  const drawingRef = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawStrokes(ctx, strokesRef.current)
  }, [])

  useEffect(() => {
    redraw()
    const ro = new ResizeObserver(redraw)
    ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [redraw])

  const setInk = useCallback(
    (v) => {
      setHasInk(v)
      onChange?.(v)
    },
    [onChange]
  )

  const point = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function handlePointerDown(e) {
    e.preventDefault()
    drawingRef.current = true
    canvasRef.current.setPointerCapture(e.pointerId)
    strokesRef.current.push([point(e)])
    redraw()
    if (!hasInk) setInk(true)
  }

  function handlePointerMove(e) {
    if (!drawingRef.current) return
    const stroke = strokesRef.current[strokesRef.current.length - 1]
    stroke.push(point(e))
    const ctx = canvasRef.current.getContext('2d')
    // Draw just the newest segment; a full redraw happens on resize.
    drawStrokes(ctx, [stroke.slice(-3)])
  }

  function handlePointerUp() {
    drawingRef.current = false
  }

  const clear = useCallback(() => {
    strokesRef.current = []
    redraw()
    setInk(false)
  }, [redraw, setInk])

  useImperativeHandle(
    ref,
    () => ({
      clear,
      isEmpty: () => strokesRef.current.length === 0,
      // PNG data URL cropped to the ink, rendered at 3x for a crisp PDF.
      toPng: () => {
        const strokes = strokesRef.current
        if (!strokes.length) return null
        const all = strokes.flat()
        const pad = LINE_WIDTH * 2
        const minX = Math.min(...all.map((p) => p.x)) - pad
        const minY = Math.min(...all.map((p) => p.y)) - pad
        const maxX = Math.max(...all.map((p) => p.x)) + pad
        const maxY = Math.max(...all.map((p) => p.y)) + pad
        const scale = 3
        const out = document.createElement('canvas')
        out.width = Math.ceil((maxX - minX) * scale)
        out.height = Math.ceil((maxY - minY) * scale)
        drawStrokes(out.getContext('2d'), strokes, scale, minX, minY)
        return out.toDataURL('image/png')
      },
    }),
    [clear]
  )

  return (
    <div
      className={`relative h-[130px] rounded-[10px] bg-white border-[1.5px] ${
        hasInk ? 'border-solid border-[#e1e6ed]' : 'border-dashed border-[#308bf9]/45'
      }`}
    >
      <canvas
        ref={canvasRef}
        aria-label="Signature pad"
        className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      {!hasInk && (
        <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[#738298] pointer-events-none">
          {placeholder}
        </div>
      )}
      <div className="absolute left-[18px] right-[18px] bottom-[28px] border-b border-[#e1e6ed] pointer-events-none" />
      <button
        type="button"
        onClick={clear}
        className="absolute top-2 right-2 px-2.5 py-[3px] text-[11px] font-medium text-[#738298] bg-[#f5f7fa] border border-[#e1e6ed] rounded-[33px] cursor-pointer hover:text-[#252525]"
      >
        Clear
      </button>
    </div>
  )
})

export default SignaturePad
