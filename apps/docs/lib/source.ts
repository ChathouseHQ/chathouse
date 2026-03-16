import { loader } from 'fumadocs-core/source'
import { docs } from 'fumadocs-mdx:collections/server'
import { createElement } from 'react'

import { Icon } from '@/components/Icon'

const SLUG_MAP: Record<string, string[]> = {
  introduction: [],
}

export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
  icon(iconString) {
    if (iconString) {
      return createElement(Icon, { name: iconString })
    }
    return undefined
  },
  slugs(file) {
    const p = file.path.replace(/\.(mdx|md)$/, '').replace(/\/index$/, '')

    if (p in SLUG_MAP) return SLUG_MAP[p]

    return undefined
  },
})
