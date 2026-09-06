#!/usr/bin/env python3
"""Generate the original Cube Libre sounds without importing Pygame/OpenGL.

Run from any directory: python tools/build_web_audio.py --source ../cube-libre-pygame/cube_libre_pygame.py
Requires ffmpeg on PATH; the synthesizer itself uses only Python's stdlib.
Existing original WAV caches are reused. Both browser codecs are committed in web/.
"""
import argparse
import ast
import hashlib
import json
import subprocess
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def source_path():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path,
                        help='Path to cube_libre_pygame.py in a separate PyGame checkout')
    path = parser.parse_args().source.expanduser().resolve()
    if not path.is_file():
        parser.error(f'Python source file not found: {path}')
    return path




def original_audio_namespace(SOURCE):
    tree = ast.parse(SOURCE.read_text())
    names = {'AUDIO_ENABLED', 'AUDIO_SAMPLE_RATE', 'AUDIO_DIR_NAME',
             'AUDIO_ASSET_FILENAMES', 'LEGACY_GAMELAN_ASSET_FILENAMES',
             'GAMELAN_SOURCE_GAIN_DB', 'GAMELAN_SOURCE_GAIN', 'GAMELAN_SOURCE_TARGET_PEAK',
             'LEVEL_PREVIEW_SECONDS', 'COURSE_MATERIALIZE_SECONDS', 'DEATH_DISSOLVE_SECONDS',
             'REASSEMBLY_SECONDS', 'RECOUPLING_SECONDS'}
    functions = {'clamp', 'smoothstep', '_audio_dir', 'expected_audio_asset_paths', '_pcm16',
                 '_write_wav_mono', '_source_gain_samples', '_read_wav_mono_float',
                 '_write_source_gained_wav', '_env_adsr', '_synth_seconds',
                 '_soft_clip', 'generate_audio_assets'}
    body = ast.parse('import os, math, random, sys, wave\nfrom array import array').body
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in functions:
            body.append(node)
        elif isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in names for t in node.targets):
            body.append(node)
    ns = {'__file__': str(SOURCE)}
    exec(compile(ast.Module(body=body, type_ignores=[]), str(SOURCE), 'exec'), ns)
    return ns


def main():
    ns = original_audio_namespace(source_path())
    print('Synthesizing original procedural audio (the long gamelan takes a while)...', flush=True)
    paths = ns['generate_audio_assets']()
    out = ROOT / 'web' / 'assets' / 'audio'
    out.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, source in paths.items():
        with wave.open(source) as wav:
            duration = wav.getnframes() / wav.getframerate()
        for ext, args in [('ogg', ['-c:a', 'libvorbis', '-q:a', '5']),
                          ('mp3', ['-c:a', 'libmp3lame', '-b:a', '128k'])]:
            destination = out / f'{name}.{ext}'
            subprocess.run(['ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error',
                            '-i', source, *args, str(destination)], check=True)
            if destination.stat().st_size < 100:
                raise RuntimeError(f'Audio encoder produced an empty file: {destination}')
        manifest[name] = {'duration': duration, 'ogg': f'{name}.ogg', 'mp3': f'{name}.mp3',
                          'source_wav': Path(source).name,
                          'source_sha256': hashlib.sha256(Path(source).read_bytes()).hexdigest()}
        print(f'{name}: {duration:.2f}s', flush=True)
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Wrote {len(manifest)} original sounds in Ogg Vorbis + MP3.', flush=True)


if __name__ == '__main__':
    main()
