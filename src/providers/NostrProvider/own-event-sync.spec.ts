import { ApplicationDataKey } from '@/constants'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import storage from '@/services/local-storage.service'
import { Event, kinds } from 'nostr-tools'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleOwnReplaceableEvent, TOwnEventSyncCallbacks } from './own-event-sync'

vi.mock('@/services/client.service', () => ({
  default: {
    updateFollowListCache: vi.fn(),
    updateBlossomServerListEventCache: vi.fn()
  }
}))

vi.mock('@/services/indexed-db.service', () => ({
  default: {
    putReplaceableEvent: vi.fn()
  }
}))

vi.mock('@/services/local-storage.service', () => ({
  default: {
    setLastReadNotificationTime: vi.fn(),
    getMediaUploadServiceConfig: vi.fn(() => ({ type: 'blossom' }))
  }
}))

describe('handleOwnReplaceableEvent (#112)', () => {
  const pubkey = 'a'.repeat(64)
  let callbacks: TOwnEventSyncCallbacks

  beforeEach(() => {
    vi.resetAllMocks()
    callbacks = {
      pubkey,
      isAborted: () => false,
      setProfileEvent: vi.fn(),
      setProfile: vi.fn(),
      setFollowListEvent: vi.fn(),
      setMuteListEvent: vi.fn(),
      setBookmarkListEvent: vi.fn(),
      setFavoriteRelaysEvent: vi.fn(),
      setUserEmojiListEvent: vi.fn(),
      setPinListEvent: vi.fn(),
      setPinnedUsersEvent: vi.fn(),
      setNotificationsSeenAt: vi.fn((updater) => updater(100))
    }
  })

  it('updates followListEvent and client cache when a newer Contacts (kind:3) event arrives', async () => {
    const contactEvt = {
      id: 'evt-contacts-new',
      pubkey,
      kind: kinds.Contacts,
      created_at: 200,
      tags: [['p', 'b'.repeat(64)]],
      content: '',
      sig: 'sig'
    } as Event
    vi.mocked(indexedDb.putReplaceableEvent).mockResolvedValue(contactEvt)

    await handleOwnReplaceableEvent(contactEvt, callbacks)

    expect(indexedDb.putReplaceableEvent).toHaveBeenCalledWith(contactEvt)
    expect(callbacks.setFollowListEvent).toHaveBeenCalledWith(contactEvt)
    expect(client.updateFollowListCache).toHaveBeenCalledWith(contactEvt)
  })

  it('ignores stale Contacts event if indexedDb keeps a newer version', async () => {
    const staleEvt = {
      id: 'evt-contacts-stale',
      pubkey,
      kind: kinds.Contacts,
      created_at: 50,
      tags: [],
      content: '',
      sig: 'sig'
    } as Event
    const newerEvt = { ...staleEvt, id: 'evt-contacts-newer', created_at: 300 } as Event
    vi.mocked(indexedDb.putReplaceableEvent).mockResolvedValue(newerEvt)

    await handleOwnReplaceableEvent(staleEvt, callbacks)

    expect(callbacks.setFollowListEvent).not.toHaveBeenCalled()
    expect(client.updateFollowListCache).not.toHaveBeenCalled()
  })

  it('synchronizes notificationsSeenAt when a newer NOTIFICATIONS_SEEN_AT event arrives', async () => {
    const seenEvt = {
      id: 'evt-seen',
      pubkey,
      kind: kinds.Application,
      created_at: 500,
      tags: [['d', ApplicationDataKey.NOTIFICATIONS_SEEN_AT]],
      content: '',
      sig: 'sig'
    } as Event

    await handleOwnReplaceableEvent(seenEvt, callbacks)

    expect(callbacks.setNotificationsSeenAt).toHaveBeenCalled()
    expect(storage.setLastReadNotificationTime).toHaveBeenCalledWith(pubkey, 500)
  })
})
