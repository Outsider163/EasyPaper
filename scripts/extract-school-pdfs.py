"""Extract source rows, page provenance and non-enumerated rules; never infer titles."""
import hashlib
import json
from pathlib import Path

import pdfplumber

root = Path(__file__).resolve().parents[1]
out = root / 'catalog/sources/school-journals-2025.json'
sources = []
for school, code in [('东北财经大学', 'dufe'), ('西南财经大学', 'swufe')]:
    path = root / 'tmp/sources' / (school + '高水平学术期刊目录.pdf')
    rows, rules, sequences = [], [], {'中文': [], '外文': []}
    with pdfplumber.open(path) as pdf:
        for index, page in enumerate(pdf.pages):
            language = '中文' if index < (11 if code == 'dufe' else 4) else '外文'
            for table in page.extract_tables({'text_x_tolerance': 1}):
                for row in table[1:]:
                    clean = [(cell or '').replace('\n', ' ' if language == '外文' else '').strip() for cell in row]
                    if code == 'dufe':
                        number, rank, _, name = clean[:4]
                        identifiers = clean[4:] if language == '外文' else []
                        if not number and (name.startswith('除') or rank == '其他'):
                            rules.append({'page': index + 1, 'rank': rank, 'text': name})
                            continue
                    else:
                        number, subject, name, identifier, rank = clean
                        identifiers = [identifier] if language == '外文' else []
                        if name.replace(' ', '') in ['NATURE其他子刊', 'SCIENCE其他子刊']:
                            sequences[language].append(int(number))
                            rules.append({'page': index + 1, 'rank': rank, 'text': name})
                            continue
                    assert name and rank, (school, index, clean)
                    if number:
                        assert number.isdigit(), (school, index, clean)
                        sequences[language].append(int(number))
                    rows.append({'name': name, 'rank': rank, 'issn': [i for i in identifiers if i],
                                 'page': index + 1, 'number': number, 'language': language, **({'subject': subject} if code == 'swufe' else {})})
            if index in ([0, 9, 11, 31] if code == 'dufe' else [0, 4, 26]):
                image_dir = root / 'tmp/pdfs/schools'
                image_dir.mkdir(parents=True, exist_ok=True)
                page.to_image(resolution=100).save(image_dir / f'{code}-{index + 1}.png')
    for language, sequence in sequences.items():
        assert sequence == list(range(1, max(sequence) + 1)), (school, language, 'missing/duplicate sequence')
    sources.append({'school': school, 'edition': '2025修订', 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                    'rows': rows, 'rules': rules, 'sequenceTotals': {k: max(v) for k, v in sequences.items()}})
out.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps([{k: v for k, v in source.items() if k != 'rows'} | {'rows': len(source['rows'])} for source in sources], ensure_ascii=False))
