/** Run callbacks once per animation frame (coalesced). */
let frameId: number | null = null
const callbacks = new Set<() => void>()

export function scheduleInAnimationFrame(callback: () => void): void {
  callbacks.add(callback)
  if (frameId !== null) return
  frameId = requestAnimationFrame(() => {
    frameId = null
    const run = [...callbacks]
    callbacks.clear()
    for (const fn of run) fn()
  })
}
