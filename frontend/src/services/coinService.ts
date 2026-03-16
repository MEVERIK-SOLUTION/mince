import { supabase } from '../lib/supabase'
import type { Coin, CoinFormData, CoinSearchFilters, CoinStats, CoinImage } from '../types/coin'

// ─── COINS ────────────────────────────────────────────────────────────────────

export const coinService = {
  /** Vrátí seznam mincí s volitelným filtrováním */
  async getCoins(filters: CoinSearchFilters = {}): Promise<Coin[]> {
    let query = supabase
      .from('coins')
      .select(`
        *,
        images:coin_images(*)
      `)
      .order('created_at', { ascending: false })

    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,country.ilike.%${filters.search}%,series.ilike.%${filters.search}%`
      )
    }
    if (filters.country) query = query.eq('country', filters.country)
    if (filters.coin_type) query = query.eq('coin_type', filters.coin_type)
    if (filters.material) query = query.eq('material', filters.material)
    if (filters.year_from) query = query.gte('year_minted', filters.year_from)
    if (filters.year_to) query = query.lte('year_minted', filters.year_to)
    if (filters.rarity_min) query = query.gte('rarity_level', filters.rarity_min)
    if (filters.rarity_max) query = query.lte('rarity_level', filters.rarity_max)

    const { data, error } = await query

    if (error) throw error
    return (data ?? []) as Coin[]
  },

  /** Vrátí detail mince podle ID */
  async getCoin(id: string): Promise<Coin> {
    const { data, error } = await supabase
      .from('coins')
      .select(`
        *,
        images:coin_images(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Coin
  },

  /** Vytvoří novou minci */
  async createCoin(coinData: CoinFormData): Promise<Coin> {
    const { data, error } = await supabase
      .from('coins')
      .insert([coinData])
      .select()
      .single()

    if (error) throw error
    return data as Coin
  },

  /** Aktualizuje existující minci */
  async updateCoin(id: string, coinData: Partial<CoinFormData>): Promise<Coin> {
    const { data, error } = await supabase
      .from('coins')
      .update(coinData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Coin
  },

  /** Smaže minci */
  async deleteCoin(id: string): Promise<void> {
    const { error } = await supabase.from('coins').delete().eq('id', id)
    if (error) throw error
  },

  /** Vrátí souhrné statistiky sbírky */
  async getStats(): Promise<CoinStats> {
    const { data: coins, error } = await supabase
      .from('coins')
      .select('country, coin_type, current_value')

    if (error) throw error

    const byCountry = Object.entries(
      (coins ?? []).reduce<Record<string, number>>((acc, c) => {
        acc[c.country] = (acc[c.country] ?? 0) + 1
        return acc
      }, {})
    )
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)

    const byType = Object.entries(
      (coins ?? []).reduce<Record<string, number>>((acc, c) => {
        if (c.coin_type) acc[c.coin_type] = (acc[c.coin_type] ?? 0) + 1
        return acc
      }, {})
    )
      .map(([coin_type, count]) => ({ coin_type, count }))
      .sort((a, b) => b.count - a.count)

    const totalValue = (coins ?? []).reduce(
      (sum, c) => sum + (c.current_value ?? 0),
      0
    )

    return {
      total_coins: (coins ?? []).length,
      total_value: totalValue,
      by_country: byCountry,
      by_type: byType,
    }
  },

  /** Vrátí unikátní hodnoty pro filtry */
  async getFilterOptions() {
    const { data, error } = await supabase
      .from('coins')
      .select('country, coin_type, material, currency')

    if (error) throw error

    const coins = data ?? []
    return {
      countries: [...new Set(coins.map((c) => c.country))].filter(Boolean).sort(),
      coin_types: [...new Set(coins.map((c) => c.coin_type))].filter(Boolean).sort(),
      materials: [...new Set(coins.map((c) => c.material))].filter(Boolean).sort(),
      currencies: [...new Set(coins.map((c) => c.currency))].filter(Boolean).sort(),
    }
  },
}

// ─── IMAGES ───────────────────────────────────────────────────────────────────

export const imageService = {
  /** Nahraje obrázek do Supabase Storage a uloží záznam do DB */
  async uploadImage(
    coinId: string,
    file: File,
    imageType: CoinImage['image_type'] = 'obverse',
    isPrimary = false
  ): Promise<CoinImage> {
    const ext = file.name.split('.').pop()
    const path = `coins/${coinId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('coin-images')
      .upload(path, file, { upsert: false })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from('coin-images').getPublicUrl(path)

    const { data, error } = await supabase
      .from('coin_images')
      .insert([
        {
          coin_id: coinId,
          image_url: urlData.publicUrl,
          image_type: imageType,
          is_primary: isPrimary,
          order_index: 0,
        },
      ])
      .select()
      .single()

    if (error) throw error
    return data as CoinImage
  },

  /** Vrátí seznam obrázků pro danou minci */
  async getImages(coinId: string): Promise<CoinImage[]> {
    const { data, error } = await supabase
      .from('coin_images')
      .select('*')
      .eq('coin_id', coinId)
      .order('order_index')

    if (error) throw error
    return (data ?? []) as CoinImage[]
  },

  /** Smaže obrázek */
  async deleteImage(imageId: string, imageUrl: string): Promise<void> {
    // Extrahujeme cestu ze storage URL
    const url = new URL(imageUrl)
    const storagePath = url.pathname.split('/object/public/coin-images/')[1]

    if (storagePath) {
      await supabase.storage.from('coin-images').remove([storagePath])
    }

    const { error } = await supabase.from('coin_images').delete().eq('id', imageId)
    if (error) throw error
  },

  /** Nastaví obrázek jako primární */
  async setPrimary(coinId: string, imageId: string): Promise<void> {
    await supabase.from('coin_images').update({ is_primary: false }).eq('coin_id', coinId)
    const { error } = await supabase
      .from('coin_images')
      .update({ is_primary: true })
      .eq('id', imageId)
    if (error) throw error
  },
}

// ─── COLLECTIONS ──────────────────────────────────────────────────────────────

export const collectionService = {
  /** Vrátí všechny kolekce */
  async getCollections() {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },

  /** Vytvoří novou kolekci */
  async createCollection(name: string, description?: string) {
    const { data, error } = await supabase
      .from('collections')
      .insert([{ name, description, is_public: false }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  /** Přidá minci do kolekce */
  async addCoin(collectionId: string, coinId: string) {
    const { error } = await supabase
      .from('collection_coins')
      .insert([{ collection_id: collectionId, coin_id: coinId }])
    if (error) throw error
  },

  /** Odebere minci z kolekce */
  async removeCoin(collectionId: string, coinId: string) {
    const { error } = await supabase
      .from('collection_coins')
      .delete()
      .eq('collection_id', collectionId)
      .eq('coin_id', coinId)
    if (error) throw error
  },

  /** Vrátí mince v kolekci */
  async getCollectionCoins(collectionId: string): Promise<Coin[]> {
    const { data, error } = await supabase
      .from('collection_coins')
      .select(`coin:coins(*, images:coin_images(*))`)
      .eq('collection_id', collectionId)

    if (error) throw error
    return ((data ?? []).map((row: { coin: unknown }) => row.coin).filter(Boolean)) as Coin[]
  },

  /** Smaže kolekci */
  async deleteCollection(id: string) {
    const { error } = await supabase.from('collections').delete().eq('id', id)
    if (error) throw error
  },
}
