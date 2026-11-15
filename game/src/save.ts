import { validateSave, type GameSave } from "./model";
export class SaveRepository {
  private db: Promise<IDBDatabase>;
  private queue: Promise<void> = Promise.resolve();
  constructor() {
    this.db = new Promise((resolve, reject) => {
      const r = indexedDB.open("togi-workshop-v2", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("state");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  private async read(key: string): Promise<unknown> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const r = db.transaction("state").objectStore("state").get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async load() {
    const value = await this.read("current");
    if (value === undefined) return null;
    if (!validateSave(value)) throw new Error("invalid-save");
    return value;
  }
  async recoverPrevious() {
    const value = await this.read("previous");
    return validateSave(value) ? value : null;
  }
  save(value: GameSave) {
    const snapshot = structuredClone(value);
    if (!validateSave(snapshot))
      return Promise.reject(new Error("invalid-save"));
    const work = this.queue
      .catch(() => {})
      .then(async () => {
        const db = await this.db;
        await new Promise<void>((resolve, reject) => {
          const t = db.transaction("state", "readwrite"),
            store = t.objectStore("state"),
            r = store.get("current");
          r.onsuccess = () => {
            if (validateSave(r.result)) store.put(r.result, "previous");
            store.put(snapshot, "current");
          };
          t.oncomplete = () => resolve();
          t.onerror = () => reject(t.error);
          t.onabort = () => reject(t.error);
        });
      });
    this.queue = work;
    return work;
  }
}
