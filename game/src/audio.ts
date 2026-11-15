import { asset } from "./assets";
type Effect = "tap" | "clay" | "brush" | "success" | "hole";
/** Original local PCM recordings, loaded after the first user gesture. */
export class AudioController {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private loop: AudioBufferSourceNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private fireNoise:AudioBufferSourceNode|null=null;
  private fireGain:GainNode|null=null;
  private fireFilter:BiquadFilterNode|null=null;
  private digging = false;
  muted = localStorage.getItem("togi-muted") === "true";
  get excavation() {
    return this.digging;
  }
  set excavation(value: boolean) {
    if (value === this.digging) return;
    this.digging = value;
    this.playMusic();
  }
  start() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.35;
      this.musicGain.connect(this.master);
      document.addEventListener("visibilitychange", this.visibility);
      void Promise.all(
        [
          "workshop",
          "excavation",
          "tap",
          "clay",
          "brush",
          "success",
          "hole",
        ].map(async (name) => {
          const response = await fetch(asset(`audio/${name}.wav`));
          if (!response.ok) throw Error("audio");
          this.buffers.set(
            name,
            await this.ctx!.decodeAudioData(await response.arrayBuffer()),
          );
        }),
      )
        .then(() => this.playMusic())
        .catch(() => {});
    }
    void this.ctx.resume();
  }
  private visibility = () => {
    if (document.hidden) void this.ctx?.suspend();
    else if (this.ctx) void this.ctx.resume();
  };
  toggle() {
    this.muted = !this.muted;
    localStorage.setItem("togi-muted", String(this.muted));
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : 0.55,
        this.ctx!.currentTime,
        0.1,
      );
  }
  private playMusic() {
    if (!this.ctx || !this.musicGain) return;
    const buffer = this.buffers.get(this.digging ? "excavation" : "workshop");
    if (!buffer) return;
    this.loop?.stop();
    this.loop?.disconnect();
    this.loop = this.ctx.createBufferSource();
    this.loop.buffer = buffer;
    this.loop.loop = true;
    this.loop.connect(this.musicGain);
    this.loop.start();
  }
  effect(kind: Effect = "tap") {
    if (!this.ctx || !this.master) return;
    const buffer = this.buffers.get(kind);
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.master);
    source.start();
    source.onended = () => source.disconnect();
  }
  firing(heat:number){
    if(!this.ctx||!this.master)return;
    if(heat<=0){this.fireNoise?.stop();this.fireNoise?.disconnect();this.fireFilter?.disconnect();this.fireGain?.disconnect();this.fireNoise=null;this.fireGain=null;this.fireFilter=null;return;}
    if(!this.fireNoise){
      const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.4;
      this.fireNoise=this.ctx.createBufferSource();this.fireNoise.buffer=buffer;this.fireNoise.loop=true;
      this.fireFilter=this.ctx.createBiquadFilter();this.fireFilter.type='lowpass';this.fireFilter.frequency.value=900;
      this.fireGain=this.ctx.createGain();this.fireGain.gain.value=0;
      this.fireNoise.connect(this.fireFilter);this.fireFilter.connect(this.fireGain);this.fireGain.connect(this.master);this.fireNoise.start();
    }
    this.fireGain!.gain.setTargetAtTime(heat*.22,this.ctx.currentTime,.12);
  }
  dispose() {
    this.firing(0);
    document.removeEventListener("visibilitychange", this.visibility);
    this.loop?.stop();
    void this.ctx?.close();
  }
}
