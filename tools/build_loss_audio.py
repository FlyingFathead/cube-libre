#!/usr/bin/env python3
"""Generate a fault stutter and an engine winding down as absent pieces fall away.

Standard-library synthesis and FFmpeg, without sampled voices or online services.
The temporary WAV is reproducible; commit the Ogg/MP3 outputs and manifest.
"""
import hashlib
import json
import math
import subprocess
import sys
import tempfile
import wave
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100


def synthesize():
    duration = 3.2
    dry = []
    phase = 0.
    for i in range(round(RATE * duration)):
        elapsed = i / RATE
        t = max(0, elapsed - .14)
        # Hold a little electric whir, then lose almost three octaves of speed.
        progress = max(0, min(1, (t - .28) / 2.45))
        curve = progress * progress * (3 - 2 * progress)
        contour = 440 * (65 / 440) ** curve
        frequency = contour * 2 ** (.08 * math.sin(t * 2 * math.pi * 4.6) / 12)
        phase += 2 * math.pi * frequency / RATE
        voice = (math.sin(phase) + .28 * math.sin(2 * phase + .2)
                 + .14 * math.sin(3 * phase) + .05 * (1 - progress) * math.sin(5 * phase))
        undertone = .23 * math.sin(phase * .5 + .5)
        # The motor falters and decays gently rather than stopping on a hard click.
        attack = .5 - .5 * math.cos(math.pi * min(1, t / .16))
        flutter = 1 - .045 * math.sin(2 * math.pi * (8 * t - .8 * t * t)) ** 2
        envelope = attack * math.exp(-max(0, t - .65) / 1.1) * flutter
        tail = math.sin(math.pi * min(1, max(0, duration - elapsed) / .55) / 2) ** 2
        fault = 0.
        if elapsed < .14:
            pulse = max(0, math.sin(2 * math.pi * 29 * elapsed))
            buzz = math.tanh(3 * math.sin(2 * math.pi * 113 * elapsed)
                             + .7 * math.sin(2 * math.pi * 1731 * elapsed))
            fault = .32 * buzz * pulse * min(1, elapsed / .004) * (1 - elapsed / .14)
        dry.append((voice + undertone) * envelope * tail + fault)
    wet = dry[:]
    for seconds, gain in [(.083, .16), (.137, .12), (.223, .085), (.347, .05)]:
        shift = round(seconds * RATE)
        for i in range(shift, len(wet)):
            wet[i] += dry[i - shift] * gain * min(1, (len(wet) - i) / (.25 * RATE))
    peak = max(map(abs, wet))
    return [sample * .65 / peak for sample in wet]


def main():
    out = ROOT / 'web' / 'assets' / 'audio'
    name = 'loss_weep'
    samples = synthesize()
    with tempfile.TemporaryDirectory(prefix='cube-libre-loss-') as temporary:
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
        manifest_path = out / 'manifest.json'
        manifest = json.loads(manifest_path.read_text())
        manifest[name] = {'duration': len(samples) / RATE, 'ogg': f'{name}.ogg', 'mp3': f'{name}.mp3',
                          'source_wav': source.name, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                          'generator': 'tools/build_loss_audio.py', 'edition': 'web'}
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    rms = math.sqrt(sum(x * x for x in samples) / len(samples))
    print(f'{name}: {len(samples)/RATE:.2f}s, peak 0.65, RMS {rms:.3f}; Ogg + MP3')


if __name__ == '__main__':
    main()
