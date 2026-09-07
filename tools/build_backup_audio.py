#!/usr/bin/env python3
"""A soft, wordless AH choir, synthesized from harmonics and vowel formants."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100
DURATION = 5.5


def synthesize():
    t = np.arange(round(RATE * DURATION)) / RATE
    envelope = np.minimum(1, t / .85) ** 1.5 * np.clip((4.8 - t) / 1.6, 0, 1) ** 1.7
    stereo = np.zeros((len(t), 2))
    # D major, spread across registers; paired singers drift independently.
    notes = [146.832, 220, 293.665, 369.994, 440]
    for voice in range(10):
        fundamental = notes[voice // 2] * 2 ** ((voice % 2 * 2 - 1) * 4 / 1200)
        vibrato = .004 * np.sin(2 * np.pi * (4.8 + voice * .07) * t + voice)
        phase = np.cumsum(2 * np.pi * fundamental * (1 + vibrato) / RATE)
        vowel = np.zeros(len(t))
        for harmonic in range(1, int(6500 / fundamental)):
            frequency = fundamental * harmonic
            formants = sum(weight * np.exp(-.5 * ((frequency-center)/width)**2)
                           for center, width, weight in [(780, 150, 1), (1180, 220, .75), (2700, 340, .25)])
            vowel += (.035 + formants) / harmonic ** .75 * np.sin(harmonic * phase + voice * .29)
        vowel *= envelope * (.85 + .15 * np.sin(t * 1.6 + voice))
        pan = .12 + .76 * voice / 9
        stereo[:, 0] += vowel * np.sqrt(1-pan)
        stereo[:, 1] += vowel * np.sqrt(pan)
    dry = stereo.copy()
    for delay, gain in [(.071,.21), (.113,.19), (.197,.17), (.307,.15), (.431,.12), (.613,.09)]:
        shift = round(delay * RATE)
        stereo[shift:] += dry[:-shift, ::-1] * gain
    stereo *= np.clip((DURATION - t) / .25, 0, 1)[:, None]
    return stereo * (.58 / np.max(np.abs(stereo)))


def main():
    out = ROOT / 'web/assets/audio'
    with tempfile.TemporaryDirectory(prefix='cube-libre-backup-') as temp:
        source = Path(temp) / 'backup_choir.wav'
        with wave.open(str(source), 'wb') as wav:
            wav.setparams((2, 2, RATE, 0, 'NONE', 'not compressed'))
            wav.writeframes(np.rint(synthesize() * 32767).astype('<i2').tobytes())
        for extension, codec in [('ogg', ['-c:a','libvorbis','-q:a','5']),
                                 ('mp3', ['-c:a','libmp3lame','-b:a','160k'])]:
            subprocess.run(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error','-i',str(source),
                            *codec,str(out / f'backup_choir.{extension}')],check=True)
        path = out / 'manifest.json'
        manifest = json.loads(path.read_text())
        manifest['backup_choir'] = {'duration':DURATION,'ogg':'backup_choir.ogg','mp3':'backup_choir.mp3',
            'source_wav':source.name,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'generator':'tools/build_backup_audio.py','edition':'web'}
        path.write_text(json.dumps(manifest,indent=2)+'\n')
    print('backup_choir: 5.5 seconds, stereo, peak 0.58; Ogg + MP3')


if __name__ == '__main__':
    main()
