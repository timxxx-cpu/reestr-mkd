import fs from 'node:fs';
import path from 'node:path';

const NODE_BACKEND_SRC = 'apps/backend/src';
const JAVA_JPA_SRC = 'apps/backend-java-jpa/src/main/java';

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, out);
      continue;
    }
    if (!predicate || predicate(full)) out.push(full);
  }
  return out;
}

function normalizePath(routePath) {
  return routePath
    .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '{}')
    .replace(/\{[^/}]+\}/g, '{}')
    .replace(/\/+/g, '/');
}

function extractNodeRoutes() {
  const files = walkFiles(NODE_BACKEND_SRC, (file) => file.endsWith('.js'));
  const routeRegex = /\b(?:fastify|app)\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/g;

  const routes = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = routeRegex.exec(source)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        normalized: normalizePath(match[2]),
        file,
      });
    }
  }
  return routes;
}

function parseMappingArgument(arg) {
  if (!arg || !arg.trim()) return '';
  let found = arg.match(/(?:path|value)\s*=\s*"([^"]*)"/);
  if (!found) found = arg.match(/"([^"]*)"/);
  return found ? found[1] : '';
}

function extractJavaJpaRoutes() {
  const files = walkFiles(JAVA_JPA_SRC, (file) => file.endsWith('Controller.java'));
  const methodRegex = /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping)(?:\(([^)]*)\))?/g;

  const routes = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    let classBase = '';
    const classMatch = source.match(/@RequestMapping\(([^)]*)\)/);
    if (classMatch) classBase = parseMappingArgument(classMatch[1]);

    let match;
    while ((match = methodRegex.exec(source)) !== null) {
      const method = match[1].replace('Mapping', '').toUpperCase();
      const endpointPath = parseMappingArgument(match[2] || '');
      const fullPath = `${classBase}${endpointPath}` || '/';
      routes.push({
        method,
        path: fullPath,
        normalized: normalizePath(fullPath),
        file,
      });
    }
  }
  return routes;
}

function dedupeRoutes(routes) {
  const map = new Map();
  for (const route of routes) {
    const key = `${route.method} ${route.normalized}`;
    if (!map.has(key)) map.set(key, route);
  }
  return map;
}

const nodeRoutes = extractNodeRoutes();
const jpaRoutes = extractJavaJpaRoutes();

const nodeMap = dedupeRoutes(nodeRoutes);
const jpaMap = dedupeRoutes(jpaRoutes);

const missingInJpa = [...nodeMap.keys()].filter((key) => !jpaMap.has(key)).sort();
const extraInJpa = [...jpaMap.keys()].filter((key) => !nodeMap.has(key)).sort();

const report = {
  checkedAt: new Date().toISOString(),
  nodeRouteCount: nodeMap.size,
  javaJpaRouteCount: jpaMap.size,
  parity: missingInJpa.length === 0 && extraInJpa.length === 0,
  missingInJavaJpa: missingInJpa,
  extraInJavaJpa: extraInJpa,
};

console.log(JSON.stringify(report, null, 2));

if (!report.parity) {
  process.exitCode = 1;
}
