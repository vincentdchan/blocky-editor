
import typescript from '@rollup/plugin-typescript';

export default {
  input: {
    'common/dom/index': "src/common/dom/index.ts",
    'common/index': "src/common/index.ts"
  },
  output: {
    dir: 'dist',
    format: 'es'
  },
  experimentalCodeSplitting: true,
  plugins: [typescript({
    declaration: true,
    declarationDir: "dist",
  })]
};
