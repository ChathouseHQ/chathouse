import { existsSync } from 'fs'
import * as path from 'path'

function resolveUploadDir(): string {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR

  let dir = process.cwd()
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, 'turbo.json'))) {
      return path.join(dir, 'data', 'uploads')
    }
    dir = path.dirname(dir)
  }

  return path.join(process.cwd(), 'data', 'uploads')
}

export const UPLOAD_DIR = resolveUploadDir()
