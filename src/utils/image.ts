export const IMAGE_ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const IMAGE_MAX_INPUT = 5 * 1024 * 1024

/** 校验图片文件，返回错误信息；通过则返回空串 */
export function checkImage(file: File) {
  if (!IMAGE_ACCEPT.includes(file.type)) return '仅支持 PNG / JPG / WebP / GIF'
  if (file.size > IMAGE_MAX_INPUT) return '图片不能超过 5MB'
  return ''
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality))

/** 缩放到最大 maxWidth 宽并压缩为 WebP（不支持则 JPEG），减少上传体积 */
export async function compressImage(file: File, maxWidth = 960) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff' // 透明 PNG 转 JPEG 时避免黑底
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const webp = await toBlob(canvas, 'image/webp', 0.82)
  const blob = webp?.type === 'image/webp' ? webp : await toBlob(canvas, 'image/jpeg', 0.85)
  if (!blob) throw new Error('图片压缩失败')
  return { blob, name: blob.type === 'image/webp' ? 'image.webp' : 'image.jpg' }
}
