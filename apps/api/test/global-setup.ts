import { execSync } from 'node:child_process';

/** Applies all migrations to the test database: this is also the migration test. */
export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'postgresql://acee:acee_dev_password@localhost:5433/acee_test' },
  });
}
