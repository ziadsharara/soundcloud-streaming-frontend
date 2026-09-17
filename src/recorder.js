/**
 * Recording a voice note or a video note in the browser.
 *
 * MediaRecorder's container support differs by browser — Chrome and Firefox record WebM, Safari
 * records MP4 — so the type is chosen from what this browser admits to supporting rather than
 * assumed, and the recording is handed back as an ordinary file to upload.
 */
const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
const VIDEO_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']

export const recordingSupported = () =>
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia)

/** The first container this browser says it can record, or nothing to let it choose. */
export function pickMimeType(video, isSupported = (type) => window.MediaRecorder?.isTypeSupported?.(type)) {
  return (video ? VIDEO_TYPES : AUDIO_TYPES).find((type) => isSupported(type)) || ''
}

export const extensionFor = (mimeType) => (String(mimeType).includes('mp4') ? 'mp4' : 'webm')

/**
 * Starts recording and returns the handle to finish it.
 *
 * `stop()` resolves with the file and how long it ran; `cancel()` throws the recording away.
 * Either way the microphone or camera is released — a light left on is worse than a lost clip.
 */
export async function startRecording({ video = false } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia(
    video ? { audio: true, video: { facingMode: 'user', width: 480, height: 480 } } : { audio: true },
  )
  /*
   * Deliberately modest bitrates. A note is speech, not a master: at the browser's defaults a
   * half-minute video note is several megabytes to push up a slow link before anyone can hear it.
   */
  const recorder = new MediaRecorder(stream, {
    ...(pickMimeType(video) ? { mimeType: pickMimeType(video) } : {}),
    audioBitsPerSecond: 48_000,
    ...(video ? { videoBitsPerSecond: 700_000 } : {}),
  })
  const mimeType = recorder.mimeType
  const chunks = []
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data)
  }
  const startedAt = Date.now()
  recorder.start()

  const release = () => stream.getTracks().forEach((track) => track.stop())

  return {
    stream,
    startedAt,
    cancel() {
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } finally {
        release()
      }
    },
    stop() {
      return new Promise((resolve, reject) => {
        recorder.onerror = (event) => {
          release()
          reject(event.error || new Error('The recording failed.'))
        }
        recorder.onstop = () => {
          release()
          const type = recorder.mimeType || mimeType || (video ? 'video/webm' : 'audio/webm')
          const name = `${video ? 'Video note' : 'Voice note'}.${extensionFor(type)}`
          const blob = new Blob(chunks, { type })
          resolve({ file: new File([blob], name, { type }), durationMs: Date.now() - startedAt })
        }
        if (recorder.state === 'inactive') recorder.onstop()
        else recorder.stop()
      })
    },
  }
}
