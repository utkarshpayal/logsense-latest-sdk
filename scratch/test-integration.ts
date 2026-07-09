import { logsense } from '../src/index';
import { EventCategory, EventStatus, Severity } from '../src/event/constants';

async function run() {
  console.log("Initializing LogSense SDK for integration test...");
  
  const client = logsense.init({
    endpoint: 'http://localhost:5000/v1/events',
    apiKey: 'lsk_8e256d7093ee3a80fd2b403c79818d7cdc341ef13439137c1ae2dfcdf2926009',
    service: 'integration-test-service',
    environment: 'development',
    organizationId: '3bcea9da-9188-43a2-9df9-56bd2479f18a',
    projectId: '09cc189f-89ed-4bd0-8fe7-81299feb2242',
    batchSize: 1, // Flush immediately
    flushInterval: 50,
    debug: true,
  });

  console.log("Resolved config:", client.config);
  console.log("Queue size at start:", client.collector.queueSize());

  console.log("Sending a custom event...");
  await logsense.track({
    category: EventCategory.CUSTOM,
    type: 'integration.test',
    action: EventStatus.SUCCESS,
    severity: Severity.INFO,
    message: 'Integration test event from SDK to Local Server',
    metadata: {
      framework: 'express',
      testRunId: 'run-12345'
    }
  });

  console.log("Queue size after custom event:", client.collector.queueSize());

  console.log("Sending an onboarding event...");
  await logsense.onboarding.userOnboarded(
    'user_onboarded_integration_test',
    'completed',
    {
      latitude: 40.7128,
      longitude: -74.0060,
      city: 'New York',
      country: 'USA',
      region: 'NY'
    },
    {
      source: 'scratch-integration-test'
    }
  );

  console.log("Queue size after onboarding event:", client.collector.queueSize());

  console.log("Forcing manual flush...");
  await client.collector.flush();

  console.log("Queue size after forced flush:", client.collector.queueSize());

  console.log("Waiting for remaining events to flush...");
  await new Promise((r) => setTimeout(r, 2000));

  console.log("Shutting down SDK client...");
  await logsense.shutdown();
  console.log("Integration test finished!");
}

run().catch(console.error);
