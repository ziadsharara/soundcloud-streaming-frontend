import { getRoomKey } from './api'

/**
 * Voice notes, video notes, and anything else people send to a room.
 *
 * The bytes live with the room on the server, not in this browser: that is what makes them
 * survive a reload, arrive for everyone else, and disappear when the room is closed. Here we
 * only upload them, and fetch them back as blob URLs — fetched rather than linked, because a
 * private room's files need its key on the request, and an <audio src> cannot send a header.
 */
const base = (import.meta.env.VITE_API_BASE_URL || '/api').trim().replace(/\/$/, '')

/**
 * Files go straight to the backend, not through the site's own /api path.
 *
 * In production that path is a rewrite on the hosting edge, which is fine for small JSON but a
 * poor road for a 20 MB video: the socket already knows the backend's real address, so uploads
 * and downloads use it directly. CORS is configured for exactly this.
 */
const fileBase = (() => {
  const configured = import.meta.env.VITE_UPLOAD_BASE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  const socket = import.meta.env.VITE_WS_URL?.trim()
  if (socket) return socket.replace(/^ws/, 'http').replace(/\/ws$/, '') + '/api'
  return base
})()

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

/** What the room should make of a file the moment it is chosen. */
export function attachmentKind(file, { recorded = '' } = {}) {
  if (recorded) return recorded
  const type = (file?.type || '').toLowerCase()
  if (type.startsWith('image/')) return 'IMAGE'
  if (type.startsWith('video/')) return 'VIDEO'
  if (type.startsWith('audio/')) return 'AUDIO'
  return 'FILE'
}

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let size = bytes / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size >= 10 || Number.isInteger(size) ? Math.round(size) : size.toFixed(1)} ${units[unit]}`
}

/** A voice note reads as 0:07, the way a message app shows one. */
export function formatDuration(ms = 0) {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  return `${minutes}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Sends one file to the room, reporting how far it has got.
 *
 * XHR rather than fetch, for the one thing fetch cannot do: tell you how much of the file has
 * gone. On a slow connection a voice note can take seconds to climb, and a bubble that sits there
 * saying nothing looks broken.
 */
export function uploadAttachment(roomId, file, { kind, memberId, durationMs = 0, onProgress } = {}) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return Promise.reject(new Error(`${file.name || 'That file'} is larger than 25 MB.`))
  }
  const body = new FormData()
  body.append('file', file, file.name || 'attachment')
  body.append('kind', kind || attachmentKind(file))
  if (memberId) body.append('memberId', memberId)
  if (durationMs) body.append('durationMs', String(Math.round(durationMs)))

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${fileBase}/rooms/${encodeURIComponent(roomId)}/attachments`)
    const key = getRoomKey(roomId)
    if (key) request.setRequestHeader('X-Room-Key', key)

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          onProgress?.(1)
          return resolve(JSON.parse(request.responseText).attachment)
        } catch {
          return reject(new Error('That file could not be sent.'))
        }
      }
      let detail = ''
      try {
        const problem = JSON.parse(request.responseText)
        detail = problem?.detail || problem?.message || ''
      } catch {
        detail = ''
      }
      reject(new Error(detail || 'That file could not be sent.'))
    }
    request.onerror = () => reject(new Error('That file could not be sent. Check your connection.'))
    request.onabort = () => reject(new Error('That file was not sent.'))
    request.send(body)
  })
}

/**
 * Shrinks a photo before it is sent.
 *
 * A picture straight off a phone is several megabytes of detail nobody will see in a chat bubble,
 * and on a slow connection that is the difference between a moment and a minute. Anything that is
 * not an ordinary photo — a video, a document, an image the browser cannot decode — is sent as it
 * is, untouched.
 */
export async function shrinkImage(file, { maxEdge = 1600, quality = 0.82, minBytes = 400 * 1024 } = {}) {
  const type = (file?.type || '').toLowerCase()
  if (!type.startsWith('image/') || type.includes('gif') || type.includes('svg') || file.size < minBytes) {
    return file
  }
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    // Keep the original whenever the smaller version isn't actually smaller.
    if (!blob || blob.size >= file.size) return file
    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/**
 * One blob URL per attachment, kept for as long as the page is open so scrolling back through
 * the chat does not download the same voice note again.
 */
const cache = new Map()

/**
 * Remembers a file this browser already has, under the id the room gave it.
 *
 * Without this the sender downloads back the very voice note they just uploaded, over the same
 * slow link, before they can hear it.
 */
export function seedAttachment(roomId, attachmentId, file) {
  if (!attachmentId || !file) return ''
  const url = URL.createObjectURL(file)
  cache.set(`${roomId}:${attachmentId}`, Promise.resolve(url))
  return url
}

export function attachmentUrl(roomId, attachment) {
  if (!attachment?.id) return Promise.resolve('')
  const cacheKey = `${roomId}:${attachment.id}`
  if (!cache.has(cacheKey)) {
    const key = getRoomKey(roomId)
    const pending = fetch(`${fileBase}/rooms/${encodeURIComponent(roomId)}/attachments/${attachment.id}`, {
      headers: key ? { 'X-Room-Key': key } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('gone')
        return res.blob()
      })
      .then((blob) => URL.createObjectURL(blob))
      .catch(() => {
        // A file the room no longer has: forget the failure so a later try can succeed.
        cache.delete(cacheKey)
        return ''
      })
    cache.set(cacheKey, pending)
  }
  return cache.get(cacheKey)
}

/** Lets go of every blob this page was holding; called when a room view closes. */
export function releaseAttachments() {
  cache.forEach((pending) => pending.then?.((url) => url && URL.revokeObjectURL(url)).catch?.(() => {}))
  cache.clear()
}
