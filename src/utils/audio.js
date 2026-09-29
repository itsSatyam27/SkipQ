import { Platform, Vibration } from 'react-native';
import * as Speech from 'expo-speech';

// Universal Audio Synthesizer & Speech Announcer for chimes and buzzer alerts
// Works seamlessly across mobile (expo-speech + Vibration) and web (Web Audio + Speech Synthesis)

let audioCtx = null;

// Ensure AudioContext is unlocked on web upon the first user interaction
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
}

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
  try {
    Vibration.vibrate(100);
  } catch (e) {}
  playTone(523.25, 120, 'sine', 0.15, 0);    // C5
  playTone(659.25, 120, 'sine', 0.18, 120);  // E5
  playTone(783.99, 250, 'sine', 0.22, 240);  // G5
};

/**
 * 2. Order Ready Buzzer (Vibrant dual-frequency attention buzzer with vibration)
 */
export const playOrderReadyBuzzer = () => {
  try {
    Vibration.vibrate([0, 180, 80, 260]);
  } catch (e) {}
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
  try {
    Vibration.vibrate([0, 120, 60, 150]);
  } catch (e) {}
  playTone(659.25, 100, 'sine', 0.2, 0);
  playTone(987.77, 300, 'triangle', 0.22, 100);
};

/**
 * 4. Voice Announcer for Ready Tokens (TTS callout for canteen counters)
 */
export const announceTokenReady = (tokenNumber, shopName = 'Central Canteen') => {
  // First trigger loud buzzer + vibration
  playOrderReadyBuzzer();

  const cleanToken = String(tokenNumber || '').replace(/[^\d]/g, '') || tokenNumber;
  const text = `Attention please! Token number ${cleanToken} is ready for pickup at ${shopName}`;

  // 1. Try native expo-speech first (works reliably across iOS and Android)
  try {
    if (Speech && typeof Speech.speak === 'function') {
      Speech.speak(text, {
        language: 'en-IN',
        pitch: 1.05,
        rate: 0.95,
        onError: (err) => console.log('expo-speech error:', err)
      });
      return;
    }
  } catch (err) {
    console.log('expo-speech note:', err);
  }

  // 2. Web Speech API fallback for web browsers
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.lang = 'en-IN';
      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    console.log('Web TTS announce note:', err);
  }
};

/**
 * 5. Error / Warning Beep
 */
export const playWarningBeep = () => {
  try {
    Vibration.vibrate(250);
  } catch (e) {}
  playTone(330, 200, 'sawtooth', 0.12, 0);
  playTone(260, 250, 'sawtooth', 0.12, 180);
};

