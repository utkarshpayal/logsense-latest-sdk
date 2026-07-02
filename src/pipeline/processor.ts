import { Event } from "../event/types";

export interface EventProcessor {
    /**
     * Process an event.
     *
     * Return:
     * - Event => continue
     * - null => drop event
     */
    process(
        event: Event,
    ): Promise<Event | null> | Event | null;
}