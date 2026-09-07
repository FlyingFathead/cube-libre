#!/usr/bin/env python3
"""Synthesize a soft surf-like noise wash for the final portal's white arrival.

Python standard library and FFmpeg only. No voices, samples or online services.
The low, middle and high bands swell together, then soften as the wave recedes.
"""
import hashlib
import json
import math
import random
import subprocess
import sys
import tempfile
import wave
from array import array
from pathlib import Path

from build_shutter_audio import bandpass

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100
DURATION = 3.3


def synthesize():
    rng = random.Random(28203)
    noise = [rng.uniform(-1, 1) for _ in range(round(RATE * DURATION))]
    low = bandpass(noise, 230, .55)
    middle = bandpass(noise, 950, .55)
    high = bandpass(noise, 3300, .6)
    dry = []
    for i in range(len(noise)):
        t = i / RATE
        q = min(1, t / 2.7)  # Recede before the final half-second of blank white.
        envelope = math.sin(math.pi * q) ** 1.6
        # Broad noise, no pitched oscillator: an approaching and receding wash.
        texture = .87 + .08 * math.sin(t * 13.1 + math.sin(t * 3.7)) + .05 * math.sin(t * 31.3)
        sample = .55 * middle[i] + (.20 + .20 * q) * low[i] + .22 * (1 - q) ** 1.5 * high[i]
        dry.append(sample * envelope * texture)
    wet = dry[:]
    for delay, gain in [(.029, .14), (.061, .10), (.109, .06)]:
        shift = round(delay * RATE)
        for i in range(shift, len(wet)):
            wet[i] += dry[i - shift] * gain * min(1, (len(wet) - 1 - i) / (.3 * RATE))
    peak = max(map(abs, wet))
    return [sample * .55 / peak for sample in wet]


def main():
    out = ROOT / 'web' / 'assets' / 'audio'
    name = 'arrival_water'
    samples = synthesize()
    with tempfile.TemporaryDirectory(prefix='cube-libre-arrival-') as temporary:
        source = Path(temporary) / f'{name}.wav'
        pcm = array('h', (round(x * 32767) for x in samples))
        if sys.byteorder != 'little':
            pcm.byteswap()
        with wave.open(str(source), 'wb') as wav:
            wav.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
            wav.writeframes(pcm.tobytes())
        for ext, codec in [('ogg', ['-c:a', 'libvorbis', '-q:a', '5']),
                           ('mp3', ['-c:a', 'libmp3lame', '-b:a', '128k'])]:
            subprocess.run(['ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error',
                            '-i', str(source), *codec, str(out / f'{name}.{ext}')], check=True)
        path = out / 'manifest.json'
        manifest = json.loads(path.read_text())
        manifest[name] = {'duration': len(samples) / RATE, 'ogg': f'{name}.ogg', 'mp3': f'{name}.mp3',
                          'source_wav': source.name, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                          'generator': 'tools/build_arrival_audio.py', 'edition': 'web'}
        path.write_text(json.dumps(manifest, indent=2) + '\n')
    rms = math.sqrt(sum(x * x for x in samples) / len(samples))
    print(f'{name}: {len(samples)/RATE:.2f}s, peak 0.55, RMS {rms:.3f}; Ogg + MP3')


if __name__ == '__main__':
    main()
