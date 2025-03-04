import * as ort from 'onnxruntime-node';
import { EventEmitter } from 'events';

export interface VoiceActivityDetectorOptions {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  frameDurationMs?: number;
  speechThreshold?: number;
  silenceDebounceMs?: number;
}

export class VoiceActivityDetector extends EventEmitter {
  modelPath: string;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  bytesPerSample: number;
  frameDurationMs: number;
  numSamplesPerFrame: number;
  chunkBytes: number;
  speechThreshold: number;
  silenceDebounceMs: number;
  currentState: ort.Tensor;
  sr: ort.Tensor;
  wasSpeaking: boolean;
  speakingStart: number;
  silenceTimeout: ReturnType<typeof setTimeout> | null;
  session: ort.InferenceSession | null;

  constructor(options: VoiceActivityDetectorOptions = {}) {
    super();
    this.modelPath = `${__dirname}/assets/silero_vad.onnx`;
    this.sampleRate = options.sampleRate ?? 16000;
    this.channels = options.channels ?? 1;
    this.bitsPerSample = options.bitsPerSample ?? 16;
    this.bytesPerSample = this.bitsPerSample / 8;

    this.frameDurationMs = options.frameDurationMs ?? 30;
    this.numSamplesPerFrame = Math.floor(this.sampleRate * (this.frameDurationMs / 1000));
    this.chunkBytes = this.numSamplesPerFrame * this.bytesPerSample;

    this.speechThreshold = options.speechThreshold ?? 0.5;
    this.silenceDebounceMs = options.silenceDebounceMs ?? 300;

    this.currentState = new ort.Tensor('float32', new Float32Array(2 * 1 * 128).fill(0), [2, 1, 128]);
    this.sr = new ort.Tensor('int64', [BigInt(this.sampleRate)], [1]);

    this.wasSpeaking = false;
    this.speakingStart = 0;
    this.silenceTimeout = null;
    this.session = null;
  }

  async init() {
    try {
      console.log('Loading model...');
      this.session = await ort.InferenceSession.create(this.modelPath);
      console.log('Model loaded.');
    } catch (e) {
      console.error('Error while loading the model:', e);
      throw e;
    }
  }

  async processAudioChunk(chunk: Buffer) {
    if (!this.session) {
      console.error('Model session not loaded');
      return;
    }

    const int16Array = new Int16Array(chunk.buffer, chunk.byteOffset, this.numSamplesPerFrame);
    const float32Array = Float32Array.from(int16Array, (sample) => sample / 32768);

    const tensor = new ort.Tensor('float32', float32Array, [1, this.numSamplesPerFrame]);

    try {
      const feeds = {
        input: tensor,
        state: this.currentState,
        sr: this.sr,
      };
      const results = await this.session.run(feeds);

      this.currentState = results['stateN'];

      const outputTensor = results['output'];
      const score = outputTensor.data[0];

      if (score > this.speechThreshold) {
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
          this.silenceTimeout = null;
        }
        if (!this.wasSpeaking) {
          this.speakingStart = Date.now();
          this.wasSpeaking = true;
          this.emit('speechStart', this.speakingStart);
        }
      } else {
        if (this.wasSpeaking && !this.silenceTimeout) {
          this.silenceTimeout = setTimeout(() => {
            const speakingEnd = Date.now();
            const duration = speakingEnd - this.speakingStart;
            this.emit('speechEnd', {
              start: this.speakingStart,
              end: speakingEnd,
              duration: duration,
            });
            this.wasSpeaking = false;
            this.silenceTimeout = null;
          }, this.silenceDebounceMs);
        }
      }
    } catch (err) {
      console.error('Error during inference:', err);
    }
  }
}
