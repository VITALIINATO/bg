// Safe Storage Utility to bypass iframe/sandbox browser restrictions
// Fallbacks to in-memory storage if localStorage or sessionStorage are blocked

const memoryStorage: Record<string, string> = {};

export const safeSessionStorage = {
  getItem(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      return memoryStorage[key] || null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      memoryStorage[key] = value;
    }
  },
  removeItem(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      delete memoryStorage[key];
    }
  }
};

export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return memoryStorage[key] || null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      memoryStorage[key] = value;
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      delete memoryStorage[key];
    }
  }
};
