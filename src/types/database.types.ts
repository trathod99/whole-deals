export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type PreferenceType = 'include' | 'exclude'

export interface Database {
  public: {
    Tables: {
      user_preferences: {
        Row: {
          id: string
          user_id: string
          preference_text: string
          preference_type: PreferenceType
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          preference_text: string
          preference_type?: PreferenceType
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          preference_text?: string
          preference_type?: PreferenceType
          created_at?: string
          updated_at?: string
        }
      }
      scrape_history: {
        Row: {
          id: string
          scraped_at: string
          successful: boolean
          error_message: string | null
          data: Json
        }
        Insert: {
          id?: string
          scraped_at?: string
          successful: boolean
          error_message?: string | null
          data: Json
        }
        Update: {
          id?: string
          scraped_at?: string
          successful?: boolean
          error_message?: string | null
          data?: Json
        }
      }
      matched_deals: {
        Row: {
          id: string
          scrape_id: string
          user_id: string
          product_name: string
          product_description: string
          sale_price: number
          regular_price: number
          discount_percentage: number
          category: string
          image_url: string
          product_url: string
          confidence_score: number
          matching_explanation: string
          created_at: string
        }
        Insert: {
          id?: string
          scrape_id: string
          user_id: string
          product_name: string
          product_description: string
          sale_price: number
          regular_price: number
          discount_percentage: number
          category: string
          image_url: string
          product_url: string
          confidence_score: number
          matching_explanation: string
          created_at?: string
        }
        Update: {
          id?: string
          scrape_id?: string
          user_id?: string
          product_name?: string
          product_description?: string
          sale_price?: number
          regular_price?: number
          discount_percentage?: number
          category?: string
          image_url?: string
          product_url?: string
          confidence_score?: number
          matching_explanation?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 