import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srcDir = path.join(root, 'src');
const readmePath = path.join(root, 'README.md');
const manifestPath = path.join(root, 'route-manifest.json');

const ROUTE_RE = /app\.(get|post|put|delete|patch)\('\s*([^']+?)\s*'/g;
const README_ROUTE_RE = /^-\s+`(GET|POST|PUT|DELETE|PATCH)\s+([^`]+)`\s*$/;

const normalizePath = routePath => routePath.split('?')[0].trim();

function collectCodeRoutes() {
  const files = fs
    .readdirSync(srcDir)
    .filter(name => name.endsWith('.js'))
    .map(name => path.join(srcDir, name));

  const routes = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = ROUTE_RE.exec(text)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: normalizePath(match[2]),
        source: path.relative(root, file),
      });
    }
  }

  return routes.sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));
}

function collectReadmeRoutes() {
  const text = fs.readFileSync(readmePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const routes = [];
  for (const line of lines) {
    const match = line.match(README_ROUTE_RE);
    if (!match) continue;
    routes.push({ method: match[1], path: normalizePath(match[2]) });
  }
  return routes.sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));
}

function uniqueKey(route) {
  return `${route.method} ${route.path}`;
}

function makeManifest(routes) {
  return {
    generatedAt: new Date().toISOString(),
    routeCount: routes.length,
    routes: routes.map(route => ({ method: route.method, path: route.path, source: route.source })),
  };
}

function printDiff({ onlyInCode, onlyInReadme, onlyInManifest }) {
  if (onlyInCode.length) {
    console.error('\nRoutes missing in README.md:');
    onlyInCode.forEach(key => console.error(`  + ${key}`));
  }

  if (onlyInReadme.length) {
    console.error('\nRoutes documented but not found in code:');
    onlyInReadme.forEach(key => console.error(`  - ${key}`));
  }

  if (onlyInManifest.length) {
    console.error('\nRoutes missing in route-manifest.json:');
    onlyInManifest.forEach(key => console.error(`  * ${key}`));
  }
}

const codeRoutes = collectCodeRoutes();
const readmeRoutes = collectReadmeRoutes();

const codeSet = new Set(codeRoutes.map(uniqueKey));
const readmeSet = new Set(readmeRoutes.map(uniqueKey));

const onlyInCode = [...codeSet].filter(key => !readmeSet.has(key)).sort();
const onlyInReadme = [...readmeSet].filter(key => !codeSet.has(key)).sort();

const writeMode = process.argv.includes('--write');
if (writeMode) {
  const manifest = makeManifest(codeRoutes);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Updated ${path.relative(root, manifestPath)} with ${manifest.routeCount} routes.`);
}

let onlyInManifest = [];
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const manifestSet = new Set((manifest.routes || []).map(uniqueKey));
  onlyInManifest = [...codeSet].filter(key => !manifestSet.has(key)).sort();
}

if (onlyInCode.length || onlyInReadme.length || onlyInManifest.length) {
  printDiff({ onlyInCode, onlyInReadme, onlyInManifest });
  process.exit(1);
}

console.log(`Route docs are in sync (${codeSet.size} routes).`);
