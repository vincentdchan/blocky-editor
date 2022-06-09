
import typescript from '@rollup/plugin-typescript';

export default {
  input: {
    'index': "src/index.ts"
  },
  output: {
    dir: 'dist',
    format: 'es'
  },
  external: ["fastdiff"],
  plugins: [typescript({
    declaration: true,
    declarationDir: "dist",
  })]
};
