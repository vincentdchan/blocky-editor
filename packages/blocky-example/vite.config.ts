import { defineConfig } from "vite";
import * as path from "path";
import preact from "@preact/preset-vite";

export const projectRootDir = process.cwd();

export const resolveByProjectRootDir = (...pathSegments: string[]) => {
  return path.resolve(projectRootDir, ...pathSegments);
};

export default defineConfig(() => {
  return {
    // public path field.
    // see: https://vitejs.dev/config/#base
    // base: env.command === 'build'
    //   ? `https://assets-cdn.xindiancad.com/${getVersionQuery()}/`
    //   : '',
    plugins: [preact()],
    resolve: {
      alias: {
        "@pkg": resolveByProjectRootDir("src"),
      },
    },
    server: {
      port: 9000,
    },
    build: {
      // ref: https://esbuild.github.io/api/#target
      target: "esnext",
      outDir: "dist",
      // we don't need assets folder,
      // just flattern to root of dist folder
      // assetsDir: './',
      // assetsInlineLimit: 6 * 1024, // 6 KB
    },
    optimizeDeps: {
      exclude: ["blocky-common", "blocky-core", "blocky-preact"],
    },
  };
});
