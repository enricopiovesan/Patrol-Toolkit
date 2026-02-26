import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importResortContours } from './resort-import-contours.js';
import { readResortWorkspace } from './resort-workspace.js';

async function writeWorkspace(root: string): Promise<string> {
  const workspacePath = join(root, 'resort.json');
  await writeFile(
    workspacePath,
    JSON.stringify({
      schemaVersion: '2.0.0',
      resort: { query: { name: 'Kicking Horse', country: 'CA' } },
      layers: { boundary: { status: 'complete', artifactPath: join(root, 'boundary.geojson') }, lifts: { status: 'pending' }, runs: { status: 'pending' } }
    }),
    'utf8'
  );
  return workspacePath;
}

describe('importResortContours', () => {
  it('normalizes contour lines and updates workspace layer state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'import-contours-'));
    try {
      const workspacePath = await writeWorkspace(root);
      const inputPath = join(root, 'input-contours.geojson');
      await writeFile(
        inputPath,
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { id: 'c-1000', ele: 1000 },
              geometry: { type: 'LineString', coordinates: [[-117.1, 51.2], [-117.09, 51.21]] }
            },
            {
              type: 'Feature',
              properties: { contour: '1100m' },
              geometry: { type: 'MultiLineString', coordinates: [
                [[-117.08, 51.22], [-117.07, 51.23]],
                [[-117.06, 51.24], [-117.05, 51.25]]
              ] }
            }
          ]
        }),
        'utf8'
      );

      const result = await importResortContours({ workspacePath, inputPath, updatedAt: '2026-03-01T00:00:00.000Z' });
      expect(result.importedFeatureCount).toBe(3);
      const saved = JSON.parse(await readFile(result.outputPath, 'utf8')) as { features: Array<{ properties: { ele: number | null; id: string } }> };
      expect(saved.features).toHaveLength(3);
      expect(saved.features[0]?.properties.id).toBe('c-1000');
      expect(saved.features[1]?.properties.ele).toBe(1100);
      const workspace = await readResortWorkspace(workspacePath);
      expect(workspace.layers.contours?.status).toBe('complete');
      expect(workspace.layers.contours?.featureCount).toBe(3);
      expect(workspace.layers.contours?.artifactPath).toBe(result.outputPath);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
