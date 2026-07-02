import type { Request } from "express";
/**
 * Generates a unique request ID using the SDK's ID utility.
 *
 * @returns A new unique request ID string.
 */
export declare function generateRequestId(): string;
/**
 * Extracts a request ID from an incoming Express request.
 *
 * Checks the `X-Request-ID` and `X-Correlation-ID` headers (in that order).
 * If neither header is present, a new unique ID is generated.
 *
 * @param req - The incoming Express request object.
 * @returns The resolved request ID string.
 */
export declare function extractRequestId(req: Pick<Request, "headers">): string;
//# sourceMappingURL=request-id.d.ts.map