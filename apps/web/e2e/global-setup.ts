import { execSync } from 'node:child_process';

export default function globalSetup() {
  execSync('pnpm --filter @acee/api seed', { cwd: '../..', stdio: 'inherit' });
}
