import { spawnMspConnection } from "@muse-code/sdk";
import { SdkOperation } from "./sdk-operation.js";
import type { Logger } from "./logger.js";
type Host = Awaited<ReturnType<ReturnType<typeof spawnMspConnection>["initialize"]>>;
/** Control/read hosts get a bounded request budget after host readiness; callbacks mark mutations explicitly. */
export declare function withSdkControlHost<T>(options: {
    env: Record<string, string | undefined>;
    museBinary?: string;
    cwd: string;
    logger: Logger;
    signal?: AbortSignal;
}, read: (host: Host, operation: SdkOperation) => Promise<T>): Promise<T>;
export {};
//# sourceMappingURL=sdk-control-host.d.ts.map