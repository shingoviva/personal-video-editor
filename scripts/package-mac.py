"""Create the downloadable local app without dependencies or private media."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
output = root / 'dist/personal-video-editor-mac.zip'
entries = ['dist', 'engine', 'tests', 'validation', 'scripts', 'README.md', 'VALIDATION.md', 'Launch.command', 'package.json', 'package-lock.json', 'vite.config.mjs']
with ZipFile(output, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    for entry in entries:
        base = root / entry
        files = sorted(base.rglob('*')) if base.is_dir() else [base]
        for path in files:
            if not path.is_file() or path == output or '__pycache__' in path.parts or '.vite' in path.parts or (path.suffix in ('.pyc', '.mp4', '.mov') and path.name != 'device-test.mp4'):
                continue
            archive.write(path, 'Personal-Video-Editor/' + path.relative_to(root).as_posix())
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert 'Personal-Video-Editor/dist/timeline-gestures.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/image-media.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/assets.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/media-state.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/mobile-render-worker.js' in archive.namelist()
    assert 'Personal-Video-Editor/dist/device-test.mp4' in archive.namelist()
    assert 'Personal-Video-Editor/engine/color_engine.py' in archive.namelist()
    assert 'Personal-Video-Editor/dist/creative.js' in archive.namelist()
    assert 'Personal-Video-Editor/engine/audio_engine.py' in archive.namelist()
    assert 'Personal-Video-Editor/dist/audio-preview.js' in archive.namelist()
    assert b"'build':'1.6.0'" in archive.read('Personal-Video-Editor/engine/core.py')
print(f'Mac bundle verified: {output.stat().st_size:,} bytes')
