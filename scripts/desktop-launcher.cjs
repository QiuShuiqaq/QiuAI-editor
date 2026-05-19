/**
 * 秋AI编辑器 - 桌面启动器
 *
 * 启动本地Vite开发服务器 + 系统浏览器App模式
 * 效果等同于桌面应用（无工具栏、无地址栏、独立窗口）
 *
 * 用法: node scripts/desktop-launcher.cjs [--prod]
 *   --dev  默认: 启动Vite开发服务器 + 浏览器App模式
 *   --prod 构建并启动静态服务器 + 浏览器App模式
 */

const { spawn, exec } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 5173;
const HOST = 'localhost';
const APP_URL = `http://${HOST}:${PORT}`;
const APP_TITLE = '秋AI编辑器 - 科研申报书AI辅助写作';

// Check if a process is running on the given port
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// Wait for a URL to become available
function waitForServer(url, maxRetries = 30, interval = 500) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else if (++retries < maxRetries) {
          setTimeout(check, interval);
        } else {
          reject(new Error(`Server not ready after ${maxRetries} retries`));
        }
      }).on('error', () => {
        if (++retries < maxRetries) {
          setTimeout(check, interval);
        } else {
          reject(new Error(`Server not ready after ${maxRetries} retries`));
        }
      });
    };
    check();
  });
}

// Open browser in app mode
function openBrowserApp(url, title) {
  // Try Microsoft Edge first (Windows default), then Chrome, then generic open
  const browsers = [
    {
      name: 'Edge',
      cmd: 'start',
      args: ['', 'microsoft-edge:', `--app=${url}`, `--edge-kiosk-type=fullscreen`, '--new-window'],
    },
    {
      name: 'Edge (simple)',
      cmd: 'start',
      args: ['', 'microsoft-edge:', `--app=${url}`],
    },
    {
      name: 'Chrome',
      cmd: 'start',
      args: ['', 'chrome:', `--app=${url}`],
    },
  ];

  // Use Windows start command with the URL in app mode
  // The most reliable way on Windows:
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edgePathAlt = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';

  if (fs.existsSync(edgePath)) {
    console.log('[Launcher] Opening Edge in app mode...');
    spawn(edgePath, [`--app=${url}`, '--new-window', `--window-name=${title}`], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    return;
  }
  if (fs.existsSync(edgePathAlt)) {
    console.log('[Launcher] Opening Edge in app mode...');
    spawn(edgePathAlt, [`--app=${url}`, '--new-window', `--window-name=${title}`], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    return;
  }

  // Fallback: use generic start command
  console.log('[Launcher] Opening browser via start command...');
  spawn('cmd', ['/c', 'start', '', url], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}

// Main
async function main() {
  const isProd = process.argv.includes('--prod');
  const isDev = process.argv.includes('--dev') || !isProd;

  console.log('╔══════════════════════════════════════════╗');
  console.log('║     秋AI编辑器 - 桌面启动器             ║');
  console.log('║     QiuAi Editor Desktop Launcher        ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log();

  const portInUse = await isPortInUse(PORT);

  if (isProd) {
    // Production mode: build first, then serve
    console.log('[Launcher] Production mode: building app...');
    // Build already done, just serve the dist
    const distPath = path.join(__dirname, '..', 'packages', 'renderer', 'dist');

    if (!fs.existsSync(distPath)) {
      console.error('[Launcher] Build not found. Run: npx vite build');
      console.error('[Launcher] Falling back to dev mode...');
    } else {
      console.log('[Launcher] Starting static file server...');
      // Use a simple HTTP server (if available) or Vite preview
      const previewProc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', HOST], {
        cwd: path.join(__dirname, '..', 'packages', 'renderer'),
        stdio: 'inherit',
        shell: true,
      });

      await waitForServer(APP_URL);
      openBrowserApp(APP_URL, APP_TITLE);
      console.log('[Launcher] App is running. Close this window to shut down.');
      return;
    }
  }

  // Dev mode
  if (!portInUse && isDev) {
    console.log('[Launcher] Starting Vite development server...');
    const viteProc = spawn('npx', ['vite', '--port', String(PORT), '--host', HOST], {
      cwd: path.join(__dirname, '..', 'packages', 'renderer'),
      stdio: 'inherit',
      shell: true,
      detached: true,
    });
    viteProc.unref();

    console.log('[Launcher] Waiting for server to be ready...');
    await waitForServer(APP_URL);
    console.log('[Launcher] Server ready!');
  } else if (portInUse) {
    console.log(`[Launcher] Server already running on port ${PORT}`);
  }

  // Open browser in app mode
  openBrowserApp(APP_URL, APP_TITLE);
  console.log(`[Launcher] App opened at ${APP_URL}`);
  console.log('[Launcher] Desktop app is running.');
  console.log();
  console.log('  Tips:');
  console.log('  - The app opens in a borderless window (no toolbar/address bar)');
  console.log('  - Press Alt+F4 to close');
  console.log('  - Your data is saved in browser localStorage');
  console.log('  - To stop: close this terminal + the app window');
  console.log();
}

main().catch(console.error);
