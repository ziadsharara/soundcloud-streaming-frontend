import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, webSocketUrl } from './api'

describe('API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } })
  })

  it('loads JSON from the configured API path', async () => {
    const rooms = [{ id: 'K7QH2M' }]
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(rooms), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.listRooms()).resolves.toEqual(rooms)
    expect(fetchMock).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({ method: 'GET' }))
  })

  it('explains a missing Vercel backend route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('NOT_FOUND', { status: 404, headers: { 'x-vercel-error': 'NOT_FOUND' } }),
      ),
    )

    await expect(api.listRooms()).rejects.toThrow('The backend API is not connected to this deployment.')
  })

  it('turns network failures into an actionable message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(api.listRooms()).rejects.toThrow('The backend API could not be reached')
  })

  it('derives a secure WebSocket URL from the page origin', () => {
    expect(webSocketUrl()).toBe('wss://app.example.com/ws')
  })
})
