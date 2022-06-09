
import typescript from '@rollup/plugin-typescript';

export default {
  input: {
    'common/dom/index': "src/common/dom/index.ts",
    'common/index': "src/common/index.ts",
    'model/index': "src/model/index.ts"
  },
  output: {
    dir: 'dist',
    format: 'es'
  },
  plugins: [typescript({
    declaration: true,
    declarationDir: "dist",
  })]
};
