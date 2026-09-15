import { loadEnv } from 'vite'

const productionEnv = loadEnv('production', process.cwd(), '')
const apiBase = (process.env.VITE_API_BASE_URL || productionEnv.VITE_API_BASE_URL)?.trim()

const validApiBase = apiBase === '/api' || /^https:\/\/[^/]+(?:\/.*)?$/.test(apiBase || '')

if (process.env.VERCEL && !validApiBase) {
  console.error([
    'SoundStream deployment has an invalid VITE_API_BASE_URL.',
    'Set it to /api when Vercel proxies the backend, or to a public HTTPS backend URL including /api.',
    'Examples: /api or https://api.example.com/api',
  ].join('\n'))
  process.exit(1)
}
