import { defineConfig } from "vite";
import * as path from "path";

export const projectRootDir = process.cwd();

export const resolveByProjectRootDir = (...pathSegments: string[]) => {
  return path.resolve(projectRootDir, ...pathSegments);
};

export default defineConfig(() => {
  return {
    alias: {
      "@pkg": resolveByProjectRootDir("src"),
    },
    test: {
      environment: "jsdom",
      deps: {
        inline: ["quill-delta-es", "blocky-data"],
      },
    },
  };
});
