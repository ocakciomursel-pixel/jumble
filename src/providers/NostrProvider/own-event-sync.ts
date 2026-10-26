import { ApplicationDataKey, ExtendedKind } from '@/constants'
import { getReplaceableEventIdentifier } from '@/lib/event'
import { getProfileFromEvent } from '@/lib/event-metadata'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import storage from '@/services/local-storage.service'
import { TProfile } from '@/types'
import { Event, kinds } from 'nostr-tools'

export type TOwnEventSyncCallbacks = {
  pubkey: string
  isAborted: () => boolean
  setProfileEvent: (event: Event) => void
  setProfile: (profile: TProfile) => void
  setFollowListEvent: (event: Event) => void
  setMuteListEvent: (event: Event) => void
  setBookmarkListEvent: (event: Event) => void
  setFavoriteRelaysEvent: (event: Event) => void
  setUserEmojiListEvent: (event: Event) => void
  setPinListEvent: (event: Event) => void
  setPinnedUsersEvent: (event: Event) => void
  setNotificationsSeenAt: (updater: (prev: number) => number) => void
}

export async function handleOwnReplaceableEvent(
  evt: Event,
  callbacks: TOwnEventSyncCallbacks
): Promise<void> {
  if (callbacks.isAborted() || evt.pubkey !== callbacks.pubkey) return

  if (evt.kind === kinds.Metadata) {
    const updated = await indexedDb.putReplaceableEvent(evt)
    if (updated.id === evt.id) {
      callbacks.setProfileEvent(updated)
      callbacks.setProfile(getProfileFromEvent(updated))
    }
  } else if (evt.kind === kinds.Contacts) {
    const updated = await indexedDb.putReplaceableEvent(evt)
    if (updated.id === evt.id) {
      callbacks.setFollowListEvent(updated)
      await client.updateFollowListCache(updated)
    }
  } else if (evt.kind === kinds.Mutelist) {
    const updated = await indexedDb.putReplaceableEvent(evt)
    if (updated.id === evt.id) {
      callbacks.setMuteListEvent(updated)
    }
  } else if (evt.kind === kinds.BookmarkList) {
    const updated = await indexedDb.putReplaceableEvent(evt)
    if (updated.id === evt.id) {
      callbacks.setBookmarkListEvent(updated)
    }
  } else if (evt.kind === ExtendedKind.FAVORITE_RELAYS) {
    const updated = await indexedDb.putReplaceableEvent(evt)
    if (updated.id === evt.id) {
      callbacks.setFavoriteRelaysEvent(updated)
    }
  } else if (evt.kind === ExtendedKind.BLOSSOM_SERVER_LIST) {
    await client.updateBlossomServerListEventCache(evt)
  } else if (evt.kind === kinds.UserEmojiList) {
    const updated = await indexedDb.putReplaceableEvent(evt)
    if (updated.id === evt.id) {
      callbacks.setUserEmojiListEvent(updated)
    }
  } else if (evt.kind === kinds.Pinlist) {
    const updated = await indexedDb.putReplaceableEvent(evt)
    if (updated.id === evt.id) {
      callbacks.setPinListEvent(updated)
    }
  } else if (evt.kind === ExtendedKind.PINNED_USERS) {
    const updated = await indexedDb.putReplaceableEvent(evt)
    if (updated.id === evt.id) {
      callbacks.setPinnedUsersEvent(updated)
    }
  } else if (
    evt.kind === kinds.Application &&
    getReplaceableEventIdentifier(evt) === ApplicationDataKey.NOTIFICATIONS_SEEN_AT
  ) {
    callbacks.setNotificationsSeenAt((prev) => {
      const next = Math.max(prev, evt.created_at)
      storage.setLastReadNotificationTime(callbacks.pubkey, next)
      return next
    })
  }
}
