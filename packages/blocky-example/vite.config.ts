import { defineConfig } from 'vite';
import preact from "@preact/preset-vite";

export default defineConfig((env) => {
  
    return {
      // public path field.
      // see: https://vitejs.dev/config/#base
      // base: env.command === 'build'
      //   ? `https://assets-cdn.xindiancad.com/${getVersionQuery()}/`
      //   : '',
      plugins: [
        preact(),
      ],
      resolve: {
      },
      server: {
        port: 9000,
      },
      build: {
        // ref: https://esbuild.github.io/api/#target
        target: 'esnext',
        outDir: 'dist',
        // we don't need assets folder,
        // just flattern to root of dist folder
        // assetsDir: './',
        // assetsInlineLimit: 6 * 1024, // 6 KB
      },
      optimizeDeps: {
        exclude: [
          'blocky-common',
          'blocky-core',
          'blocky-preact',
        ]
      }
    };
  });
