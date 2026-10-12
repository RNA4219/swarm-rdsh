import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (name) => readFileSync(resolve(root, name), 'utf8').replace(/\r\n/g, '\n');
const manifest = JSON.parse(read('package.json'));
if (manifest.license !== 'MIT' || manifest.dependencies && Object.keys(manifest.dependencies).length) throw new Error('Unexpected artifact license/runtime dependencies');
const requiredDocuments = ['LICENSE', 'ACKNOWLEDGEMENTS.md', 'THIRD_PARTY_NOTICES.md', 'SECURITY.md', 'CHANGELOG.md', 'docs/RELEASE.md'];
for (const name of requiredDocuments) if (!existsSync(resolve(root, name)) || read(name).trim().length < 50) throw new Error(`Missing public document: ${name}`);
const lock = JSON.parse(read('upstream.lock'));
if (lock.status !== 'blocked' || lock.real_e2e.production_qualified !== false) throw new Error('Unqualified production claim');
const sources = JSON.parse(read('third_party/upstream-sources.json'));
for (const project of ['gastown', 'deepseek-harness', 'rustdsh', 'dsh-tui', 'beads', 'dsh-std', 'dolt']) {
  const entry = sources.find((row) => row.project === project);
  if (!entry || !entry.license_file?.startsWith('third_party/licenses/') || entry.license_file.includes('..') || !entry.license_source.startsWith('https://')) throw new Error(`Missing adoption/license entry: ${project}`);
  if (!/^[a-f0-9]{40}$/.test(entry.revision ?? '') && !entry.archive_sha256) throw new Error(`Unfixed third party: ${project}`);
  if (createHash('sha256').update(read(entry.license_file)).digest('hex') !== entry.license_sha256_lf) throw new Error(`License notice changed: ${project}`);
}
const sbom = JSON.parse(read('third_party/adapter-dev.sbom.cdx.json'));
if (sbom.bomFormat !== 'CycloneDX' || sbom.specVersion !== '1.6' || sbom.metadata.component.version !== manifest.version || !sbom.components.length) throw new Error('Invalid development SBOM');
const lockDigest = createHash('sha256').update(read('pnpm-lock.yaml')).digest('hex');
if (!sbom.metadata.properties.some((property) => property.name === 'deepflow:pnpm-lock-sha256-lf' && property.value === lockDigest)) throw new Error('Stale development SBOM');
if (sbom.components.some((component) => !component.version || !component.licenses?.length || component.scope !== 'optional')) throw new Error('Incomplete development license inventory');
for (const name of ['ACKNOWLEDGEMENTS.md', 'SECURITY.md', 'CHANGELOG.md', 'docs/RELEASE.md', 'third_party/upstream-sources.json', 'third_party/adapter-dev.sbom.cdx.json']) {
  if (!manifest.files.includes(name)) throw new Error(`Document missing from package allowlist: ${name}`);
}
console.log(JSON.stringify({ publicSourceAndAdapterMetadata: 'passed', thirdPartyNotices: sources.length, developmentComponents: sbom.components.length, stableSwarmQualified: false, registryPublication: manifest.private ? 'disabled' : 'enabled' }));
