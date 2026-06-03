const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAIN_DIST = path.join(ROOT, 'packages', 'main', 'dist', 'index.js');
const PRELOAD_DIST = path.join(ROOT, 'packages', 'main', 'dist', 'preload.js');
const DEFAULT_DEV_SERVER_URL = 'http://localhost:5173';

function getCommand(bin) {
  if (process.platform !== 'win32') return bin;
  return bin.endsWith('.cmd') ? bin : `${bin}.cmd`;
}

function quoteWindowsArg(value) {
  if (/[\s"]/u.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  return value;
}

function spawnLogged(command, args, options = {}) {
  const spawnCommand =
    process.platform === 'win32'
      ? 'cmd.exe'
      : command;

  const spawnArgs =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', [command, ...args].map(quoteWindowsArg).join(' ')]
      : args;

  return spawn(spawnCommand, spawnArgs, {
    cwd: ROOT,
    stdio: options.stdio || 'inherit',
    env: { ...process.env, ...options.env },
    shell: false,
  });
}

function waitForDevServerFromOutput(child, timeoutMs = 60000) {
  const start = Date.now();
  const matcher = /(http:\/\/localhost:\d+)/i;

  return new Promise((resolve, reject) => {
    const handleChunk = (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      const match = text.match(matcher);
      if (match) {
        cleanup();
        resolve(match[1]);
      }
    };

    const handleError = (error) => {
      cleanup();
      reject(error);
    };

    const timer = setInterval(() => {
      if (Date.now() - start > timeoutMs) {
        cleanup();
        reject(new Error('Timed out waiting for Vite dev server URL'));
      }
    }, 300);

    const cleanup = () => {
      clearInterval(timer);
      child.stdout?.off('data', handleChunk);
      child.stderr?.off('data', handleChunk);
      child.off('error', handleError);
    };

    child.stdout?.on('data', handleChunk);
    child.stderr?.on('data', handleChunk);
    child.on('error', handleError);
  });
}

function waitForFile(filePath, timeoutMs = 60000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (fs.existsSync(filePath)) {
        clearInterval(timer);
        resolve();
        return;
      }

      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for file: ${filePath}`));
      }
    }, 300);
  });
}

function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get(url, (res) => {
        res.resume();

        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }

        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for server: ${url}`));
          return;
        }

        setTimeout(poll, 300);
      });

      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for server: ${url}`));
          return;
        }

        setTimeout(poll, 300);
      });
    };

    poll();
  });
}

async function resolveDevServerUrl(vite, timeoutMs = 15000) {
  const byOutput = waitForDevServerFromOutput(vite, timeoutMs);
  const byDefaultPort = waitForServer(DEFAULT_DEV_SERVER_URL, timeoutMs).then(() => DEFAULT_DEV_SERVER_URL);

  try {
    return await Promise.any([byOutput, byDefaultPort]);
  } catch {
    return DEFAULT_DEV_SERVER_URL;
  }
}

async function main() {
  const children = [];
  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;

    for (const child of children) {
      if (!child.killed) {
        child.kill();
      }
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', shutdown);

  const vite = spawnLogged(
    getCommand('corepack'),
    ['pnpm', '--filter', '@qiuai/renderer', 'dev'],
    { stdio: ['inherit', 'pipe', 'pipe'] }
  );
  const tscWatch = spawnLogged(getCommand('corepack'), ['pnpm', '--filter', '@qiuai/main', 'watch']);
  children.push(vite, tscWatch);

  vite.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      shutdown();
      process.exit(code || 1);
    }
  });

  tscWatch.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      shutdown();
      process.exit(code || 1);
    }
  });

  const devServerUrl = await resolveDevServerUrl(vite);

  await Promise.all([
    waitForServer(devServerUrl),
    waitForFile(MAIN_DIST),
    waitForFile(PRELOAD_DIST),
  ]);

  const electron = spawn(
    process.execPath,
    [
      path.join(__dirname, 'run-electron.cjs'),
      'packages/main/dist/index.js',
    ],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, VITE_DEV_SERVER_URL: devServerUrl },
      shell: false,
    }
  );
  children.push(electron);

  electron.on('exit', (code) => {
    shutdown();
    process.exit(code || 0);
  });
}

main().catch((error) => {
  console.error('[electron-dev]', error.message);
  process.exit(1);
});
