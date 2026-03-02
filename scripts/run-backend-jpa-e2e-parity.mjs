import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const required = ['DB_URL', 'DB_USER', 'DB_PASSWORD'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required env for Java JPA runtime: ${missing.join(', ')}`);
  console.error('Example: DB_URL=jdbc:postgresql://localhost:5432/reestr_mkd DB_USER=postgres DB_PASSWORD=postgres npm run run:backend-jpa-e2e-parity');
  process.exit(2);
}

const nodePort = String(process.env.NODE_BACKEND_PORT || '8787');
const javaPort = String(process.env.JAVA_JPA_BACKEND_PORT || '8789');
const nodeUrl = `http://127.0.0.1:${nodePort}`;
const javaUrl = `http://127.0.0.1:${javaPort}`;

function resolveBin(name, envOverride) {
  const override = process.env[envOverride];
  if (override && override.trim()) return override.trim();

  if (process.platform !== 'win32') return name;

  const candidates = name === 'npm' ? ['npm.cmd', 'npm'] : ['mvn.cmd', 'mvn'];
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
  const resolved = resolveBin(bin, bin === 'npm' ? 'NPM_BIN' : 'JAVA_MVN_BIN');
  if (!resolved) {
    const envName = bin === 'npm' ? 'NPM_BIN' : 'JAVA_MVN_BIN';
    throw new Error(
      `Cannot find executable for ${bin}. Add it to PATH or set ${envName} to full path (example: C:\\apache-maven\\bin\\mvn.cmd).`
    );
  }

  const isWin = process.platform === 'win32';
  const env = { ...process.env, ...(opts.env || {}) };
  if (isWin && env.JAVA_HOME && /[\\/]bin[\\/]*$/i.test(env.JAVA_HOME)) {
    // Maven expects JAVA_HOME to point to JDK root, not to .../bin.
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
    // NOTE: use shell command string on Windows (without args array) to avoid
    // EINVAL/ENOENT and path-with-spaces issues in PowerShell/cmd.
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
      },
    });
    pipeLogs('node', nodeProc);

    javaProc = runSafe('mvn', ['spring-boot:run', '-q'], {
      cwd: path.join(repoRoot, 'apps/backend-java-jpa'),
      env: {
        PORT: javaPort,
        HOST: '0.0.0.0',
        AUTH_MODE: process.env.AUTH_MODE || 'jwt',
        JWT_SECRET: process.env.JWT_SECRET || 'my_super_secret_dev_key_12345!@#',
        DB_URL: process.env.DB_URL,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
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
      },
      stdio: 'inherit',
    });

    const exitCode = await new Promise((resolve, reject) => {
      checker.on('error', reject);
      checker.on('exit', resolve);
    });
    stop();
    process.exit(exitCode ?? 1);
  } catch (error) {
    console.error(error.message);
    stop();
    process.exit(1);
  }
}

main();