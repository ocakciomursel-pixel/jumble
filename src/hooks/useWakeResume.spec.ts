import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWakeResume, WAKE_RESUME_COOLDOWN_MS } from './useWakeResume'

const state = vi.hoisted(() => ({
  value: 0,
  cleanup: undefined as (() => void) | undefined
}))

vi.mock('react', () => ({
  useState: () => [
    state.value,
    (updater: number | ((prev: number) => number)) => {
      state.value = typeof updater === 'function' ? updater(state.value) : updater
    }
  ],
  useEffect: (effect: () => (() => void) | void) => {
    state.cleanup?.()
    state.cleanup = effect() || undefined
  }
}))

describe('useWakeResume (#15)', () => {
  let docTarget: EventTarget & { visibilityState: DocumentVisibilityState }
  let winTarget: EventTarget

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-26T12:00:00Z'))
    state.value = 0
    state.cleanup = undefined
    docTarget = Object.assign(new EventTarget(), {
      visibilityState: 'visible' as DocumentVisibilityState
    })
    winTarget = new EventTarget()
    vi.stubGlobal('document', docTarget)
    vi.stubGlobal('window', winTarget)
  })

  afterEach(() => {
    state.cleanup?.()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('increments resumeCount when waking from hidden to visible after cooldown', () => {
    useWakeResume()
    expect(state.value).toBe(0)

    docTarget.visibilityState = 'hidden'
    docTarget.dispatchEvent(new Event('visibilitychange'))
    expect(state.value).toBe(0)

    vi.advanceTimersByTime(WAKE_RESUME_COOLDOWN_MS + 1000)
    docTarget.visibilityState = 'visible'
    docTarget.dispatchEvent(new Event('visibilitychange'))
    expect(state.value).toBe(1)
  })

  it('throttles rapid wake events within cooldown window', () => {
    useWakeResume()

    docTarget.visibilityState = 'hidden'
    docTarget.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(2000)
    docTarget.visibilityState = 'visible'
    docTarget.dispatchEvent(new Event('visibilitychange'))
    expect(state.value).toBe(0)

    vi.advanceTimersByTime(WAKE_RESUME_COOLDOWN_MS)
    winTarget.dispatchEvent(new Event('online'))
    expect(state.value).toBe(1)
  })

  it('increments resumeCount on persisted pageshow (bfcache wake)', () => {
    useWakeResume()
    vi.advanceTimersByTime(WAKE_RESUME_COOLDOWN_MS + 500)
    const pageShowEvt = Object.assign(new Event('pageshow'), { persisted: true })
    winTarget.dispatchEvent(pageShowEvt)
    expect(state.value).toBe(1)
  })
})
