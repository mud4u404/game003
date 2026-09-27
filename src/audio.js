// Quiet event cues only, explicitly enabled by the player. No offline replay or ambient alarm loop.
export class ClinicAudio {
  constructor(){this.enabled=false;this.lastEvent=null;this.lastCue=0;}
  async toggle(){try{this.context??=new (window.AudioContext||window.webkitAudioContext)();await this.context.resume();this.enabled=!this.enabled;if(this.enabled)this.chime(false);}catch{this.enabled=false;}}
  chime(urgent){if(!this.enabled)return;const c=this.context,at=c.currentTime;for(let i=0;i<2;i++){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=urgent?480+i*100:640-i*120;g.gain.setValueAtTime(0,at+i*.17);g.gain.linearRampToValueAtTime(.028,at+i*.17+.02);g.gain.exponentialRampToValueAtTime(.001,at+i*.17+.25);o.connect(g);g.connect(c.destination);o.start(at+i*.17);o.stop(at+i*.17+.28);}}
  observe(s,silent){
    const e=s.log[0],id=e?.id,first=this.lastEvent===null,newEvent=id!==this.lastEvent;
    const calls=s.patients.filter(p=>p.phase==='consultation'),fresh=calls.some(p=>!this.calls?.has(p.id)&&s.time-p.phaseAt<3000);
    this.calls=new Set(calls.map(p=>p.id));this.lastEvent=id;
    if(first||silent||performance.now()-this.lastCue<5000)return;
    if(fresh||newEvent&&e&&s.time-e.at<3000&&/急救|报告|复诊|回传/.test(e.title)){
      this.chime(Boolean(newEvent&&e&&/急救/.test(e.title)));this.lastCue=performance.now();
    }
  }
}
