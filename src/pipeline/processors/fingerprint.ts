import { Event } from "../../event/types";
import { EventProcessor } from "../processor";
import { FingerprintGenerator } from "../../fingerprinting/fingerprint";

export class FingerprintProcessor implements EventProcessor {
    process(event: Event): Event {
        // Automatically generate fingerprint for exceptions and database/external HTTP failures
        if (
            event.category === "exception" ||
            (event.category === "database" && event.database?.success === false) ||
            (event.category === "external" && event.external?.success === false)
        ) {
            if (!event.metadata) {
                event.metadata = {};
            }
            event.metadata.fingerprint = FingerprintGenerator.generate(event);
        }
        return event;
    }
}
