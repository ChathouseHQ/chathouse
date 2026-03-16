import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { config } from 'dotenv'
import { defineConfig } from 'vite'

config({ path: '../../.env', quiet: true })

export default defineConfig({
  envDir: '../..',
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    alias: {
      '~': '/app',
    },
  },
})
