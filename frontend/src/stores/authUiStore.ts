import { create } from 'zustand'

/** Временная модель сессии для вёрстки; позже заменить на реальный JWT / Supabase */
type AuthUiState = {
  isLoggedIn: boolean
  setLoggedIn: (value: boolean) => void
  toggleLoggedIn: () => void
}

export const useAuthUiStore = create<AuthUiState>((set) => ({
  isLoggedIn: false,
  setLoggedIn: (value) => set({ isLoggedIn: value }),
  toggleLoggedIn: () => set((s) => ({ isLoggedIn: !s.isLoggedIn })),
}))
