import { audioEngine } from './AudioEngine';

export interface RecordedAudioResult {
  audioDataUrl: string;
  durationSeconds: number;
  peaks: number[];
  channelFormat: 'mono';
}

export class MicRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  public async start(): Promise<void> {
    // Request single-channel MONO microphone capture just like Logic Pro Input 1 (Mono)
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

    this.chunks = [];
    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType })
      : new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        this.chunks.push(ev.data);
      }
    };

    this.startedAt = performance.now();
    this.mediaRecorder.start(120);
  }

  public async stop(): Promise<RecordedAudioResult | null> {
    const recorder = this.mediaRecorder;
    if (!recorder || recorder.state === 'inactive') {
      this.cleanupStream();
      return null;
    }

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' }));
      };
      recorder.stop();
    });

    this.cleanupStream();
    if (blob.size < 256) return null;

    const elapsedSec = Math.max(0.25, (performance.now() - this.startedAt) / 1000);
    let audioDataUrl = await blobToDataUrl(blob);
    let durationSeconds = elapsedSec;
    let peaks: number[] = Array.from({ length: 64 }, () => 0.25);

    try {
      const ctx = audioEngine.ensureContext();
      const arrayBuf = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      durationSeconds = decoded.duration;

      // Downmix any multi-channel hardware input cleanly into a true 1-channel MONO signal
      const monoSamples = downmixToMono(decoded);
      peaks = extractWaveformPeaksFromMono(monoSamples, 72);

      // Encode true 1-channel Mono WAV so playback & collaborators always receive centered mono audio
      const monoWavBlob = encodeMonoWav(monoSamples, decoded.sampleRate);
      audioDataUrl = await blobToDataUrl(monoWavBlob);
    } catch {
      // Fallback to original recorded blob if browser decode fails
    }

    return {
      audioDataUrl,
      durationSeconds,
      peaks,
      channelFormat: 'mono',
    };
  }

  private cleanupStream(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    this.mediaRecorder = null;
  }
}

function downmixToMono(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const numChannels = buffer.numberOfChannels;
  if (numChannels <= 1) {
    return buffer.getChannelData(0);
  }
  const mono = new Float32Array(length);
  const scale = 1 / numChannels;
  for (let ch = 0; ch < numChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] * scale;
    }
  }
  return mono;
}

function encodeMonoWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const dataSize = samples.length * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true); // 1 = Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to encode audio recording'));
    reader.readAsDataURL(blob);
  });
}

function extractWaveformPeaksFromMono(channel: Float32Array, bucketCount: number): number[] {
  const blockSize = Math.max(1, Math.floor(channel.length / bucketCount));
  const raw: number[] = [];
  let maxPeak = 0.01;

  for (let i = 0; i < bucketCount; i++) {
    const start = i * blockSize;
    const end = Math.min(channel.length, start + blockSize);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channel[j]);
      if (abs > peak) peak = abs;
    }
    raw.push(peak);
    if (peak > maxPeak) maxPeak = peak;
  }

  return raw.map((v) => Math.max(0.08, Math.min(1, v / maxPeak)));
}
