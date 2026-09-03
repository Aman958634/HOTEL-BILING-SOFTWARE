const snapshots = new Map();

export const readLastKnown = (key) => snapshots.get(key) || null;

export const writeLastKnown = (key, value) => {
  if (key) snapshots.set(key, { value, savedAt: Date.now() });
};

export const clearLastKnown = () => snapshots.clear();
