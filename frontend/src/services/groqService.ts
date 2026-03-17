import type { CoinIdentification, ValueEstimate } from '../types/coin'

const BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''

interface GroqResponse<T> {
  success: boolean
  action: string
  result: T
  error?: string
}

async function groqFetch<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}/api/groq`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `AI API ${res.status}`)
  }
  const data: GroqResponse<T> = await res.json()
  if (!data.success) throw new Error('AI odpověď neúspěšná')
  return data.result
}

export async function identifyCoin(imageBase64: string): Promise<CoinIdentification> {
  return groqFetch<CoinIdentification>({ action: 'identify', image: imageBase64 })
}

export async function describeCoin(coin: Record<string, unknown>): Promise<string> {
  return groqFetch<string>({ action: 'describe', coin })
}

export async function estimateValue(coin: Record<string, unknown>): Promise<ValueEstimate> {
  return groqFetch<ValueEstimate>({ action: 'value', coin })
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
