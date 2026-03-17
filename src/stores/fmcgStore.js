import { create } from 'zustand';

const LS_KEY = 'pulseiq-fmcg-state';

function loadFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToLS(forecastResults, inventoryResults) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ forecastResults, inventoryResults }));
  } catch {}
}

export const useFmcgStore = create((set, get) => {
  const saved = loadFromLS();
  return {
    // { allResults, skuList, horizon, selectedFileId, modelType }
    forecastResults: saved.forecastResults || null,
    // { bySku, byWarehouse, fileId }
    inventoryResults: saved.inventoryResults || null,

    setForecastResults: (data) => {
      set({ forecastResults: data });
      saveToLS(data, get().inventoryResults);
    },
    setInventoryResults: (data) => {
      set({ inventoryResults: data });
      saveToLS(get().forecastResults, data);
    },
    clearForecastResults: () => {
      set({ forecastResults: null });
      saveToLS(null, get().inventoryResults);
    },
  };
});
