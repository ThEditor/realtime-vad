# Realtime VAD

[![npm realtime-vad](https://img.shields.io/npm/v/realtime-vad?label=npm)](https://www.npmjs.com/package/realtime-vad) [![github realtime-vad](https://img.shields.io/github/package-json/v/ThEditor/realtime-vad?label=github)](https://github.com/ThEditor/realtime-vad/)


Realtime VAD is a realtime voice activity detection library for Node.js environments. It utilizes the [Silero VAD](https://github.com/snakers4/silero-vad) and [onnxruntime-node](https://www.npmjs.com/package/onnxruntime-node) libraries to perform efficient speech detection.

## Quickstart

Below is an example demonstrating how to use the library:

```js
import { VoiceActivityDetector } from "realtime-vad";
import record from "node-record-lpcm16";

const SAMPLE_RATE = 16000;
const CHANNELS = 1;

async function main() {
  const vad = new VoiceActivityDetector({
    sampleRate: SAMPLE_RATE,
    channels: CHANNELS,
    frameDurationMs: 30,
    speechThreshold: 0.5,
    silenceDebounceMs: 600,
  });

  // Load the model
  await vad.init();

  // Listen to speech events
  vad.on("speechStart", (startTime) => {
    console.log("Speech start detected at", startTime);
  });

  vad.on("speechEnd", ({ start, end, duration }) => {
    console.log("Speech detected from", start, "to", end, "for", duration, "ms");
  });

  // Start recording from microphone
  const recording = record.record({
    sampleRate: SAMPLE_RATE,
    channels: CHANNELS,
    threshold: 0,
    audioType: "wav",
  });
  const micStream = recording.stream();

  let audioBuffer = Buffer.alloc(0);

  micStream.on("data", async (data) => {
    audioBuffer = Buffer.concat([audioBuffer, data]);
    while (audioBuffer.length >= vad.chunkBytes) {
      const frame = audioBuffer.subarray(0, vad.chunkBytes);
      audioBuffer = audioBuffer.subarray(vad.chunkBytes);
      await vad.processAudioChunk(frame);
    }
  });

  micStream.on("error", (err) => {
    console.error("Error with microphone stream:", err);
  });

  console.log("Listening for speech... Press CTRL+C to stop.");
}

main();
```

## Installation

1. **Clone the repository**  
   ```bash
   git clone https://github.com/ThEditor/realtime-vad.git
   cd realtime-vad
   ```

2. **Install dependencies**  
   ```bash
   pnpm install
   ```

3. **Build the project**
   ```bash
   pnpm build
   ```

## Background

This project started as an extension of [ricky0123/vad-node](https://github.com/ricky0123/vad-node) to add real-time voice activity detection in Node.js (You can checkout the archived repository [here](https://github.com/ThEditor/vad)).

As of October 2024, @ricky0123 has dropped support for [ricky0123/vad-node](https://github.com/ricky0123/vad-node) in order to focus on [ricky0123/vad-web](https://github.com/ricky0123/vad-web). Following this change and inspired from @ricky0123, I've created this as a standalone voice activity detection library.

## License

This project is licensed under the MIT License.

## References

<a id="1">[1]</a>
Silero Team. (2021).
Silero VAD: pre-trained enterprise-grade Voice Activity Detector (VAD), Number Detector and Language Classifier.
GitHub, GitHub repository, https://github.com/snakers4/silero-vad, hello@silero.ai.

