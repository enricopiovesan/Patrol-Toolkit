import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { readResortWorkspace } from './resort-workspace.js';
import { buildOpenTopographyGlobalDemUrl, resolveContourProviderConfig, syncResortContours } from './resort-sync-contours.js';

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
      schemaVersion: '2.1.0',
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

describe('resort-sync-contours', () => {
  it('builds OpenTopography DEM URL', () => {
    const url = buildOpenTopographyGlobalDemUrl({
      baseUrl: 'https://portal.opentopography.org/API/globaldem',
      apiKey: 'abc',
      dataset: 'COP30',
      minLon: -117.1,
      minLat: 51.2,
      maxLon: -117.0,
      maxLat: 51.3
    });
    expect(url).toContain('demtype=COP30');
    expect(url).toContain('south=51.2');
    expect(url).toContain('API_Key=abc');
  });

  it('requires an OpenTopography API key', () => {
    expect(() => resolveContourProviderConfig({})).toThrow(/PTK_OPENTOPO_API_KEY/);
  });

  it('downloads DEM, runs gdal_contour, and imports contours', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sync-contours-'));
    try {
      const workspacePath = await writeWorkspace(root);
      const fetchFn = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }));
      const execFileFn = vi.fn().mockImplementation(async (_bin: string, args: string[]) => {
        const outputPath = args[args.length - 1];
        if (!outputPath) throw new Error('missing output');
        await writeFile(
          outputPath,
          JSON.stringify({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { ele: 2400 },
                geometry: { type: 'LineString', coordinates: [[-117.05, 51.24], [-117.04, 51.25]] }
              }
            ]
          }),
          'utf8'
        );
      });
      const result = await syncResortContours(
        { workspacePath, contourIntervalMeters: 20, bufferMeters: 1000, updatedAt: '2026-03-01T00:00:00.000Z' },
        {
          fetchFn: fetchFn as unknown as typeof fetch,
          execFileFn,
          env: { PTK_OPENTOPO_API_KEY: 'abc123' }
        }
      );
      expect(result.importedFeatureCount).toBe(1);
      expect(result.provider).toBe('opentopography');
      expect(result.contourIntervalMeters).toBe(20);
      expect(execFileFn).toHaveBeenCalled();
      const workspace = await readResortWorkspace(workspacePath);
      expect(workspace.layers.contours?.status).toBe('complete');
      expect(workspace.layers.contours?.featureCount).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
