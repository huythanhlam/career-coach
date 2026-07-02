import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import eslintConfigPrettier from "eslint-config-prettier";

// Downgrade any severity-2 rule to a warning, preserving rule options.
// jsx-a11y uses numeric severities (0/1/2) rather than strings.
function toWarn(value) {
  if (value === "error" || value === 2) return "warn";
  if (Array.isArray(value) && (value[0] === "error" || value[0] === 2))
    return ["warn", ...value.slice(1)];
  return value;
}

export default tseslint.config(
  // Build artifacts and generated files — never lint these
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "supabase/functions/**",
      "supabase/types.ts",
    ],
  },

  // Apply to all TypeScript source (src/ + scripts/)
  {
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,mts,mjs}"],
    extends: [...tseslint.configs.recommended],
    plugins: {
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      // TypeScript: loosen noisy defaults while baseline burns down
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",

      // React hooks: rules-of-hooks is a real runtime bug → error
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // jsx-a11y: recommended preset, all at warn level
      ...Object.fromEntries(
        Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([k, v]) => [k, toWarn(v)]),
      ),
    },
  },

  // Prettier must come last — disables conflicting formatting rules
  eslintConfigPrettier,
);
