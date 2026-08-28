from pathlib import Path
import importlib.util

spec = importlib.util.spec_from_file_location('retouch', 'tmp_review/retouch_wire_v4.py')
mod = importlib.util.module_from_spec(spec)
# Load definitions without executing the batch runner at the bottom.
source = Path('tmp_review/retouch_wire_v4.py').read_text().split('report_before, report_after = {}, {}')[0]
exec(source, mod.__dict__)

edits = {
    'virtual_processor.png': ((68, 7, 124, 70), [(43, 18, 18, 40), (130, 18, 18, 40)], 'ref_cutter_icon.png', (47, 47), (96, 39), (239, 226, 207)),
    'virtual_processor-rotator.png': ((51, 91, 141, 158), [(30, 103, 16, 42), (146, 103, 16, 42)], 'ref_rotator_icon.png', (58, 58), (96, 125), (238, 219, 189)),
    'virtual_processor-stacker.png': ((52, 104, 140, 160), [(30, 110, 16, 40), (146, 110, 16, 40)], 'ref_stacker_icon.png', (62, 49), (96, 132), (240, 221, 191)),
}
for filename, args in edits.items():
    path = Path('staging_wire_v4') / filename
    im = mod.Image.open(path).convert('RGBA')
    mod.clean_symbol(im, *args).save(path)
