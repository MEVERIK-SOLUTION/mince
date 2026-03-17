import type { VercelRequest, VercelResponse } from '@vercel/node'

// Groq AI proxy – coin identification, description, value estimation
// Model: meta-llama/llama-4-scout-17b-16e-instruct (vision + JSON mode)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
const MAX_BODY = 4 * 1024 * 1024 // 4 MB (base64 limit)

type Action = 'identify' | 'describe' | 'value'

const SYSTEM_IDENTIFY = `Jsi expert numismatik. Analyzuj fotografii mince a vrať JSON objekt s těmito poli (pokud je nelze určit, použij null):
{
  "name": "název mince",
  "country": "země původu",
  "year_minted": číslo nebo null,
  "denomination": číslo nebo null,
  "currency": "kód měny",
  "material": "materiál",
  "weight_grams": číslo nebo null,
  "diameter_mm": číslo nebo null,
  "coin_type": "oběžná|pamětní|investiční|antická|zkušební",
  "condition": "UNC|AU|XF|VF|F|VG|G|AG|PR",
  "rarity_level": číslo 1-10 nebo null,
  "series": "série/edice nebo null",
  "description": "stručný popis mince",
  "confidence": číslo 0-1
}
Odpovídej POUZE validním JSON bez dalšího textu.`

const SYSTEM_DESCRIBE = `Jsi expert numismatik píšící pro český sběratelský katalog. Na základě údajů o minci napiš odborný, ale čtivý popis v češtině (3-5 vět). Zaměř se na historický kontext, zajímavosti a sběratelskou hodnotu. Odpověz pouze textem popisu.`

const SYSTEM_VALUE = `Jsi expert na oceňování mincí. Na základě údajů o minci odhadni její tržní hodnotu a vrať JSON:
{
  "estimated_value_czk": číslo,
  "estimated_value_eur": číslo,
  "value_range_czk": { "min": číslo, "max": číslo },
  "confidence": číslo 0-1,
  "factors": ["faktor1", "faktor2"],
  "notes": "poznámky k ocenění"
}
Odpovídej POUZE validním JSON bez dalšího textu.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' })

  const contentLength = parseInt(req.headers['content-length'] ?? '0', 10)
  if (contentLength > MAX_BODY) {
    return res.status(413).json({ error: 'Obrázek je příliš velký (max 4 MB)' })
  }

  const { action, image, coin } = req.body as {
    action: Action
    image?: string   // base64 data URI for identify
    coin?: Record<string, unknown>  // coin data for describe/value
  }

  if (!action || !['identify', 'describe', 'value'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Use: identify, describe, value' })
  }

  try {
    let messages: Array<{ role: string; content: unknown }>
    let useJson = false

    if (action === 'identify') {
      if (!image) return res.status(400).json({ error: 'Image is required for identification' })
      useJson = true
      messages = [
        { role: 'system', content: SYSTEM_IDENTIFY },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Identifikuj tuto minci:' },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ]
    } else if (action === 'describe') {
      if (!coin) return res.status(400).json({ error: 'Coin data is required for description' })
      messages = [
        { role: 'system', content: SYSTEM_DESCRIBE },
        { role: 'user', content: `Napiš popis pro tuto minci:\n${JSON.stringify(coin, null, 2)}` },
      ]
    } else {
      // value
      if (!coin) return res.status(400).json({ error: 'Coin data is required for valuation' })
      useJson = true
      messages = [
        { role: 'system', content: SYSTEM_VALUE },
        { role: 'user', content: `Odhadni hodnotu této mince:\n${JSON.stringify(coin, null, 2)}` },
      ]
    }

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 1024,
        ...(useJson ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      console.error('Groq error:', groqRes.status, errText)
      return res.status(groqRes.status).json({
        error: `Groq API error: ${groqRes.status}`,
        detail: groqRes.status === 429 ? 'Rate limit exceeded. Zkuste to za chvíli.' : undefined,
      })
    }

    const data = await groqRes.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    if (useJson) {
      try {
        const parsed = JSON.parse(content)
        return res.status(200).json({ success: true, action, result: parsed })
      } catch {
        return res.status(200).json({ success: true, action, result: content })
      }
    }

    return res.status(200).json({ success: true, action, result: content })
  } catch (err) {
    console.error('Groq handler error:', err)
    return res.status(500).json({ error: 'AI service unavailable' })
  }
}
