import packageJson from "../package.json";

type AppPackageMetadata = {
  version?: unknown;
};

const metadata = packageJson as AppPackageMetadata;
const fallbackVersion = "0.0.0";

export const APP_VERSION = typeof metadata.version === "string" ? metadata.version : fallbackVersion;
