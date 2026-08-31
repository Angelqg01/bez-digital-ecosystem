import { Router } from 'express';
import { requireAuth, requireScope } from './auth.js';

const router = Router();

/** POST /api/vision/analyze — Run Gemini Vision analysis */
router.post('/analyze', requireScope('vision:analyze'), async (req, res) => {
  const { image, mode = 'quality', sector = 'Logistics' } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Base64 image data required' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const aegisUrl = process.env.AEGIS_BASE_URL;

  // Prefer Aegis proxy (rate limiting, caching, audit trail)
  if (aegisUrl) {
    try {
      const response = await fetch(`${aegisUrl}/vision/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${geminiKey}` },
        body: JSON.stringify({ image, mode, sector }),
      });
      const data = await response.json();
      return res.json(data);
    } catch (error) {
      console.error('[VISION] Aegis proxy failed, using direct:', error.message);
    }
  }

  // Direct Gemini call (fallback)
  if (geminiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-vision:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: buildVisionPrompt(mode, sector) },
                { inlineData: { mimeType: 'image/jpeg', data: image } },
              ],
            }],
          }),
        }
      );
      const data = await response.json();
      const parsed = parseGeminiResponse(data, mode);
      return res.json(parsed);
    } catch (error) {
      console.error('[VISION] Gemini direct call failed:', error.message);
    }
  }

  // Mock response for development
  res.json({
    verdict: 'APPROVED',
    confidence: 0.978,
    mode,
    sector,
    metrics: {
      surfaceIntegrity: 0.98,
      dimensionalAccuracy: 0.95,
      labelCompliance: 1.0,
      packagingQuality: 0.97,
    },
    analysis: `Asset passed ${mode} analysis for ${sector} sector. No defects detected.`,
    source: 'mock',
    timestamp: new Date().toISOString(),
  });
});

/** POST /api/vision/fingerprint — Generate SIFT fingerprint */
router.post('/fingerprint', requireScope('vision:analyze'), async (req, res) => {
  const { image, goldenImageHash } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Base64 image data required' });
  }

  // In production: call Python SIFT service
  const aegisUrl = process.env.AEGIS_BASE_URL;
  if (aegisUrl) {
    try {
      const response = await fetch(`${aegisUrl}/vision/sift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, goldenImageHash }),
      });
      return res.json(await response.json());
    } catch (error) {
      console.error('[SIFT] Aegis call failed:', error.message);
    }
  }

  // Mock SIFT response
  const hash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  res.json({
    hash,
    keypoints: 128,
    descriptorDim: 64,
    goldenMatch: goldenImageHash ? 0.942 : null,
    isMatch: goldenImageHash ? true : null,
    timestamp: new Date().toISOString(),
  });
});

/** GET /api/vision/history — Scan history */
router.get('/history', requireScope('vision:read'), (req, res) => {
  const { page = 1, limit = 20, verdict } = req.query;
  // In production: query from database
  res.json({
    scans: [],
    total: 0,
    page: parseInt(page),
    limit: parseInt(limit),
    message: 'Connect database for persistent scan history',
  });
});

function buildVisionPrompt(mode, sector) {
  const prompts = {
    quality: `Analyze this ${sector} asset image for quality control. Check for defects, damage, compliance with industry standards. Return JSON with: verdict (APPROVED/REJECTED), confidence (0-1), metrics object, and analysis text.`,
    volume: `Estimate the 3D dimensions and volume of the object in this image for ${sector} logistics. Return JSON with: dimensions (width, height, depth in cm), estimatedVolume (cm³), and confidence.`,
    security: `Check this ${sector} product image for signs of counterfeiting or tampering. Look for security features, holograms, seals, serial numbers. Return JSON with: verdict, confidence, and findings array.`,
    authenticity: `Verify the authenticity and brand origin of this ${sector} product. Check labels, materials, craftsmanship indicators. Return JSON with: verdict, confidence, brandMatch score, and analysis.`,
  };
  return prompts[mode] || prompts.quality;
}

function parseGeminiResponse(data, mode) {
  try {
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return { ...JSON.parse(jsonMatch[0]), source: 'gemini', mode };
    }
    return { verdict: 'REVIEW_NEEDED', confidence: 0, analysis: text, source: 'gemini', mode };
  } catch {
    return { verdict: 'REVIEW_NEEDED', confidence: 0, error: 'Failed to parse Gemini response', source: 'gemini', mode };
  }
}

export { router as visionRouter };
