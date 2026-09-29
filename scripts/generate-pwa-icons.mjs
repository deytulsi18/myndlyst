import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url))
const iconSource = path.join(publicDirectory, 'app-icon.svg')

await mkdir(publicDirectory, { recursive: true })

const icons = [
  ['pwa-icon-192.png', 192],
  ['pwa-icon-512.png', 512],
  ['pwa-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
]

await Promise.all(
  icons.map(([filename, size]) =>
    sharp(iconSource)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDirectory, filename)),
  ),
)