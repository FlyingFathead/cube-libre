#!/usr/bin/env python3
"""Synthesize CHANGE 1's electric shutter and air-release sounds.

Uses Python's standard library and FFmpeg. No online service or sampled recording.
The reproducible WAV sources are temporary; Ogg and MP3 are committed for playback.
"""
import hashlib
import json
import math
import random
import subprocess
import tempfile
import wave
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100


def bandpass(samples, frequency, q=.8):
    w = 2 * math.pi * frequency / RATE
    alpha = math.sin(w) / (2 * q)
    b0, b2 = alpha / (1 + alpha), -alpha / (1 + alpha)
    a1, a2 = -2 * math.cos(w) / (1 + alpha), (1 - alpha) / (1 + alpha)
    x1 = x2 = y1 = y2 = 0.
    output = []
    for x in samples:
        y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2
        output.append(y)
        x2, x1, y2, y1 = x1, x, y1, y
    return output


def synthesize(name):
    rng = random.Random(22001 if name == 'shutter_close' else 22002)
    duration = .56 if name == 'shutter_close' else .72
    noise = [rng.uniform(-1, 1) for _ in range(round(RATE * duration))]
    high = bandpass(noise, 3200, .65)
    low = bandpass(noise, 600, .7)
    out = []
    phase = 0.
    for i, n in enumerate(noise):
        t = i / RATE
        u = t / duration
        if name == 'shutter_close':
            phase += (112 + 28 * math.exp(-t * 14)) / RATE
            buzz = 2 * (phase % 1) - 1
            irregular = .6 + .4 * math.sin(2 * math.pi * (43 * t + 9 * t * t)) ** 2
            arc = math.sin(2 * math.pi * (1750 * t - 700 * t * t))
            body = math.tanh(2.1 * (.47 * buzz + .7 * high[i] + .18 * low[i]))
            snap = (.4 * n + .15 * arc) * math.exp(-t * 85)
            envelope = min(1, t / .003) * (1 - u) ** 1.2
            sample = envelope * (body * irregular + snap)
        else:
            envelope = math.sin(math.pi * u) ** 1.7
            sweep = (1 - u) * high[i] + u * low[i]
            phase += (220 - 140 * u) / RATE
            sample = envelope * (2.1 * sweep + .055 * math.sin(2 * math.pi * phase))
        out.append(sample)
    # A short, quiet diffuse tail gives the reopening sweep some space.
    if name == 'shutter_open':
        dry = out[:]
        for delay, gain in [(.031, .14), (.057, .09)]:
            shift = round(delay * RATE)
            for i in range(shift, len(out)):
                out[i] += gain * dry[i - shift] * (1 - i / len(out))
    peak = max(abs(x) for x in out)
    return [x * .78 / peak for x in out]


def main():
    out = ROOT / 'web' / 'assets' / 'audio'
    manifest_path = out / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    with tempfile.TemporaryDirectory(prefix='cube-libre-shutters-') as temporary:
        for name in ['shutter_close', 'shutter_open']:
            samples = synthesize(name)
            source = Path(temporary) / f'{name}.wav'
            pcm = array('h', (round(x * 32767) for x in samples))
            import sys
            if sys.byteorder != 'little':
                pcm.byteswap()
            with wave.open(str(source), 'wb') as wav:
                wav.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
                wav.writeframes(pcm.tobytes())
            for ext, codec in [('ogg', ['-c:a', 'libvorbis', '-q:a', '5']),
                               ('mp3', ['-c:a', 'libmp3lame', '-b:a', '128k'])]:
                subprocess.run(['ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error',
                                '-i', str(source), *codec, str(out / f'{name}.{ext}')], check=True)
            manifest[name] = {'duration': len(samples) / RATE, 'ogg': f'{name}.ogg', 'mp3': f'{name}.mp3',
                              'source_wav': source.name, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                              'generator': 'tools/build_shutter_audio.py', 'edition': 'web'}
            rms = math.sqrt(sum(x * x for x in samples) / len(samples))
            print(f'{name}: {len(samples)/RATE:.2f}s, peak 0.78, RMS {rms:.3f}; Ogg + MP3')
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
