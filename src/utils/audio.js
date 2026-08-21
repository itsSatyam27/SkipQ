import { Platform } from 'react-native';

// Universal Web Audio API Synthesizer for chimes and buzzer alerts
// Works seamlessly in browsers (Expo Web) and gracefully handles environments without window.AudioContext

let audioCtx = null;

const getAudioContext = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

/**
 * Plays a tone at given frequency for duration with attack/decay envelope
 */
const playTone = (freq, durationMs, type = 'sine', gainVal = 0.15, delayMs = 0) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    setTimeout(() => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + durationMs / 1000 + 0.05);
    }, delayMs);
  } catch (e) {
    // Ignore audio autoplay restrictions
  }
};

/**
 * 1. Order Placed Chime (Pleasant upward 3-tone chime)
 */
export const playOrderPlacedSound = () => {
  playTone(523.25, 120, 'sine', 0.15, 0);    // C5
  playTone(659.25, 120, 'sine', 0.18, 120);  // E5
  playTone(783.99, 250, 'sine', 0.22, 240);  // G5
};

/**
 * 2. Order Ready Buzzer (Vibrant dual-frequency attention buzzer)
 */
export const playOrderReadyBuzzer = () => {
  // First pulse
  playTone(880, 160, 'triangle', 0.25, 0);
  playTone(1174.66, 160, 'sine', 0.2, 0);

  // Second pulse
  playTone(880, 220, 'triangle', 0.28, 200);
  playTone(1318.51, 240, 'sine', 0.25, 200);
};

/**
 * 3. New POS Ticket Chime (Kitchen alert bell)
 */
export const playNewTicketChime = () => {
  playTone(659.25, 100, 'sine', 0.2, 0);
  playTone(987.77, 300, 'triangle', 0.22, 100);
};

/**
 * 4. Error / Warning Beep
 */
export const playWarningBeep = () => {
  playTone(330, 200, 'sawtooth', 0.12, 0);
  playTone(260, 250, 'sawtooth', 0.12, 180);
};
