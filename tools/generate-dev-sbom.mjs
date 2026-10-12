// npm配布物に含めない開発依存のlicense/SBOM。上流runtimeの完全SBOMとは区別する。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const inventory = JSON.parse(process.platform === 'win32'
  ? execFileSync('cmd.exe', ['/d', '/s', '/c', 'pnpm licenses list --json'], { cwd: root, encoding: 'utf8' })
  : execFileSync('pnpm', ['licenses', 'list', '--json'], { cwd: root, encoding: 'utf8' }));
const allowed = new Set(['MIT', 'Apache-2.0', 'Python-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC']);
const components = [];
for (const [license, packages] of Object.entries(inventory)) {
  if (!allowed.has(license)) throw new Error(`Unreviewed development license: ${license}`);
  for (const dependency of packages) for (const version of dependency.versions) {
    components.push({ type: 'library', 'bom-ref': `${dependency.name}@${version}`, name: dependency.name, version, scope: 'optional',
      licenses: [{ license: { id: license } }], properties: [{ name: 'deepflow:usage', value: 'build-and-test-only-not-bundled-in-npm-artifact' }] });
  }
}
components.sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref'], 'en'));
const normalizedLock = readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8').replace(/\r\n/g, '\n');
const sbom = { bomFormat: 'CycloneDX', specVersion: '1.6', version: 1,
  metadata: { component: { type: 'application', 'bom-ref': `${manifest.name}@${manifest.version}`, name: manifest.name, version: manifest.version, licenses: [{ license: { id: manifest.license } }] },
    properties: [{ name: 'deepflow:scope', value: 'adapter-development-dependencies-only' }, { name: 'deepflow:pnpm-lock-sha256-lf', value: createHash('sha256').update(normalizedLock).digest('hex') }] },
  components,
};
writeFileSync(resolve(root, 'third_party/adapter-dev.sbom.cdx.json'), JSON.stringify(sbom, null, 2) + '\n');
console.log(JSON.stringify({ developmentComponents: components.length, runtimeNpmDependencies: 0, upstreamTransitiveSbomComplete: false }));
