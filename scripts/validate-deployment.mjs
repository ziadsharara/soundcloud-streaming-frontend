import { loadEnv } from 'vite'

const productionEnv = loadEnv('production', process.cwd(), '')
const apiBase = (process.env.VITE_API_BASE_URL || productionEnv.VITE_API_BASE_URL)?.trim()

if (process.env.VERCEL && (!apiBase || !/^https:\/\/[^/]+(?:\/.*)?$/.test(apiBase))) {
  console.error([
    'SoundStream deployment is missing VITE_API_BASE_URL.',
    'Set it in Vercel to the public HTTPS backend URL including /api, then redeploy.',
    'Example: https://api.example.com/api',
  ].join('\n'))
  process.exit(1)
}
