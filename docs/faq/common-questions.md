# Frequently Asked Questions

This page answers common questions about the LogSense SDK architecture, performance, and integrations.

---

# 1. Performance and Ingestion Overhead

### What is the performance overhead of the SDK?
The SDK is designed to minimize application overhead:
*   **Logging Call Overhead**: Emitting a log via `logger.info()` is an in-memory operation that takes less than `3` microseconds.
*   **Event Loop Block Time**: Logging operations are entirely non-blocking. Event serializations and queue flushes run asynchronously using internal ticks.
*   **Network Ingestion Overhead**: Network requests are managed in the background by the `BatchManager`. The HTTP Keep-Alive transport minimizes TCP handshake latency.

### How much memory does the queue consume?
A memory queue containing `10,000` events of average size consumes approximately `15` to `25` megabytes of heap memory. You can set memory limits using the `maxQueueSize` parameter.

---

# 2. Comparing LogSense to Winston, Sentry, and OpenTelemetry

### Can I use LogSense alongside Winston or Bunyan?
Yes. If your application already uses Winston, you can write a custom Winston transport that forwards logs to the LogSense SDK. This allows you to adopt LogSense without rewriting your existing logging code.

### How does LogSense differ from Sentry?
*   **Sentry** is primarily an error tracking platform. It captures stack traces and breadcrumbs when exceptions occur, but is not designed for high-throughput structured logs.
*   **LogSense** is an all-in-one observability pipeline. It captures structured application logs, database query durations, HTTP requests, and system metrics, in addition to handling exception trace fingerprinting.

### How does LogSense relate to OpenTelemetry?
*   **OpenTelemetry** is an open-source standard for generating and collecting telemetry data.
*   **LogSense** is a lightweight, zero-configuration SDK designed for quick, out-of-the-box integration in Node.js applications. It handles context propagation, batching, and transport internally, removing the need to run separate collector agents.

---

# 3. Integrations with Other Web Frameworks

### Does the SDK support NestJS or Fastify?
Yes. The SDK can be used in any Node.js framework. While the pre-built `logsenseMiddleware` is designed for Express, you can write custom middleware for Fastify, NestJS, or Koa by calling `contextStore.run()` to manage trace contexts and capturing events manually.
Refer to the **[Processors & Plugins Guide](../advanced/custom-plugins-and-processors.md)** for patterns on implementing custom framework middleware.
