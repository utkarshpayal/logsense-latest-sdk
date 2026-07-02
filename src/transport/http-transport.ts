import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { Event } from "../event/types";
import {
    EventTransport,
    SendBatchResult,
} from "./transport";

const gzipAsync = promisify(gzip);

export interface HttpTransportOptions {
    endpoint: string;

    apiKey: string;

    timeout?: number;
}

export class HttpTransport implements EventTransport {
    private readonly endpoint: string;

    private readonly apiKey: string;

    private readonly timeout: number;

    constructor(options: HttpTransportOptions) {
        this.endpoint = options.endpoint;
        this.apiKey = options.apiKey;
        this.timeout = options.timeout ?? 10000;
    }

    async sendBatch(
        events: Event[],
    ): Promise<SendBatchResult> {
        try {
            const controller = new AbortController();

            const timer = setTimeout(() => {
                controller.abort();
            }, this.timeout);

            const jsonBody = JSON.stringify({ events });
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            };

            let body: string | Buffer = jsonBody;

            // Compress if size is over 10KB (10240 bytes)
            if (jsonBody.length > 10240) {
                try {
                    body = await gzipAsync(Buffer.from(jsonBody, "utf8"));
                    headers["Content-Encoding"] = "gzip";
                } catch (compressError) {
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

                    error: new Error(
                        `Transport failed (${response.status})`,
                    ),
                };
            }

            return {
                success: true,

                accepted: events.length,

                failed: 0,

                statusCode: response.status,
            };
        } catch (error) {
            return {
                success: false,

                accepted: 0,

                failed: events.length,

                error:
                    error instanceof Error
                        ? error
                        : new Error("Unknown transport error"),
            };
        }
    }

    async close(): Promise<void> {
        // Reserved for future use
    }
}