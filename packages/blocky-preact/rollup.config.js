import typescript from '@rollup/plugin-typescript';

export default {
  input: {
    'index': "src/index.tsx"
  },
  output: {
    dir: 'dist',
    format: 'es'
  },
  external: ["preact", "blocky-core"],
  plugins: [
    typescript({
      declaration: true,
      declarationDir: "dist",
    }),
  ],
};
