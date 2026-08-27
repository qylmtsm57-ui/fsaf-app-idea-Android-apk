// Web Audio API notification sound generator for Android-like ringtones and alert chimes

class SoundService {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // Load sound preference from localStorage
    const saved = localStorage.getItem('freshstock_sound_enabled');
    this.soundEnabled = saved !== null ? JSON.parse(saved) : true;
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    localStorage.setItem('freshstock_sound_enabled', JSON.stringify(enabled));
  }

  private getAudioContext(): AudioContext | null {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Play Android Notification Chime (2 or 3 pleasant tones)
   */
  public playNotificationChime(): void {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // High pleasant marimba / Android chime
      const notes = [
        { freq: 587.33, start: 0, dur: 0.12 },    // D5
        { freq: 880.00, start: 0.10, dur: 0.15 },  // A5
        { freq: 1174.66, start: 0.22, dur: 0.28 }  // D6
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.35, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  /**
   * Play Urgent Alarm Ring (Alarm / Urgent Expiry Ring)
   */
  public playUrgentAlarm(): void {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // 2 quick pulses
      [0, 0.22, 0.44].forEach((pulseStart) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now + pulseStart); // A5
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + pulseStart + 0.12); // C6

        gain.gain.setValueAtTime(0.001, now + pulseStart);
        gain.gain.exponentialRampToValueAtTime(0.3, now + pulseStart + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + pulseStart + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + pulseStart);
        osc.stop(now + pulseStart + 0.2);
      });
    } catch (e) {
      console.warn('Audio alarm error', e);
    }
  }

  /**
   * Success / Save Beep
   */
  public playSuccessTone(): void {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, start: 0, dur: 0.1 },   // C5
        { freq: 659.25, start: 0.08, dur: 0.15 } // E5
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.2, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      });
    } catch (e) {
      console.warn('Audio tone error', e);
    }
  }

  /**
   * Play specific ringtone sound preset
   */
  public playRingtone(type: 'marimba' | 'urgent' | 'chime' | 'bell' | 'beep'): void {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      if (type === 'urgent') {
        this.playUrgentAlarm();
      } else if (type === 'marimba') {
        this.playNotificationChime();
      } else if (type === 'chime') {
        // Clear triple crystal chime
        const notes = [
          { freq: 784.00, start: 0, dur: 0.2 },     // G5
          { freq: 987.77, start: 0.12, dur: 0.25 }, // B5
          { freq: 1318.51, start: 0.24, dur: 0.35 } // E6
        ];
        notes.forEach(({ freq, start, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + start);
          gain.gain.setValueAtTime(0.001, now + start);
          gain.gain.exponentialRampToValueAtTime(0.3, now + start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + start);
          osc.stop(now + start + dur + 0.05);
        });
      } else if (type === 'bell') {
        // Bell ring
        [0, 0.15].forEach((offset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1046.50, now + offset); // C6
          gain.gain.setValueAtTime(0.001, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.4);
        });
      } else if (type === 'beep') {
        // Digital soft double beep
        [0, 0.12].forEach((offset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(1200, now + offset);
          gain.gain.setValueAtTime(0.001, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.08, now + offset + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.1);
        });
      }
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }
}

export const soundService = new SoundService();
