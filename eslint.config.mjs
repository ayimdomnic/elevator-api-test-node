import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-plugin-prettier";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores(["**/dist/", "**/node_modules/", "**/coverage/"]), {
    extends: compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:prettier/recommended",
    ),

    plugins: {
        "@typescript-eslint": typescriptEslint,
        prettier,
    },

    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.jest,
        },

        parser: tsParser,
        ecmaVersion: 2020,
        sourceType: "module",
    },

    rules: {
        "prettier/prettier": "error",
        "@typescript-eslint/explicit-module-boundary-types": "off",

        "@typescript-eslint/no-unused-vars": ["error", {
            argsIgnorePattern: "^_",
        }],

        "no-console": ["warn", {
            allow: ["warn", "error"],
        }],

        eqeqeq: ["error", "always"],
        curly: "error",
        "no-implicit-coercion": "error",
    },
}]);