import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Chybí jedna nebo obě proměnné prostředí: VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY. ' +
    'Zkopírujte .env.example do .env a doplňte hodnoty ze svého Supabase projektu.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
