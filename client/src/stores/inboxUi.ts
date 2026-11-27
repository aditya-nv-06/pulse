import { create } from "zustand"

type InboxUiState = {
  expandedItemId: string | null
  setExpandedItemId: (id: string | null) => void
}

export const useInboxUiStore = create<InboxUiState>((set) => ({
  expandedItemId: null,
  setExpandedItemId: (expandedItemId) => set({ expandedItemId }),
}))
