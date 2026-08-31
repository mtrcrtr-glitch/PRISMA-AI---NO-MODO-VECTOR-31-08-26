import { X } from "lucide-react"
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import { env } from "#/env.ts"

/**
 * The HappySeeds attribution badge.
 *
 * Off by default and deliberately so: it renders only once a remote check for
 * this project says it should, which keeps a generated app clean unless the
 * platform opts it in. Missing configuration, a failed request or a malformed
 * response all resolve the same way — nothing renders.
 */

const REACTUS_ORIGIN = (env.VITE_REACTUS_BASE_URL ?? "").replace(/\/$/, "")
const WATERMARK_API_BASE = REACTUS_ORIGIN ? `${REACTUS_ORIGIN}/v1/project` : ""
const PROJECT_ID = (env.VITE_HAPPYSEEDS_PROJECT_ID ?? "").trim()
const WATERMARK_LINK_URL = `https://link.happyseeds.ai/watermark?utm_term=${encodeURIComponent(
  PROJECT_ID,
)}`
const HAPPYSEEDS_LOGO_URL = "https://happyseeds.ai/logo.svg"
const HOST_APP_UA_REGEX = /HostApp\//i
const subscribeNoop = () => () => {}

// Fixed for the document's lifetime: neither the frame relationship nor the
// user agent can change after load. Computed on first read and cached, so
// every later render gets the snapshot back without redoing the work.
let embedded: boolean | undefined

function computeIsEmbedded() {
  try {
    if (window.self !== window.top) return true
  } catch {
    // A cross-origin parent throws on access, which itself means embedded.
    return true
  }
  return HOST_APP_UA_REGEX.test(navigator.userAgent)
}

function readIsEmbedded() {
  embedded ??= computeIsEmbedded()
  return embedded
}

const WATERMARK_DEFAULT_OFFSET = 24
const WATERMARK_EDGE_GAP = 12

/** Pointer travel, in px, that turns a press into a drag instead of a click. */
const DRAG_CLICK_THRESHOLD = 5

interface WatermarkPosition {
  x: number
  y: number
}

interface ActiveDrag {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

interface WatermarkData {
  handle: string
  remix: boolean
}

/**
 * Narrows the watermark endpoint's envelope. Anything short of an explicit
 * `success` + `show_watermark` returns null, so an unreachable or changed API
 * hides the badge rather than guessing.
 */
function parseWatermarkResponse(payload: unknown): WatermarkData | null {
  if (!payload || typeof payload !== "object") return null
  const envelope = payload as { success?: unknown; data?: unknown }
  if (envelope.success !== true) return null

  const data = envelope.data
  if (!data || typeof data !== "object") return null
  const record = data as {
    show_watermark?: unknown
    handle?: unknown
    remix?: unknown
  }
  if (record.show_watermark !== true) return null

  const rawHandle =
    typeof record.handle === "string" ? record.handle.trim() : ""
  const handle = rawHandle
    ? rawHandle.startsWith("@")
      ? rawHandle
      : `@${rawHandle}`
    : ""

  return { handle, remix: record.remix === true }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Keeps the badge fully on screen with a constant gap at every edge. */
function clampWatermarkPosition(
  position: WatermarkPosition,
  element: HTMLElement,
): WatermarkPosition {
  const rect = element.getBoundingClientRect()
  const maxX = Math.max(
    WATERMARK_EDGE_GAP,
    window.innerWidth - rect.width - WATERMARK_EDGE_GAP,
  )
  const maxY = Math.max(
    WATERMARK_EDGE_GAP,
    window.innerHeight - rect.height - WATERMARK_EDGE_GAP,
  )

  return {
    x: clamp(position.x, WATERMARK_EDGE_GAP, maxX),
    y: clamp(position.y, WATERMARK_EDGE_GAP, maxY),
  }
}

function getDefaultPosition(element: HTMLElement): WatermarkPosition {
  const rect = element.getBoundingClientRect()
  return {
    x: window.innerWidth - rect.width - WATERMARK_DEFAULT_OFFSET,
    y: window.innerHeight - rect.height - WATERMARK_DEFAULT_OFFSET,
  }
}

export function HappySeedsWatermark() {
  const watermarkRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<ActiveDrag | null>(null)
  const suppressClickRef = useRef(false)
  const hasUserMovedRef = useRef(false)

  // False only for the SSR and hydration renders, so the server and the
  // initial client tree agree. It also guards the fetch below: during
  // hydration `isEmbedded` is still the server snapshot, and `ready` is what
  // holds the request back until the real value has been read.
  const ready = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  )
  const isEmbedded = useSyncExternalStore(
    subscribeNoop,
    readIsEmbedded,
    () => false,
  )
  const [dismissed, setDismissed] = useState(false)
  const [visible, setVisible] = useState(false)
  const [handle, setHandle] = useState("")
  const [remix, setRemix] = useState(false)
  const [position, setPosition] = useState<WatermarkPosition | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!ready || isEmbedded || dismissed) return
    if (!PROJECT_ID || !WATERMARK_API_BASE) return

    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(
          `${WATERMARK_API_BASE}/${PROJECT_ID}/watermark`,
        )
        const payload: unknown = await response.json().catch(() => null)
        const parsed = parseWatermarkResponse(payload)
        if (cancelled || !parsed) return

        setHandle(parsed.handle)
        setRemix(parsed.remix)
        setVisible(true)
      } catch {
        // Attribution is never worth surfacing an error for.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [ready, isEmbedded, dismissed])

  // A badge the user has never moved keeps tracking the corner; one they have
  // moved keeps its spot and is only pulled back inside the viewport.
  function syncPosition() {
    const element = watermarkRef.current
    if (!element) return

    setPosition((current) => {
      const source =
        hasUserMovedRef.current && current
          ? current
          : getDefaultPosition(element)
      return clampWatermarkPosition(source, element)
    })
  }

  // Measured after paint: the first pass renders hidden with `right`/`bottom`
  // so there is a real box to measure before switching to `left`/`top`.
  useEffect(() => {
    if (!visible) return

    const frame = window.requestAnimationFrame(syncPosition)
    const handleViewportChange = () => syncPosition()

    window.addEventListener("resize", handleViewportChange)
    window.visualViewport?.addEventListener("resize", handleViewportChange)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", handleViewportChange)
      window.visualViewport?.removeEventListener("resize", handleViewportChange)
    }
  }, [visible, handle, remix])

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return
    }

    const element = watermarkRef.current
    if (!element) return

    const rect = element.getBoundingClientRect()
    const origin = clampWatermarkPosition(
      position ?? { x: rect.left, y: rect.top },
      element,
    )

    // No pointer capture and no state update until the drag threshold is
    // crossed, so a plain press still reaches the anchor as a click.
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const element = watermarkRef.current
    if (!drag || !element || drag.pointerId !== event.pointerId) return

    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY

    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_CLICK_THRESHOLD) return

      drag.moved = true
      hasUserMovedRef.current = true
      setDragging(true)
      setPosition(
        clampWatermarkPosition({ x: drag.originX, y: drag.originY }, element),
      )
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Capture is an optimisation; dragging still works without it.
      }
    }

    event.preventDefault()
    setPosition(
      clampWatermarkPosition(
        { x: drag.originX + dx, y: drag.originY + dy },
        element,
      ),
    )
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const element = watermarkRef.current
    if (!drag || !element || drag.pointerId !== event.pointerId) return

    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    const moved = drag.moved

    dragRef.current = null
    setDragging(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (!moved) return

    event.preventDefault()
    // Releasing after a drag still fires a click on the anchor; swallow that
    // one and clear the flag on the next tick.
    suppressClickRef.current = true

    setPosition(
      clampWatermarkPosition(
        { x: drag.originX + dx, y: drag.originY + dy },
        element,
      ),
    )

    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  function handleLinkClick(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (!suppressClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = false
  }

  function onClose(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    setDismissed(true)
    setVisible(false)
  }

  if (!ready || isEmbedded || dismissed || !visible) {
    return null
  }

  const actionText = remix ? "Remixed with" : "Edit with"
  const ariaLabel = handle
    ? `${handle} ${actionText} HappySeeds`
    : `${actionText} HappySeeds`

  return (
    <div
      ref={watermarkRef}
      className="pointer-events-auto fixed z-50 font-sans"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      style={{
        left: position ? `${position.x}px` : undefined,
        top: position ? `${position.y}px` : undefined,
        right: position ? undefined : `${WATERMARK_DEFAULT_OFFSET}px`,
        bottom: position ? undefined : `${WATERMARK_DEFAULT_OFFSET}px`,
        maxWidth: `calc(100vw - ${WATERMARK_EDGE_GAP * 2}px)`,
        touchAction: "none",
        userSelect: "none",
        cursor: dragging ? "grabbing" : "grab",
        visibility: position ? "visible" : "hidden",
      }}
    >
      {/*
        Literal colours, not theme tokens: this is platform chrome and must
        look identical whatever palette the generated app adopts.
      */}
      <div className="flex max-w-full items-stretch overflow-hidden rounded-full border border-[#e5e5e5] bg-[#ffffff] shadow-sm">
        <a
          href={WATERMARK_LINK_URL}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          onClick={handleLinkClick}
          aria-label={ariaLabel}
          title={`${ariaLabel}. Drag to reposition.`}
          className="flex max-w-full items-center gap-1.5 px-3.5 py-2 text-sm no-underline hover:bg-[#fafafa]"
        >
          <span className="shrink-0 text-[#737373]">{actionText}</span>
          <img
            src={HAPPYSEEDS_LOGO_URL}
            alt=""
            width={20}
            height={20}
            draggable={false}
            className="size-5 shrink-0"
          />
          <span className="shrink-0 font-medium text-[#171717]">
            HappySeeds
          </span>
        </a>
        <button
          type="button"
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
          className="flex shrink-0 items-center justify-center px-2.5 text-[#a3a3a3] hover:bg-[#fafafa] hover:text-[#525252]"
          aria-label="Close"
        >
          <X className="size-3.5 shrink-0" aria-hidden strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}