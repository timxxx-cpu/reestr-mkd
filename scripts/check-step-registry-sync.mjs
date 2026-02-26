import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const constantsPath = path.join(root, 'src/lib/constants.js');
const registryPath = path.join(root, 'src/features/workflow/step-registry.jsx');

const constantsText = fs.readFileSync(constantsPath, 'utf8');
const registryText = fs.readFileSync(registryPath, 'utf8');

const stepsConfigSection = constantsText.match(/export const STEPS_CONFIG = \[(?<body>[\s\S]*?)\n\];/);
if (!stepsConfigSection?.groups?.body) {
  console.error('Could not parse STEPS_CONFIG from src/lib/constants.js');
  process.exit(1);
}

const configIds = [...stepsConfigSection.groups.body.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]);
if (configIds.length === 0) {
  console.error('No step ids found in STEPS_CONFIG');
  process.exit(1);
}

const registrySection = registryText.match(/const STEP_REGISTRY = \{(?<body>[\s\S]*?)\n\};/);
if (!registrySection?.groups?.body) {
  console.error('Could not parse STEP_REGISTRY from src/features/workflow/step-registry.jsx');
  process.exit(1);
}

const registryIds = [...registrySection.groups.body.matchAll(/^\s*([a-z_]+):\s*\{/gm)].map(m => m[1]);

const missingInRegistry = configIds.filter(id => !registryIds.includes(id));
const extraInRegistry = registryIds.filter(id => !configIds.includes(id));

const inconsistentRenderSignatures = [];
for (const id of registryIds) {
  const block = registrySection.groups.body.match(new RegExp(`\n\s*${id}:\s*\{([\s\S]*?)\n\s*\},`));
  if (!block?.[1]) {
    continue;
  }

  const usesSupportedFactory = /render:\s*render(?:Static|BuildingScoped)Step\(/.test(block[1]);
  if (!usesSupportedFactory) {
    inconsistentRenderSignatures.push(id);
  }
}


if (missingInRegistry.length > 0 || extraInRegistry.length > 0 || inconsistentRenderSignatures.length > 0) {
  console.error('Step registry mismatch detected.');
  if (missingInRegistry.length > 0) {
    console.error(`- Missing in STEP_REGISTRY: ${missingInRegistry.join(', ')}`);
  }
  if (extraInRegistry.length > 0) {
    console.error(`- Extra in STEP_REGISTRY: ${extraInRegistry.join(', ')}`);
  }
  if (inconsistentRenderSignatures.length > 0) {
    console.error(`- Inconsistent render signatures (must use renderStaticStep/renderBuildingScopedStep): ${inconsistentRenderSignatures.join(', ')}`);
  }
  process.exit(1);
}

console.log(`Step registry is in sync with STEPS_CONFIG (${configIds.length} steps).`);
