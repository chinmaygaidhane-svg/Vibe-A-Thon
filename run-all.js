import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('⚡ Starting AidFlow AI (Server + Client)...');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

// 1. Start Server
const server = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'inherit',
  shell: true
});

// 2. Start Client
const client = spawn(npmCmd, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '3000'], {
  cwd: path.join(__dirname, 'client'),
  stdio: 'inherit',
  shell: true
});

process.on('SIGINT', () => {
  server.kill();
  client.kill();
  process.exit();
});
