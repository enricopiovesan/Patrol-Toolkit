import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import validPack from "./fixtures/valid-pack.json";
import { ResortPackRepository } from "./repository";
import type { ResortPack } from "./types";

describe("ResortPackRepository", () => {
  it("saves and lists packs", async () => {
    const dbName = createTestDbName();
    const repository = await ResortPackRepository.open({ dbName });
    const pack = structuredClone(validPack) as ResortPack;

    await repository.savePack(pack);

    const packs = await repository.listPacks();
    expect(packs).toHaveLength(1);
    expect(packs[0]?.id).toBe(pack.resort.id);
    expect(packs[0]?.name).toBe(pack.resort.name);

    repository.close();
    await deleteDatabase(dbName);
  });

  it("persists active pack id across repository reopen", async () => {
    const dbName = createTestDbName();
    const firstSession = await ResortPackRepository.open({ dbName });
    const pack = structuredClone(validPack) as ResortPack;
    await firstSession.savePack(pack);
    await expect(firstSession.setActivePackId(pack.resort.id)).resolves.toBe(true);
    firstSession.close();

    const secondSession = await ResortPackRepository.open({ dbName });
    const activePack = await secondSession.getActivePack();

    expect(activePack?.resort.id).toBe(pack.resort.id);

    secondSession.close();
    await deleteDatabase(dbName);
  });

  it("clears active pack when that pack is deleted", async () => {
    const dbName = createTestDbName();
    const repository = await ResortPackRepository.open({ dbName });
    const pack = structuredClone(validPack) as ResortPack;
    await repository.savePack(pack);
    await expect(repository.setActivePackId(pack.resort.id)).resolves.toBe(true);

    await repository.deletePack(pack.resort.id);

    const activePackId = await repository.getActivePackId();
    const remainingPacks = await repository.listPacks();

    expect(activePackId).toBeNull();
    expect(remainingPacks).toHaveLength(0);

    repository.close();
    await deleteDatabase(dbName);
  });

  it("refuses to set active pack for unknown ids", async () => {
    const dbName = createTestDbName();
    const repository = await ResortPackRepository.open({ dbName });

    await expect(repository.setActivePackId("missing-pack")).resolves.toBe(false);
    await expect(repository.getActivePackId()).resolves.toBeNull();

    repository.close();
    await deleteDatabase(dbName);
  });
});

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to delete test database."));
    request.onblocked = () => reject(new Error("Database deletion blocked."));
  });
}

function createTestDbName(): string {
  return `patrol-toolkit-test-${crypto.randomUUID()}`;
}
