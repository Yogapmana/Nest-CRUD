import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      DB_NAME: 'nest_crud_test',
      JWT_SECRET: 'test-jwt-secret-for-e2e',
      JWT_ACCESS_EXPIRATION: '15m',
      JWT_REFRESH_EXPIRATION: '7d',
      ADMIN_EMAIL: 'admin@test.local',
      ADMIN_PASSWORD: 'admin123',
      APP_URL: 'http://localhost:3000',
    },
    fileParallelism: false,
  },
});
