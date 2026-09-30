import { defineConfig } from "vite-plus"

export default defineConfig({
  defaultPackage: "./apps/web",
  run: {
    tasks: {
      deploy: {
        command: "vp -C apps/web run deploy",
        cache: false,
      },
      deployCheck: {
        command: "vp -C apps/web run deploy:check",
        cache: false,
      },
    },
  },
  fmt: {
    endOfLine: "lf",
    semi: false,
    singleQuote: false,
    tabWidth: 2,
    trailingComma: "es5",
    printWidth: 80,
    sortPackageJson: false,
    sortTailwindcss: {
      stylesheet: "packages/ui/src/styles/globals.css",
      functions: ["cn", "cva"],
    },
    ignorePatterns: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "pnpm-lock.yaml",
      "apps/api/migrations/meta/**",
      "apps/api/worker-configuration.d.ts",
      "apps/web/src/routeTree.gen.ts",
    ],
  },
  lint: {
    categories: {
      correctness: "error",
      suspicious: "error",
      perf: "error",
    },
    plugins: ["typescript", "react", "oxc", "import", "jsx-a11y", "vitest"],
    options: {
      typeAware: true,
      typeCheck: true,
      denyWarnings: true,
      reportUnusedDisableDirectives: "error",
    },
    ignorePatterns: [
      "**/dist/**",
      "**/coverage/**",
      "apps/api/worker-configuration.d.ts",
      "apps/web/src/routeTree.gen.ts",
    ],
    rules: {
      // Immutable projections are clearer than mutating rows returned by Drizzle.
      "oxc/no-map-spread": "off",
      "typescript/no-floating-promises": "error",
      "react/rules-of-hooks": "error",
      "react/react-in-jsx-scope": "off",
      "import/no-unassigned-import": "off",
      // Valibot's human-readable error text is not part of the API contract.
      "vitest/require-to-throw-message": "off",
      "react/only-export-components": [
        "error",
        {
          allowExportNames: ["Route"],
        },
      ],
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    overrides: [
      {
        files: ["apps/api/**/*.ts"],
        env: {
          worker: true,
        },
      },
      {
        files: ["apps/web/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
        env: {
          browser: true,
        },
      },
      {
        files: ["apps/web/public/push-sw.js"],
        env: {
          worker: true,
        },
      },
      {
        files: ["**/*.test.ts", "**/*.test.tsx"],
        env: {
          vitest: true,
        },
      },
    ],
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
})
