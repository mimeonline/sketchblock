#!/usr/bin/env python3
"""Build and validate the English architecture SVGs with an external diagram engine."""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile


ASSETS = Path(__file__).resolve().parent
REPOSITORY = ASSETS.parents[4]
QA = REPOSITORY / '.playwright' / 'architecture'


def run_json(*arguments):
    result = subprocess.run(arguments, check=True, capture_output=True, text=True)
    report = json.loads(result.stdout)
    if not report.get('ok'):
        raise RuntimeError(result.stdout)
    summary = report.get('summary', {})
    if summary.get('errors', 0) or summary.get('warnings', 0):
        raise RuntimeError(result.stdout)
    return report


def main():
    engine_setting = os.environ.get('DIAGRAM_ENGINE_DIR')
    if not engine_setting:
        raise SystemExit('Set DIAGRAM_ENGINE_DIR to the external diagram-engine directory.')
    scripts = Path(engine_setting).expanduser().resolve() / 'scripts'
    QA.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='build-', dir=QA) as temporary:
        generated = Path(temporary)
        for name in ('system-context', 'building-blocks'):
            source = ASSETS / f'{name}.semantic.json'
            run_json('python3', str(scripts / 'build_diagram.py'), str(source),
                     '--output-dir', str(generated), '--quality', 'showcase')
            geometry = run_json('python3', str(scripts / 'validate_diagram.py'),
                                str(generated / f'{name}.resolved.json'),
                                '--quality', 'showcase', '--json')
            svg = (generated / f'{name}.svg').read_text()
            # The external renderer supplies two German legend literals.
            # Replace only these exact rendered text values; all geometry stays intact.
            svg = svg.replace('>Legende</text>', '>Legend</text>')
            svg = svg.replace('>[Container · Datenbank]</text>',
                              '>[Container · Database]</text>')
            # Embed a shared project theme without changing generated geometry.
            theme = (ASSETS / 'presentation.css').read_text()
            svg = svg.replace('</style>', theme + '\n  </style>')
            destination = ASSETS / f'{name}.svg'
            destination.write_text(svg)
            artifact = run_json('python3', str(scripts / 'validate_rendered_diagram.py'),
                                str(destination), '--json')
            receipt = {
                'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'artifactSha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
                'authoringAdjustment': 'English legend and shared presentation.css; geometry unchanged',
                'geometryValidation': geometry,
                'artifactValidation': artifact,
                'visualReview': 'pending',
            }
            (QA / f'{name}.localized.receipt.json').write_text(
                json.dumps(receipt, indent=2) + '\n')
            print(f'{name}: 0 errors, 0 warnings; visual review pending')


if __name__ == '__main__':
    main()
