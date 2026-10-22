// Encodage vidéo image par image (WebCodecs) : MP4 H.264 si le moteur le permet, sinon WebM VP9.
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from 'webm-muxer';

export interface AudioSpec { buffer: AudioBuffer; volume: number }
export interface VideoSpec { width: number; height: number; fps: number; frames: number; audio?: AudioSpec }
export interface VideoResult { blob: Blob; ext: 'mp4' | 'webm'; codec: string; audio: boolean }

const CANDIDATES: { codec: string; kind: 'mp4' | 'webm' }[] = [
  { codec: 'avc1.64002A', kind: 'mp4' }, { codec: 'avc1.4D002A', kind: 'mp4' }, { codec: 'avc1.42002A', kind: 'mp4' },
  { codec: 'vp09.00.40.08', kind: 'webm' }, { codec: 'vp8', kind: 'webm' },
];

export const videoSupported = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

/** Codec audio disponible pour ce conteneur (AAC puis Opus en MP4, Opus en WebM), ou null : la vidéo sera alors muette. */
async function pickAudio(mp4: boolean, sampleRate: number, channels: number) {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return null;
  const cands = mp4 ? [{ codec: 'mp4a.40.2', mux: 'aac' as const }, { codec: 'opus', mux: 'opus' as const }] : [{ codec: 'opus', mux: 'A_OPUS' as const }];
  for (const c of cands) {
    try { const r = await AudioEncoder.isConfigSupported({ codec: c.codec, sampleRate, numberOfChannels: channels, bitrate: 160000 }); if (r.supported) return c; } catch { /* suivant */ }
  }
  return null;
}
/** Encode la bande son (de 0 à `seconds`) et l'ajoute au conteneur. */
async function encodeAudio(spec: AudioSpec, seconds: number, pick: { codec: string }, add: (c: EncodedAudioChunk, m?: EncodedAudioChunkMetadata) => void) {
  const { buffer, volume } = spec, ch = Math.min(2, buffer.numberOfChannels), sr = buffer.sampleRate;
  let failure: Error | null = null;
  const enc = new AudioEncoder({ output: (c, m) => add(c, m), error: e => { failure = e instanceof Error ? e : new Error(String(e)); } });
  enc.configure({ codec: pick.codec, sampleRate: sr, numberOfChannels: ch, bitrate: 160000 });
  const total = Math.round(seconds * sr), block = 4800, src = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  for (let at = 0; at < total; at += block) {
    if (failure) throw failure;
    const n = Math.min(block, total - at), data = new Float32Array(n * ch);
    for (let c = 0; c < ch; c++) {
      const s = ch === 1 && src.length > 1 ? null : src[Math.min(c, src.length - 1)];   // mono demandé pour une source multicanal : moyenne
      for (let i = 0; i < n; i++) { const j = at + i; data[c * n + i] = j < buffer.length ? (s ? s[j] : src.reduce((a, d) => a + d[j], 0) / src.length) * volume : 0; }
    }
    const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round((at / sr) * 1e6), data });
    enc.encode(ad); ad.close();
    while (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 2));
  }
  await enc.flush(); enc.close();
  if (failure) throw failure;
}

/** Premier codec réellement disponible pour cette taille et cette cadence. */
async function pickCodec(spec: VideoSpec, bitrate: number) {
  for (const c of CANDIDATES) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec: c.codec, width: spec.width, height: spec.height, bitrate, framerate: spec.fps });
      if (r.supported) return c;
    } catch { /* codec inconnu : suivant */ }
  }
  return null;
}

/**
 * `getFrame(i)` doit renvoyer le canvas de l'image n° i (taille width×height). L'encodage est déterministe :
 * chaque image est dessinée à l'instant i/fps, quelle que soit la vitesse de la machine.
 */
export async function encodeVideo(
  spec: VideoSpec,
  getFrame: (i: number) => HTMLCanvasElement | Promise<HTMLCanvasElement>,
  onProgress: (done: number) => void,
  cancelled: () => boolean,
): Promise<VideoResult | null> {
  if (!videoSupported()) throw new Error("cette fenêtre ne sait pas encoder de vidéo (WebCodecs absent)");
  const bitrate = Math.round(spec.width * spec.height * spec.fps * 0.15);
  const pick = await pickCodec(spec, bitrate);
  if (!pick) throw new Error('aucun codec vidéo disponible pour cette taille');
  const mp4 = pick.kind === 'mp4';
  const aSpec = spec.audio, aCh = aSpec ? Math.min(2, aSpec.buffer.numberOfChannels) : 0;
  const aPick = aSpec ? await pickAudio(mp4, aSpec.buffer.sampleRate, aCh) : null;
  const aOpt = aPick && aSpec ? { codec: aPick.mux, numberOfChannels: aCh, sampleRate: aSpec.buffer.sampleRate } : undefined;
  const mux = mp4
    ? new Mp4Muxer({ target: new Mp4Target(), video: { codec: 'avc', width: spec.width, height: spec.height }, ...(aOpt ? { audio: aOpt as { codec: 'aac' | 'opus'; numberOfChannels: number; sampleRate: number } } : {}), fastStart: 'in-memory' })
    : new WebmMuxer({ target: new WebmTarget(), video: { codec: pick.codec === 'vp8' ? 'V_VP8' : 'V_VP9', width: spec.width, height: spec.height, frameRate: spec.fps }, ...(aOpt ? { audio: aOpt as { codec: 'A_OPUS'; numberOfChannels: number; sampleRate: number } } : {}) });
  if (aSpec && aPick) {   // la bande son d'abord (rapide), puis les images
    await encodeAudio(aSpec, spec.frames / spec.fps, aPick, (c, m) => (mux as { addAudioChunk(c: EncodedAudioChunk, m?: EncodedAudioChunkMetadata): void }).addAudioChunk(c, m));
  }
  let failure: Error | null = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => (mux as { addVideoChunk(c: EncodedVideoChunk, m?: EncodedVideoChunkMetadata): void }).addVideoChunk(chunk, meta),
    error: e => { failure = e instanceof Error ? e : new Error(String(e)); },
  });
  enc.configure({ codec: pick.codec, width: spec.width, height: spec.height, bitrate, framerate: spec.fps, ...(mp4 ? { avc: { format: 'avc' as const } } : {}) });
  const keyEvery = Math.max(1, Math.round(spec.fps * 2));
  for (let i = 0; i < spec.frames; i++) {
    if (cancelled()) { enc.close(); return null; }
    if (failure) throw failure;
    const canvas = await getFrame(i);
    const vf = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / spec.fps), duration: Math.round(1e6 / spec.fps) });
    enc.encode(vf, { keyFrame: i % keyEvery === 0 });
    vf.close();
    while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));   // ne pas empiler les images en mémoire
    if (i % 4 === 0) { onProgress(i + 1); await new Promise(r => setTimeout(r, 0)); }
  }
  await enc.flush(); enc.close();
  if (failure) throw failure;
  mux.finalize();
  const buf = (mux.target as Mp4Target | WebmTarget).buffer;
  return { blob: new Blob([buf], { type: mp4 ? 'video/mp4' : 'video/webm' }), ext: mp4 ? 'mp4' : 'webm', codec: pick.codec, audio: !!aPick };
}
