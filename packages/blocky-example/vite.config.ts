import { defineConfig } from "vite";
import * as path from "path";
import react from "@vitejs/plugin-react";

export const projectRootDir = process.cwd();

export const resolveByProjectRootDir = (...pathSegments: string[]) => {
  return path.resolve(projectRootDir, ...pathSegments);
};

export default defineConfig(() => {
  return {
    plugins: [
      react({
        exclude: [/blocky-core/, /node_modules/],
      }),
    ],
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
      exclude: ["blocky-common", "blocky-core", "blocky-react"],
    },
  };
});
