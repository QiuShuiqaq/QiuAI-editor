const { spawn } = require('child_process');

function main() {
  const electronPath = String(require('electron')).replace(/^"|"$/g, '');
  const env = { ...process.env };

  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(electronPath, process.argv.slice(2), {
    cwd: process.cwd(),
    stdio: 'inherit',
    env,
    shell: false,
  });

  child.on('error', (error) => {
    console.error('[run-electron]', error.message);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main();
