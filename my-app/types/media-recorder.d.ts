interface MediaRecorderOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
  videoBitsPerSecond?: number;
  bitsPerSecond?: number;
}

interface MediaRecorderDataAvailableEvent extends Event {
  data: Blob;
}

interface MediaRecorder extends EventTarget {
  readonly state: 'inactive' | 'recording' | 'paused';
  readonly stream: MediaStream;
  readonly mimeType: string;
  ondataavailable: ((event: MediaRecorderDataAvailableEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onpause: ((event: Event) => void) | null;
  onresume: ((event: Event) => void) | null;
  onstart: ((event: Event) => void) | null;
  onstop: ((event: Event) => void) | null;
  pause(): void;
  resume(): void;
  start(timeslice?: number): void;
  stop(): void;
  requestData(): void;
}

declare global {
  interface Window {
    MediaRecorder: {
      new(stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
      isTypeSupported(type: string): boolean;
    };
  }
} 