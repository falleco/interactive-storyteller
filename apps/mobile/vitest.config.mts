import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

console.log('vitest.config.ts');

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true, // https://vitest.dev/guide/cli.html
    environment: 'happy-dom',
    include: ['./**/*.{test,spec}.?(c|m)[jt]s?(x)'],

    reporters:
      process.env.CODECOV_TOKEN !== undefined
        ? ['default', 'junit']
        : ['default'],
    outputFile: 'app-test-report.junit.xml',
    setupFiles: ['./test.setup.ts'],
    coverage: {
      exclude: [
        'node_modules',
        'dist',
        'storybook-static',
        '.storybook',
        '**/*.stories.*',
        '**/*.spec.*',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/*.config.mts',
        '**/*.config.mjs',
        '.next',
        '*.js',
      ],
      provider: 'v8',
      reporter: ['text', 'json'],
    },
  },
});
