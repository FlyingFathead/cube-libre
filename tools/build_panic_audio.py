#!/usr/bin/env python3
"""Two otherworldly DEE-DAAH calls, synthesized without external samples."""
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

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100
DURATION = 2.75


def synthesize():
    dry = []
    phase = zap_phase = low = 0
    rng = random.Random(290)
    for i in range(round(RATE * DURATION)):
        t = i / RATE
        pulse = int(max(0, t-.23) / .52)
        local = max(0, t-.23) % .52
        progress = max(0, min(1, (t-.45)/1.9))
        doppler = 1.10 - .25*progress*progress*(3-2*progress)
        frequency = (784 if pulse % 2 == 0 else 523.25) * doppler * (1 + .008 * math.sin(t * 27))
        phase += math.tau * frequency / RATE
        envelope = min(1, local / .025) * min(1, (.52 - local) / .065)
        envelope *= min(1, t / .025) * max(0, min(1, (2.31 - t) / .10))
        voice = (.6+.4*math.sin(math.pi*min(1,t/2.75))) * math.sin(phase) + .22 * math.sin(phase * 2.005) + .08 * math.sin(phase * 3.01)
        # Quick descending zap followed by a filtered rushing tractor-beam wash.
        noise = rng.uniform(-1, 1)
        low += .16 * (noise - low)
        zap_phase += math.tau * (1700*math.exp(-t*13)+110) / RATE
        zap = math.sin(zap_phase) * math.exp(-t*18) * min(1,t/.008)
        whoosh = low * math.sin(math.pi*min(1,t/.65))**1.2
        dry.append(.65*voice*envelope + .8*zap + 1.5*whoosh)
    wet = dry[:]
    for delay, gain in [(.083, .18), (.173, .13), (.269, .08)]:
        shift = round(delay * RATE)
        for i in range(shift, len(wet)):
            wet[i] += dry[i - shift] * gain
    peak = max(map(abs, wet))
    return [v * .65 / peak * min(1, (len(wet)-1-i) / (.08*RATE)) for i, v in enumerate(wet)]


def main():
    out = ROOT / 'web/assets/audio'
    samples = synthesize()
    with tempfile.TemporaryDirectory(prefix='cube-libre-panic-') as temporary:
        source = Path(temporary) / 'panic.wav'
        pcm = array('h', (round(v * 32767) for v in samples))
        if sys.byteorder != 'little':
            pcm.byteswap()
        with wave.open(str(source), 'wb') as wav:
            wav.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
            wav.writeframes(pcm.tobytes())
        for ext, codec in [('ogg', ['-c:a', 'libvorbis', '-q:a', '5']),
                           ('mp3', ['-c:a', 'libmp3lame', '-b:a', '128k'])]:
            subprocess.run(['ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error',
                            '-i', str(source), *codec, str(out / f'panic.{ext}')], check=True)
        path = out / 'manifest.json'
        manifest = json.loads(path.read_text())
        manifest['panic'] = {'duration': DURATION, 'ogg': 'panic.ogg', 'mp3': 'panic.mp3',
                             'source_wav': source.name, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                             'generator': 'tools/build_panic_audio.py', 'edition': 'web'}
        path.write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'panic: {DURATION}s, peak <=0.65; Ogg + MP3')


if __name__ == '__main__':
    main()
