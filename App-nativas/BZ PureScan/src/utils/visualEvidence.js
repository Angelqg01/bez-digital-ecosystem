const ANALYSIS_SIZE = 128

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value))

const loadBitmap = async (blob) => {
  if ('createImageBitmap' in window) {
    return createImageBitmap(blob)
  }

  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(blob)

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen capturada.'))
    }
    image.src = url
  })
}

const drawToAnalysisCanvas = async (blob) => {
  const bitmap = await loadBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = ANALYSIS_SIZE
  canvas.height = ANALYSIS_SIZE

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE)

  if ('close' in bitmap) bitmap.close()

  return ctx.getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE)
}

const averageColor = (data) => {
  let red = 0
  let green = 0
  let blue = 0
  const pixels = data.length / 4

  for (let i = 0; i < data.length; i += 4) {
    red += data[i]
    green += data[i + 1]
    blue += data[i + 2]
  }

  return {
    red: red / pixels,
    green: green / pixels,
    blue: blue / pixels,
  }
}

const estimateSharpness = (data, width = ANALYSIS_SIZE) => {
  let edgeEnergy = 0
  let samples = 0

  for (let i = 4; i < data.length - 4; i += 4) {
    const pixel = i / 4
    if (pixel % width === 0) continue

    const current = (data[i] + data[i + 1] + data[i + 2]) / 3
    const previous = (data[i - 4] + data[i - 3] + data[i - 2]) / 3
    edgeEnergy += Math.abs(current - previous)
    samples += 1
  }

  return clamp((edgeEnergy / Math.max(samples, 1)) * 2.4)
}

export const captureVideoFrame = async (video, quality = 0.92) => {
  if (!video?.videoWidth || !video?.videoHeight) {
    throw new Error('La camara todavia no esta lista.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error('No se pudo capturar la imagen.')),
      'image/jpeg',
      quality,
    )
  })

  return {
    blob,
    dataUrl: canvas.toDataURL('image/jpeg', quality),
    width: canvas.width,
    height: canvas.height,
    size: blob.size,
    capturedAt: new Date().toISOString(),
  }
}

export const fileToCapture = async (file) => {
  const bitmap = await loadBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0)
  if ('close' in bitmap) bitmap.close()

  return {
    blob: file,
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width: canvas.width,
    height: canvas.height,
    size: file.size,
    capturedAt: new Date().toISOString(),
    name: file.name,
  }
}

const seekVideo = (video, time) => new Promise((resolve, reject) => {
  const cleanup = () => {
    video.removeEventListener('seeked', onSeeked)
    video.removeEventListener('error', onError)
  }
  const onSeeked = () => {
    cleanup()
    resolve()
  }
  const onError = () => {
    cleanup()
    reject(new Error('No se pudo leer el fotograma del video.'))
  }

  video.addEventListener('seeked', onSeeked, { once: true })
  video.addEventListener('error', onError, { once: true })
  video.currentTime = time
})

const loadVideo = (file) => new Promise((resolve, reject) => {
  const video = document.createElement('video')
  const url = URL.createObjectURL(file)

  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true

  video.onloadedmetadata = () => {
    resolve({ video, url })
  }
  video.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error('No se pudo cargar el video.'))
  }
  video.src = url
})

export const videoFileToCaptures = async (file, quality = 0.9) => {
  const { video, url } = await loadVideo(file)

  try {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1
    const startTime = Math.min(0.35, Math.max(duration * 0.05, 0))
    const endTime = Math.max(startTime, duration - Math.min(0.35, duration * 0.05))

    await seekVideo(video, startTime)
    const before = await captureVideoFrame(video, quality)

    await seekVideo(video, endTime)
    const after = await captureVideoFrame(video, quality)

    const common = {
      sourceType: 'video',
      sourceName: file.name,
      sourceSize: file.size,
      duration: Number(duration.toFixed(2)),
    }

    return {
      before: {
        ...before,
        ...common,
        frameRole: 'video_start',
        frameTime: Number(startTime.toFixed(2)),
      },
      after: {
        ...after,
        ...common,
        frameRole: 'video_end',
        frameTime: Number(endTime.toFixed(2)),
      },
    }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

export const compareCaptures = async (beforeCapture, afterCapture) => {
  if (!beforeCapture?.blob || !afterCapture?.blob) {
    throw new Error('Se necesitan una captura antes y una captura despues.')
  }

  const [beforeImage, afterImage] = await Promise.all([
    drawToAnalysisCanvas(beforeCapture.blob),
    drawToAnalysisCanvas(afterCapture.blob),
  ])

  const beforeData = beforeImage.data
  const afterData = afterImage.data
  const beforeAverage = averageColor(beforeData)
  const afterAverage = averageColor(afterData)

  let changedPixels = 0
  let totalDelta = 0
  let luminanceDelta = 0

  for (let i = 0; i < beforeData.length; i += 4) {
    const deltaRed = Math.abs(beforeData[i] - afterData[i])
    const deltaGreen = Math.abs(beforeData[i + 1] - afterData[i + 1])
    const deltaBlue = Math.abs(beforeData[i + 2] - afterData[i + 2])
    const pixelDelta = (deltaRed + deltaGreen + deltaBlue) / 3

    const beforeLum = 0.2126 * beforeData[i] + 0.7152 * beforeData[i + 1] + 0.0722 * beforeData[i + 2]
    const afterLum = 0.2126 * afterData[i] + 0.7152 * afterData[i + 1] + 0.0722 * afterData[i + 2]

    if (pixelDelta > 28) changedPixels += 1
    totalDelta += pixelDelta
    luminanceDelta += Math.abs(beforeLum - afterLum)
  }

  const pixels = beforeData.length / 4
  const changedRatio = changedPixels / pixels
  const averageDelta = totalDelta / pixels
  const averageLuminanceDelta = luminanceDelta / pixels
  const colorShift = Math.sqrt(
    Math.pow(afterAverage.red - beforeAverage.red, 2) +
    Math.pow(afterAverage.green - beforeAverage.green, 2) +
    Math.pow(afterAverage.blue - beforeAverage.blue, 2),
  )

  const beforeSharpness = estimateSharpness(beforeData)
  const afterSharpness = estimateSharpness(afterData)
  const stability = clamp(100 - averageDelta * 1.65)
  const changeScore = clamp(changedRatio * 100)

  return {
    changedRatio: Number(changedRatio.toFixed(4)),
    changeScore: Number(changeScore.toFixed(1)),
    stabilityScore: Number(stability.toFixed(1)),
    averagePixelDelta: Number(averageDelta.toFixed(2)),
    luminanceDelta: Number(averageLuminanceDelta.toFixed(2)),
    colorShift: Number(colorShift.toFixed(2)),
    beforeSharpness: Number(beforeSharpness.toFixed(1)),
    afterSharpness: Number(afterSharpness.toFixed(1)),
    qualityGate: stability > 72 && afterSharpness > 18 ? 'PASS' : 'REVIEW',
    riskLevel: changedRatio > 0.35 || averageDelta > 34 ? 'HIGH' : changedRatio > 0.16 ? 'MEDIUM' : 'LOW',
  }
}

export const buildEvidencePayload = ({ objectType, before, after, comparison, edge }) => ({
  evidence_id: `EVD-${Date.now()}`,
  object_type: objectType,
  capture_mode: before.sourceType === 'video' || after.sourceType === 'video' ? 'video_before_after' : 'before_after',
  captured_at: new Date().toISOString(),
  device: {
    user_agent: navigator.userAgent,
    platform: navigator.platform,
  },
  media: {
    before: {
      width: before.width,
      height: before.height,
      size: before.size,
      captured_at: before.capturedAt,
      source_type: before.sourceType || 'image',
      frame_time: before.frameTime ?? null,
      source_name: before.sourceName || before.name || null,
      duration: before.duration ?? null,
    },
    after: {
      width: after.width,
      height: after.height,
      size: after.size,
      captured_at: after.capturedAt,
      source_type: after.sourceType || 'image',
      frame_time: after.frameTime ?? null,
      source_name: after.sourceName || after.name || null,
      duration: after.duration ?? null,
    },
  },
  comparison,
  edge_summary: {
    scan_id: edge?.id,
    detections: edge?.detections?.length || 0,
    confidence: edge?.detections?.[0]?.confidence || null,
  },
})
