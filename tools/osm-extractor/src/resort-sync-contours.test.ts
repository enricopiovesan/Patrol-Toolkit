import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

  it('defaults contour smoothing mode to super-hard', () => {
    expect(resolveContourProviderConfig({ PTK_OPENTOPO_API_KEY: 'abc' }).contourSmoothingMode).toBe('super-hard');
  });

  it('downloads DEM, runs gdal_contour, and imports contours', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sync-contours-'));
    try {
      const workspacePath = await writeWorkspace(root);
      const fetchFn = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }));
      const execFileFn = vi.fn().mockImplementation(async (_bin: string, args: string[]) => {
        const outputPath = args[args.length - 1];
        if (!outputPath) throw new Error('missing output');
        const isPolygon = args.includes('-p');
        await writeFile(
          outputPath,
          JSON.stringify({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: isPolygon ? { eleMin: 2400, eleMax: 2420 } : { ele: 2400 },
                geometry: isPolygon
                  ? { type: 'Polygon', coordinates: [[[-117.05, 51.24], [-117.04, 51.24], [-117.04, 51.25], [-117.05, 51.24]]] }
                  : {
                      type: 'LineString',
                      coordinates: [[-117.05, 51.24], [-117.045, 51.245], [-117.04, 51.25], [-117.035, 51.252]]
                    }
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
      expect(result.importedTerrainBandCount).toBe(1);
      expect(result.provider).toBe('opentopography');
      expect(result.contourIntervalMeters).toBe(20);
      expect(execFileFn).toHaveBeenCalled();
      const workspace = await readResortWorkspace(workspacePath);
      expect(workspace.layers.contours?.status).toBe('complete');
      expect(workspace.layers.contours?.featureCount).toBe(1);
      expect(workspace.layers.terrainBands?.status).toBe('complete');
      expect(workspace.layers.terrainBands?.featureCount).toBe(1);
      const contoursRaw = await readFile(join(root, 'contours.geojson'), 'utf8');
      const contours = JSON.parse(contoursRaw) as { features: Array<{ geometry: { coordinates: unknown[] } }> };
      expect(contours.features[0]?.geometry.coordinates.length).toBeGreaterThan(4);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('supports disabling contour smoothing via env', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sync-contours-no-smooth-'));
    try {
      const workspacePath = await writeWorkspace(root);
      const fetchFn = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }));
      const execFileFn = vi.fn().mockImplementation(async (_bin: string, args: string[]) => {
        const outputPath = args[args.length - 1];
        if (!outputPath) throw new Error('missing output');
        const isPolygon = args.includes('-p');
        await writeFile(
          outputPath,
          JSON.stringify({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: isPolygon ? { eleMin: 2400, eleMax: 2420 } : { ele: 2400 },
                geometry: isPolygon
                  ? { type: 'Polygon', coordinates: [[[-117.05, 51.24], [-117.04, 51.24], [-117.04, 51.25], [-117.05, 51.24]]] }
                  : {
                      type: 'LineString',
                      coordinates: [[-117.05, 51.24], [-117.045, 51.245], [-117.04, 51.25], [-117.035, 51.252]]
                    }
              }
            ]
          }),
          'utf8'
        );
      });
      await syncResortContours(
        { workspacePath, contourIntervalMeters: 20, bufferMeters: 1000, updatedAt: '2026-03-01T00:00:00.000Z' },
        {
          fetchFn: fetchFn as unknown as typeof fetch,
          execFileFn,
          env: { PTK_OPENTOPO_API_KEY: 'abc123', PTK_CONTOUR_SMOOTHING: 'off' }
        }
      );
      const contoursRaw = await readFile(join(root, 'contours.geojson'), 'utf8');
      const contours = JSON.parse(contoursRaw) as { features: Array<{ geometry: { coordinates: unknown[] } }> };
      expect(contours.features[0]?.geometry.coordinates.length).toBe(4);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('falls back to QGIS-bundled gdal_contour on macOS when gdal_contour is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sync-contours-qgis-'));
    try {
      const workspacePath = await writeWorkspace(root);
      const fetchFn = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }));
      let callIndex = 0;
      const execFileFn = vi.fn().mockImplementation(async (_bin: string, args: string[]) => {
        callIndex += 1;
        const isFirstAttemptForContour = callIndex === 1;
        const isFirstAttemptForTerrain = callIndex === 3;
        if (isFirstAttemptForContour || isFirstAttemptForTerrain) {
          throw Object.assign(new Error('spawn gdal_contour ENOENT'), { code: 'ENOENT' });
        }
        const outputPath = args[args.length - 1];
        if (!outputPath) throw new Error('missing output');
        const isPolygon = args.includes('-p');
        await writeFile(
          outputPath,
          JSON.stringify({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: isPolygon ? { eleMin: 2400, eleMax: 2420 } : { ele: 2400 },
                geometry: isPolygon
                  ? { type: 'Polygon', coordinates: [[[-117.05, 51.24], [-117.04, 51.24], [-117.04, 51.25], [-117.05, 51.24]]] }
                  : { type: 'LineString', coordinates: [[-117.05, 51.24], [-117.04, 51.25]] }
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
          env: { PTK_OPENTOPO_API_KEY: 'abc123' },
          resolveQgisGdalContourBinFn: async () => '/Applications/QGIS.app/Contents/MacOS/gdal_contour'
        }
      );

      expect(result.importedFeatureCount).toBe(1);
      expect(execFileFn).toHaveBeenCalledTimes(4);
      expect(execFileFn.mock.calls[0]?.[0]).toBe('gdal_contour');
      expect(execFileFn.mock.calls[1]?.[0]).toBe('/Applications/QGIS.app/Contents/MacOS/gdal_contour');
      expect(execFileFn.mock.calls[2]?.[0]).toBe('gdal_contour');
      expect(execFileFn.mock.calls[3]?.[0]).toBe('/Applications/QGIS.app/Contents/MacOS/gdal_contour');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
