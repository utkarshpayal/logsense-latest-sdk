"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpTransport = void 0;
const node_zlib_1 = require("node:zlib");
const node_util_1 = require("node:util");
const gzipAsync = (0, node_util_1.promisify)(node_zlib_1.gzip);
class HttpTransport {
    endpoint;
    apiKey;
    timeout;
    constructor(options) {
        this.endpoint = options.endpoint;
        this.apiKey = options.apiKey;
        this.timeout = options.timeout ?? 10000;
    }
    async sendBatch(events) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => {
                controller.abort();
            }, this.timeout);
            const jsonBody = JSON.stringify({ events });
            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            };
            let body = jsonBody;
            // Compress if size is over 10KB (10240 bytes)
            if (jsonBody.length > 10240) {
                try {
                    body = await gzipAsync(Buffer.from(jsonBody, "utf8"));
                    headers["Content-Encoding"] = "gzip";
                }
                catch (compressError) {
                    console.error("[LogSense] Gzip compression failed, sending uncompressed:", compressError);
                }
            }
            const response = await fetch(this.endpoint, {
                method: "POST",
                headers,
                body,
                signal: controller.signal,
            });
            clearTimeout(timer);
            if (!response.ok) {
                return {
                    success: false,
                    accepted: 0,
                    failed: events.length,
                    statusCode: response.status,
                    error: new Error(`Transport failed (${response.status})`),
                };
            }
            return {
                success: true,
                accepted: events.length,
                failed: 0,
                statusCode: response.status,
            };
        }
        catch (error) {
            return {
                success: false,
                accepted: 0,
                failed: events.length,
                error: error instanceof Error
                    ? error
                    : new Error("Unknown transport error"),
            };
        }
    }
    async close() {
        // Reserved for future use
    }
}
exports.HttpTransport = HttpTransport;
//# sourceMappingURL=http-transport.js.map