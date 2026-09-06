#!/usr/bin/env python3
"""Export reference fixtures directly from the original, without Pygame or GL.

python tools/web_reference.py --source ../cube-libre-pygame/cube_libre_pygame.py
node --test tests/web/*.test.mjs

No game window, external Python packages, or hand-copied expected answers.
"""
import argparse
import ast
import colorsys
import dataclasses
import json
import math
import os
import random
import sys
import types
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


def load_original(path):
    tree = ast.parse(path.read_text())
    module = types.ModuleType('cube_libre_reference')
    sys.modules[module.__name__] = module
    ns = module.__dict__
    ns.update(math=math, os=os, random=random, colorsys=colorsys,
              dataclass=dataclasses.dataclass, __file__=str(path))
    for node in tree.body:
        if isinstance(node, ast.Assign) and node.lineno < 475:
            try:
                exec(compile(ast.Module(body=[node], type_ignores=[]), str(path), 'exec'), ns)
            except (NameError, AttributeError):
                pass  # SDL keyboard constants only; the simulation does not use these.
    # Definitions only: never execute the original startup, dependency preflight, or main loop.
    definitions = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.ClassDef))]
    future = ast.parse('from __future__ import annotations').body
    exec(compile(ast.Module(body=future + definitions, type_ignores=[]), str(path), 'exec'), ns)
    for name in ('LASERS', 'TITLE_GLYPHS'):
        assignment = next(n for n in tree.body if isinstance(n, ast.Assign) and
                          any(isinstance(t, ast.Name) and t.id == name for t in n.targets))
        exec(compile(ast.Module(body=[assignment], type_ignores=[]), str(path), 'exec'), ns)
    ns.update(BASE_LASER_TEMPLATES=ns['LASERS'], COURSE_MODULES=[], ACTIVE_LEVEL=1,
              COURSE_RENDER_CACHE={'modules': {}, 'joints': {}}, audio_play=lambda *a, **k: None)
    return ns


def fixtures():
    ns = load_original(source_path())
    V = ns['Vec3']
    rng = random.Random(20260906)
    output = {'source_commit': 'ecf8f0148713e5606e64624464eecc4545c71047', 'levels': [], 'lasers': [], 'portals': [], 'recovery': []}
    for route3d in (True, False):
        ns['DEBUG_FLAGS']['route3d'] = route3d
        for level in (1, 2, 3, 5, 7, 10, 20, 100):
            ns['setup_level_geometry'](level)
            modules = ns['COURSE_MODULES']
            points = []
            for m in modules:
                for _ in range(30):
                    p = m.local_to_world(rng.uniform(-32, 32), rng.uniform(-10, 10), rng.uniform(-10, 10))
                    points.append(p)
                points.extend(m.local_to_world(x, y, z) for x in (-23, -16, 16, 23)
                              for y in (-7.251, -7, 0, 7, 7.251) for z in (0, 7))
            output['levels'].append({'level': level, 'route3d': route3d,
                'directions': [m.direction.as_tuple() for m in modules],
                'bounds': ns['course_aabb'](),
                'modules': [{'start': m.start.as_tuple(), 'end': m.end_center().as_tuple(),
                             'basis': [m.basis_x.as_tuple(), m.basis_y.as_tuple(), m.basis_z.as_tuple()]} for m in modules],
                'inside': [{'p': p.as_tuple(), 'pad': pad, 'value': ns['point_inside_course'](p, pad)} for p in points for pad in (0, .25)],
                'locations': [{'p': p.as_tuple(), 'value': ns['player_module_location'](types.SimpleNamespace(origin=p))} for p in points[::5]]})
            if route3d and level in (1, 3, 7, 20):
                for idx, laser in enumerate(ns['LASERS']):
                    for _ in range(25):
                        t = rng.uniform(0, 45)
                        local = V(rng.uniform(-.32, .32), rng.uniform(-7.1, 7.1), rng.uniform(-7.1, 7.1))
                        v = ns['rotate_axis'](local, laser.axis, laser.angle(t))
                        bx, by, bz = laser.basis()
                        p = laser.center + bx * v.x + by * v.y + bz * v.z
                        output['lasers'].append({'level': level, 'index': idx, 'p': p.as_tuple(), 't': t,
                                                  'hit': laser.hits_point(p, t), 'local': laser.to_local(p, t).as_tuple()})
                for lx in (12, 13.2, 15, 18.5, 20, 21.69, 21.7, 21.71, 22, 23.3):
                    for side in (0, 2.9, 3.521, 5.9):
                        for count in (1, 18, 124, 125):
                            p = ns['PlayerCube']()
                            p.alive_cells = set(sorted(p.alive_cells)[:count])
                            p.origin = ns['PORTAL_MODULE'].local_to_world(lx, side, side*.5)
                            before = p.origin.as_tuple()
                            metrics = {'ratio': ns['portal_absorption_ratio'](p), 'charge': ns['portal_overlap_charge'](p),
                                       'overlap': ns['portal_cell_overlap_count'](p), 'reached': ns['portal_reached'](p)}
                            ns['apply_portal_suction'](p, 1/120)
                            output['portals'].append({'level': level, 'origin': before, 'count': count,
                                                       'metrics': metrics, 'after_suction': p.origin.as_tuple()})
    for remaining in (1, 15, 80, 124):
        p = ns['PlayerCube']()
        p.alive_cells = set(rng.sample(sorted(p.alive_cells), remaining))
        targets = ns['_recoupling_target_cells'](p, 125-remaining)
        output['recovery'].append({'alive': sorted(p.alive_cells), 'targets': targets})
    path = ROOT / 'tests' / 'web' / 'python-reference.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(output, separators=(',', ':')) + '\n')
    print(f'Exported {len(output["levels"])} course configurations, {len(output["lasers"])} laser samples, {len(output["portals"])} portal samples.')


if __name__ == '__main__':
    fixtures()
