const js = require("@eslint/js");
const react = require("eslint-plugin-react");
const jsxA11y = require("eslint-plugin-jsx-a11y");
const importPlugin = require("eslint-plugin-import");
const globals = require("globals");

module.exports = [
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      react,
      "jsx-a11y": jsxA11y,
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, ...globals.jest },
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
