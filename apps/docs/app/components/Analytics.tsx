'use client'

import { useEffect } from 'react'
import * as Swetrix from 'swetrix'

const SWETRIX_PID = 'nn8xyNcyPZ6o'

export default function Analytics() {
  useEffect(() => {
    Swetrix.init(SWETRIX_PID)
    Swetrix.trackViews()
  }, [])

  return null
}
