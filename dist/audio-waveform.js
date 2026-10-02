import {Input,ALL_FORMATS,BlobSource,UrlSource,AudioSampleSink} from './vendor/mediabunny.mjs';
const cache=new WeakMap(),urlCache=new Map();let queue=Promise.resolve();
// Retain only 4096 peak bins. Decoded samples are closed immediately.
export function waveformFor(file,url){
 if(!file&&!url)return Promise.resolve(null);const store=file?cache:urlCache,key=file||url;if(store.has(key))return store.get(key);
 const pending=queue.then(async()=>{const input=new Input({formats:ALL_FORMATS,source:file?new BlobSource(file):new UrlSource(url)});try{const track=await input.getPrimaryAudioTrack();if(!track||!await track.canDecode())return null;const duration=await input.computeDuration(),peaks=new Float32Array(4096),sink=new AudioSampleSink(track);for await(const sample of sink.samples()){try{const data=new Float32Array(sample.numberOfFrames);sample.copyTo(data,{planeIndex:0,format:'f32-planar'});for(let i=0;i<data.length;i++){const bin=Math.min(4095,Math.max(0,Math.floor((sample.timestamp+i/sample.sampleRate)/duration*4096)));peaks[bin]=Math.max(peaks[bin],Math.abs(data[i]))}}finally{sample.close()}}let maximum=0;for(const peak of peaks)maximum=Math.max(maximum,peak);return{peaks,duration,maximum}}finally{input.dispose()}}).catch(()=>null);queue=pending.then(()=>{});if(!file&&urlCache.size>=32)urlCache.delete(urlCache.keys().next().value);store.set(key,pending);return pending;
}
