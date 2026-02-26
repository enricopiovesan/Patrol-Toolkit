import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildPeaksOverpassQuery, syncResortPeaks } from './resort-sync-peaks.js';
import { readResortWorkspace } from './resort-workspace.js';

async function writeWorkspace(root: string): Promise<string> {
  const workspacePath = join(root, 'resort.json');
  const boundaryPath = join(root, 'boundary.geojson');
  await writeFile(
    boundaryPath,
    JSON.stringify({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[-117.1, 51.2], [-117.0, 51.2], [-117.0, 51.3], [-117.1, 51.3], [-117.1, 51.2]]]
      }
    }),
    'utf8'
  );
  await writeFile(
    workspacePath,
    JSON.stringify({
      schemaVersion: '2.0.0',
      resort: { query: { name: 'Kicking Horse', country: 'CA' } },
      layers: {
        boundary: { status: 'complete', artifactPath: boundaryPath, featureCount: 1, checksumSha256: 'x', updatedAt: '2026-01-01T00:00:00.000Z' },
        lifts: { status: 'pending' },
        runs: { status: 'pending' }
      }
    }),
    'utf8'
  );
  return workspacePath;
}

describe('resort-sync-peaks', () => {
  it('builds an overpass query for natural peaks', () => {
    const query = buildPeaksOverpassQuery({ minLon: -117.1, minLat: 51.2, maxLon: -117.0, maxLat: 51.3, timeoutSeconds: 30 });
    expect(query).toContain('node["natural"="peak"]');
    expect(query).toContain('[timeout:30]');
    expect(query).toContain('out body;');
  });

  it('fetches peaks and updates workspace + output geojson', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sync-peaks-'));
    try {
      const workspacePath = await writeWorkspace(root);
      const fetchFn = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            elements: [
              { type: 'node', id: 1, lat: 51.25, lon: -117.05, tags: { natural: 'peak', name: 'Peak One', ele: '2500' } },
              { type: 'node', id: 2, lat: 51.255, lon: -117.045, tags: { natural: 'peak' } }
            ]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      const result = await syncResortPeaks({ workspacePath, updatedAt: '2026-03-01T00:00:00.000Z' }, { fetchFn: fetchFn as unknown as typeof fetch });
      expect(result.peakCount).toBe(2);
      const saved = JSON.parse(await readFile(result.outputPath, 'utf8')) as { features: Array<{ properties: { name: string; ele: number | null } }> };
      expect(saved.features[0]?.properties.name).toBe('Peak One');
      expect(saved.features[0]?.properties.ele).toBe(2500);
      expect(saved.features[1]?.properties.ele).toBeNull();
      const workspace = await readResortWorkspace(workspacePath);
      expect(workspace.layers.peaks?.status).toBe('complete');
      expect(workspace.layers.peaks?.featureCount).toBe(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
