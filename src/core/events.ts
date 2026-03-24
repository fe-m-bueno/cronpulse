import { EventEmitter } from "node:events";

export interface RunOutputEvent {
	runId: string;
	jobId: string;
	stream: "stdout" | "stderr";
	data: string;
}

export interface RunCompleteEvent {
	runId: string;
	jobId: string;
	exitCode: number | null;
	status: "succeeded" | "failed";
}

export interface JobStatusChangeEvent {
	jobId: string;
	status: string;
}

export interface JobsUpdatedEvent {
	jobCount: number;
}

// Central event bus
const bus = new EventEmitter();
bus.setMaxListeners(100);

export const eventBus = bus;
