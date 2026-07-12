import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

function readGitTagVersion() {
  try {
    const version = execFileSync(
      "git",
      ["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*"],
      { encoding: "utf8" },
    ).trim();

    return /^v\d+\.\d+\.\d+$/.test(version) ? version : "local";
  } catch {
    return "local";
  }
}

const configuredVersion =
  process.env.NEXT_PUBLIC_SKETCHBLOCK_VERSION ||
  process.env.SKETCHBLOCK_VERSION ||
  process.env.SKETCHBLOCK_IMAGE_TAG;

const sketchblockVersion =
  configuredVersion && configuredVersion !== "local"
    ? configuredVersion
    : readGitTagVersion();

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.SKETCHBLOCK_DIST_DIR || ".next",
  env: {
    NEXT_PUBLIC_SKETCHBLOCK_VERSION: sketchblockVersion,
  },
};

export default withNextIntl(nextConfig);
