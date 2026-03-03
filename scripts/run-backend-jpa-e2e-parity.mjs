import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const nodeRequired = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const javaRequired = ['SPRING_DATASOURCE_URL', 'SPRING_DATASOURCE_USERNAME', 'SPRING_DATASOURCE_PASSWORD'];

function resolveRequiredEnv() {
  const fallbackUrl = process.env.DB_URL;
  const fallbackUser = process.env.DB_USER;
  const fallbackPassword = process.env.DB_PASSWORD;

  if (!process.env.SPRING_DATASOURCE_URL && fallbackUrl) process.env.SPRING_DATASOURCE_URL = fallbackUrl;
  if (!process.env.SPRING_DATASOURCE_USERNAME && fallbackUser) process.env.SPRING_DATASOURCE_USERNAME = fallbackUser;
  if (!process.env.SPRING_DATASOURCE_PASSWORD && fallbackPassword) process.env.SPRING_DATASOURCE_PASSWORD = fallbackPassword;

  const missingNode = nodeRequired.filter((k) => !process.env[k]);
  const missingJava = javaRequired.filter((k) => !process.env[k]);

  if (missingNode.length > 0 || missingJava.length > 0) {
    console.error('Missing required env for E2E parity run.');
    if (missingNode.length > 0) console.error(`Node backend missing: ${missingNode.join(', ')}`);
    if (missingJava.length > 0) console.error(`Java JPA backend missing: ${missingJava.join(', ')}`);
    console.error('Example: SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... SPRING_DATASOURCE_URL=jdbc:postgresql://... SPRING_DATASOURCE_USERNAME=... SPRING_DATASOURCE_PASSWORD=... npm run run:backend-jpa-e2e-parity');
    process.exit(2);
  }
}

resolveRequiredEnv();

const nodePort = String(process.env.NODE_BACKEND_PORT || '8787');
const javaPort = String(process.env.JAVA_JPA_BACKEND_PORT || '8789');
const nodeUrl = `http://127.0.0.1:${nodePort}`;
const javaUrl = `http://127.0.0.1:${javaPort}`;
const reportPath = process.env.PARITY_REPORT_PATH || 'artifacts/backend-jpa-parity-report.json';

function resolveBin(name, envOverride) {
  const override = process.env[envOverride];
  if (override && override.trim()) return override.trim();

  if (process.platform !== 'win32') return name;

  const candidates = name === 'npm' ? ['npm.cmd', 'npm'] : name === 'node' ? ['node.exe', 'node'] : ['mvn.cmd', 'mvn'];
  for (const candidate of candidates) {
    const res = spawnSync('where', [candidate], { encoding: 'utf8' });
    if (res.status === 0 && res.stdout) {
      const line = res.stdout.split(/\r?\n/).map((v) => v.trim()).find(Boolean);
      if (line) return line;
    }
  }
  return null;
}

function runSafe(bin, args, opts = {}) {
  const resolved = resolveBin(bin, bin === 'npm' ? 'NPM_BIN' : bin === 'node' ? 'NODE_BIN' : 'JAVA_MVN_BIN');
  if (!resolved) {
    const envName = bin === 'npm' ? 'NPM_BIN' : bin === 'node' ? 'NODE_BIN' : 'JAVA_MVN_BIN';
    throw new Error(
      `Cannot find executable for ${bin}. Add it to PATH or set ${envName} to full path (example: C:\\apache-maven\\bin\\mvn.cmd).`
    );
  }

  const isWin = process.platform === 'win32';
  const env = { ...process.env, ...(opts.env || {}) };
  if (isWin && env.JAVA_HOME && /[\\/]bin[\\/]*$/i.test(env.JAVA_HOME)) {
    env.JAVA_HOME = env.JAVA_HOME.replace(/[\\/]bin[\\/]*$/i, '');
    if (env.Path && !env.Path.toLowerCase().includes(env.JAVA_HOME.toLowerCase())) {
      env.Path = `${env.JAVA_HOME}\\bin;${env.Path}`;
    }
  }
  const cwd = opts.cwd || repoRoot;
  const stdio = opts.stdio || 'pipe';

  let child;
  if (isWin) {
    const quoteWin = (value) => {
      const s = String(value);
      if (/^[A-Za-z0-9_./:-]+$/.test(s)) return s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const command = [quoteWin(resolved), ...args.map(quoteWin)].join(' ');
    child = spawn(command, {
      cwd,
      env,
      stdio,
      shell: true,
    });
  } else {
    child = spawn(resolved, args, {
      cwd,
      env,
      stdio,
      shell: false,
    });
  }
  return child;
}

function waitForHttp(url, timeoutMs = 120000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch(url);
        if (res.status < 500) return resolve();
      } catch {}
      if (Date.now() - started > timeoutMs) {
        return reject(new Error(`Timeout waiting for ${url}`));
      }
      setTimeout(check, 1000);
    };
    check();
  });
}

function pipeLogs(prefix, child) {
  child.stdout?.on('data', (d) => process.stdout.write(`[${prefix}] ${d}`));
  child.stderr?.on('data', (d) => process.stderr.write(`[${prefix}] ${d}`));
}

async function main() {
  let nodeProc = null;
  let javaProc = null;

  const stop = () => {
    nodeProc?.kill('SIGTERM');
    javaProc?.kill('SIGTERM');
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  try {
    nodeProc = runSafe('npm', ['run', 'dev'], {
      cwd: path.join(repoRoot, 'apps/backend'),
      env: {
        PORT: nodePort,
        HOST: '0.0.0.0',
        AUTH_MODE: process.env.AUTH_MODE || 'dev',
        JWT_SECRET: process.env.JWT_SECRET || 'my_super_secret_dev_key_12345!@#',
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    pipeLogs('node', nodeProc);

    javaProc = runSafe('mvn', ['spring-boot:run', '-q'], {
      cwd: path.join(repoRoot, 'apps/backend-java-jpa'),
      env: {
        PORT: javaPort,
        HOST: '0.0.0.0',
        AUTH_MODE: process.env.AUTH_MODE || 'dev',
        APP_AUTH_MODE: process.env.APP_AUTH_MODE || process.env.AUTH_MODE || 'dev',
        JWT_SECRET: process.env.JWT_SECRET || 'my_super_secret_dev_key_12345!@#',
        APP_JWT_SECRET: process.env.APP_JWT_SECRET || process.env.JWT_SECRET || 'my_super_secret_dev_key_12345!@#',
        SPRING_DATASOURCE_URL: process.env.SPRING_DATASOURCE_URL,
        SPRING_DATASOURCE_USERNAME: process.env.SPRING_DATASOURCE_USERNAME,
        SPRING_DATASOURCE_PASSWORD: process.env.SPRING_DATASOURCE_PASSWORD,
      },
    });
    pipeLogs('java-jpa', javaProc);

    await waitForHttp(`${nodeUrl}/health`);
    await waitForHttp(`${javaUrl}/api/v1/ops/ping`);

    const checker = runSafe('npm', ['run', 'check:backend-jpa-functional-parity'], {
      cwd: repoRoot,
      env: {
        NODE_BACKEND_URL: nodeUrl,
        JAVA_JPA_BACKEND_URL: javaUrl,
        PARITY_SCENARIOS: process.env.PARITY_SCENARIOS || 'tests/parity/backend-functional-parity.scenarios.json',
        PARITY_REPORT_PATH: reportPath,
      },
      stdio: 'inherit',
    });

    const exitCode = await new Promise((resolve, reject) => {
      checker.on('error', reject);
      checker.on('exit', resolve);
    });

    const summary = runSafe('node', ['scripts/summarize-backend-jpa-parity-report.mjs', reportPath], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    await new Promise((resolve) => summary.on('exit', resolve));

    stop();
    process.exit(exitCode ?? 1);
  } catch (error) {
    console.error(error.message);
    stop();
    process.exit(1);
  }
}

main();
