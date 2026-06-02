import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname),
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  transpilePackages: ["@bezhas/sdk"],
  webpack(config) {
    config.resolve.alias["@agents"] = path.resolve(__dirname, "modules/agents-ui");
    return config;
  },
};

export default nextConfig;
