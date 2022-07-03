
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  ignorePatterns: ["*.js"],
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": 0,
    "@typescript-eslint/no-non-null-assertion": 0,
    "@typescript-eslint/no-empty-function": 0,
    "@typescript-eslint/ban-ts-comment": 1,
    "no-empty": 1
  },
};
