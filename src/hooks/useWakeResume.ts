import { useEffect, useState } from 'react'

export const WAKE_RESUME_COOLDOWN_MS = 15_000

export function useWakeResume(cooldownMs = WAKE_RESUME_COOLDOWN_MS) {
  const [resumeCount, setResumeCount] = useState(0)

  useEffect(() => {
    let lastHiddenAt = document.visibilityState === 'hidden' ? Date.now() : 0
    let lastResumeAt = Date.now()

    const triggerResume = () => {
      const now = Date.now()
      if (now - lastResumeAt < cooldownMs) return
      lastResumeAt = now
      setResumeCount((count) => count + 1)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAt = Date.now()
        return
      }
      if (document.visibilityState === 'visible' && lastHiddenAt > 0) {
        triggerResume()
      }
    }

    const handleOnline = () => {
      if (document.visibilityState === 'visible') {
        triggerResume()
      }
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        triggerResume()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('pageshow', handlePageShow)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [cooldownMs])

  return resumeCount
}
