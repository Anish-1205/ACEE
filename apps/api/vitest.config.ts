import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test', DATABASE_URL: 'postgresql://acee:acee_dev_password@localhost:5433/acee_test', STORAGE_LOCAL_DIR: './storage-test', SMTP_URL: 'smtp://localhost:1025' },
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
