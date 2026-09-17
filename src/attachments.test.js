import { describe, expect, it } from 'vitest'
import { attachmentKind, formatBytes, formatDuration } from './attachments'
import { extensionFor, pickMimeType } from './recorder'

describe('attachmentKind', () => {
  it('reads the kind from the file itself', () => {
    expect(attachmentKind({ type: 'image/png' })).toBe('IMAGE')
    expect(attachmentKind({ type: 'video/mp4' })).toBe('VIDEO')
    expect(attachmentKind({ type: 'audio/mpeg' })).toBe('AUDIO')
    expect(attachmentKind({ type: 'application/pdf' })).toBe('FILE')
    expect(attachmentKind({})).toBe('FILE')
  })

  it('keeps a recording’s own meaning', () => {
    // A voice note is audio, but so is a song someone attached; only the recorder knows which.
    expect(attachmentKind({ type: 'audio/webm' }, { recorded: 'VOICE' })).toBe('VOICE')
    expect(attachmentKind({ type: 'video/webm' }, { recorded: 'VIDEO_NOTE' })).toBe('VIDEO_NOTE')
  })
})

describe('formatBytes', () => {
  it('reads the way a file size is written', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(1_500_000)).toBe('1.4 MB')
    expect(formatBytes(0)).toBe('0 B')
  })
})

describe('formatDuration', () => {
  it('reads as minutes and seconds', () => {
    expect(formatDuration(7000)).toBe('0:07')
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(0)).toBe('0:00')
  })
})

describe('recording containers', () => {
  it('picks the first one this browser admits to', () => {
    expect(pickMimeType(false, (type) => type === 'audio/mp4')).toBe('audio/mp4')
    expect(pickMimeType(true, (type) => type.startsWith('video/webm'))).toBe('video/webm;codecs=vp9,opus')
  })

  it('lets the browser choose when it supports none of them', () => {
    expect(pickMimeType(false, () => false)).toBe('')
  })

  it('names the file after the container', () => {
    expect(extensionFor('audio/mp4')).toBe('mp4')
    expect(extensionFor('video/webm;codecs=vp8')).toBe('webm')
  })
})
