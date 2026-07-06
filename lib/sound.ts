// Sound manager: short UI effects + an optional looping music bed.
//
// - Effects and music have separate on/off switches, persisted per
//   device in AsyncStorage (server profile doesn't need to know).
// - Effects default ON, music defaults OFF (autoplaying music on
//   first launch is hostile).
// - Every native call is wrapped so a missing native module (or a
//   race during teardown) degrades to silence instead of a crash.
// - Sounds respect the iOS silent switch (playsInSilentMode: false):
//   UI feedback shouldn't override a muted phone, per Apple HIG.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';

const SFX_KEY = 'yourlevel:sfx-enabled';
const MUSIC_KEY = 'yourlevel:music-enabled';

/* eslint-disable @typescript-eslint/no-require-imports */
const SFX_SOURCES = {
  tap:      require('@/assets/sounds/tap.wav'),
  complete: require('@/assets/sounds/complete.wav'),
  levelup:  require('@/assets/sounds/levelup.wav'),
  unlock:   require('@/assets/sounds/unlock.wav'),
} as const;
const MUSIC_SOURCE = require('@/assets/sounds/chill-loop.wav');
/* eslint-enable @typescript-eslint/no-require-imports */

export type SfxName = keyof typeof SFX_SOURCES;

let sfxEnabled = true;
let musicEnabled = false;
let initialized = false;

const sfxPlayers: Partial<Record<SfxName, AudioPlayer>> = {};
let musicPlayer: AudioPlayer | null = null;

/** Load persisted toggles + set the audio session mode. Idempotent. */
export async function initSound(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const [sfx, music] = await Promise.all([
      AsyncStorage.getItem(SFX_KEY),
      AsyncStorage.getItem(MUSIC_KEY),
    ]);
    sfxEnabled = sfx !== 'false';        // default true
    musicEnabled = music === 'true';     // default false
    await setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
    });
    if (musicEnabled) startMusic();
  } catch (err) {
    console.warn('[sound] init failed', err);
  }
}

export function getSfxEnabled(): boolean {
  return sfxEnabled;
}

export function getMusicEnabled(): boolean {
  return musicEnabled;
}

export async function setSfxEnabled(on: boolean): Promise<void> {
  sfxEnabled = on;
  try {
    await AsyncStorage.setItem(SFX_KEY, on ? 'true' : 'false');
  } catch {
    // non-fatal
  }
}

export async function setMusicEnabled(on: boolean): Promise<void> {
  musicEnabled = on;
  try {
    await AsyncStorage.setItem(MUSIC_KEY, on ? 'true' : 'false');
  } catch {
    // non-fatal
  }
  if (on) startMusic();
  else stopMusic();
}

/** Fire-and-forget effect. No-op when effects are off. */
export function play(name: SfxName): void {
  if (!sfxEnabled) return;
  try {
    let p = sfxPlayers[name];
    if (!p) {
      p = createAudioPlayer(SFX_SOURCES[name]);
      sfxPlayers[name] = p;
    }
    p.seekTo(0);
    p.play();
  } catch (err) {
    console.warn('[sound] play failed', name, err);
  }
}

function startMusic(): void {
  try {
    if (!musicPlayer) {
      musicPlayer = createAudioPlayer(MUSIC_SOURCE);
      musicPlayer.loop = true;
      musicPlayer.volume = 0.45;
    }
    musicPlayer.play();
  } catch (err) {
    console.warn('[sound] music start failed', err);
  }
}

function stopMusic(): void {
  try {
    musicPlayer?.pause();
  } catch {
    // non-fatal
  }
}
