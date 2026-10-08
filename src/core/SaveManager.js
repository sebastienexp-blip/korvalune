import { CONFIG } from './config.js';

// Sauvegarde locale (localStorage). Prête à être remplacée par un appel réseau
// vers une base serveur lors de l'ÉTAPE 6 (sécurité/persistance).
export const SaveManager = {
  load() {
    try {
      const raw = localStorage.getItem(CONFIG.saveKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  save(data) {
    try { localStorage.setItem(CONFIG.saveKey, JSON.stringify(data)); return true; }
    catch { return false; }
  },
  clear() { try { localStorage.removeItem(CONFIG.saveKey); } catch {} },
  loadSettings() {
    try { return JSON.parse(localStorage.getItem(CONFIG.settingsKey)) || {}; } catch { return {}; }
  },
  saveSettings(s) { try { localStorage.setItem(CONFIG.settingsKey, JSON.stringify(s)); } catch {} }
};
