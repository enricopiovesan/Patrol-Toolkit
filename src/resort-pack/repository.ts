import type { ResortPack } from "./types";

const DB_NAME = "patrol-toolkit";
const DB_VERSION = 1;
const PACKS_STORE = "resort-packs";
const SETTINGS_STORE = "settings";
const ACTIVE_PACK_KEY = "active-pack-id";

export type ResortPackListItem = {
  id: string;
  name: string;
  updatedAt: string;
};

type StoredResortPack = {
  id: string;
  name: string;
  updatedAt: string;
  pack: ResortPack;
};

export class ResortPackRepository {
  private readonly database: IDBDatabase;

  private constructor(database: IDBDatabase) {
    this.database = database;
  }

  static async open(options?: { dbName?: string }): Promise<ResortPackRepository> {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB unavailable in this environment.");
    }

    const database = await openDatabase(options?.dbName ?? DB_NAME);
    return new ResortPackRepository(database);
  }

  close(): void {
    this.database.close();
  }

  async savePack(pack: ResortPack): Promise<void> {
    const record: StoredResortPack = {
      id: pack.resort.id,
      name: pack.resort.name,
      updatedAt: new Date().toISOString(),
      pack
    };

    const transaction = this.database.transaction([PACKS_STORE], "readwrite");
    await requestAsPromise(transaction.objectStore(PACKS_STORE).put(record));
    await transactionAsPromise(transaction);
  }

  async listPacks(): Promise<ResortPackListItem[]> {
    const transaction = this.database.transaction([PACKS_STORE], "readonly");
    const records = (await requestAsPromise(
      transaction.objectStore(PACKS_STORE).getAll()
    )) as StoredResortPack[];

    await transactionAsPromise(transaction);

    return records
      .map((record) => ({
        id: record.id,
        name: record.name,
        updatedAt: record.updatedAt
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async getPack(packId: string): Promise<ResortPack | null> {
    const transaction = this.database.transaction([PACKS_STORE], "readonly");
    const record = (await requestAsPromise(
      transaction.objectStore(PACKS_STORE).get(packId)
    )) as StoredResortPack | undefined;

    await transactionAsPromise(transaction);
    return record?.pack ?? null;
  }

  async deletePack(packId: string): Promise<void> {
    const transaction = this.database.transaction([PACKS_STORE, SETTINGS_STORE], "readwrite");
    transaction.objectStore(PACKS_STORE).delete(packId);

    const activePackId = (await requestAsPromise(
      transaction.objectStore(SETTINGS_STORE).get(ACTIVE_PACK_KEY)
    )) as string | undefined;

    if (activePackId === packId) {
      transaction.objectStore(SETTINGS_STORE).delete(ACTIVE_PACK_KEY);
    }

    await transactionAsPromise(transaction);
  }

  async setActivePackId(packId: string | null): Promise<boolean> {
    const transaction = this.database.transaction([PACKS_STORE, SETTINGS_STORE], "readwrite");
    if (!packId) {
      transaction.objectStore(SETTINGS_STORE).delete(ACTIVE_PACK_KEY);
      await transactionAsPromise(transaction);
      return true;
    }

    const storedPack = (await requestAsPromise(
      transaction.objectStore(PACKS_STORE).get(packId)
    )) as StoredResortPack | undefined;

    if (!storedPack) {
      await transactionAsPromise(transaction);
      return false;
    }

    transaction.objectStore(SETTINGS_STORE).put(packId, ACTIVE_PACK_KEY);
    await transactionAsPromise(transaction);
    return true;
  }

  async getActivePackId(): Promise<string | null> {
    const transaction = this.database.transaction([SETTINGS_STORE], "readonly");
    const value = (await requestAsPromise(
      transaction.objectStore(SETTINGS_STORE).get(ACTIVE_PACK_KEY)
    )) as string | undefined;

    await transactionAsPromise(transaction);
    return value ?? null;
  }

  async getActivePack(): Promise<ResortPack | null> {
    const activePackId = await this.getActivePackId();
    if (!activePackId) {
      return null;
    }

    return this.getPack(activePackId);
  }
}

function openDatabase(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(PACKS_STORE)) {
        database.createObjectStore(PACKS_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Unable to open IndexedDB."));
    };
  });
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed."));
    };
  });
}

function transactionAsPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}
