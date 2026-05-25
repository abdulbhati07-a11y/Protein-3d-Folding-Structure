"""Protein structure prediction — ESMFold API with mock fallback."""
import numpy as np
import requests

MODEL_SOURCE_ESMFOLD = 'esmfold'
MODEL_SOURCE_MOCK = 'mock'
ESM_AVAILABLE = False  # Always using remote API


def predict_esmfold(sequence: str) -> str | None:
    try:
        r = requests.post(
            'https://api.esmatlas.com/fold/v1/pdb/',
            data=sequence,
            headers={'Content-Type': 'text/plain'},
            timeout=30,
        )
        if r.status_code == 200:
            return r.text
    except Exception as e:
        print(f'ESMFold API error: {e}')
    return None


def calculate_dihedral(p0, p1, p2, p3) -> float:
    try:
        p0, p1, p2, p3 = map(np.array, [p0, p1, p2, p3])
        b0 = -1.0 * (p1 - p0)
        b1 = p2 - p1
        b2 = p3 - p2
        n = np.linalg.norm(b1)
        if n == 0:
            return 0.0
        b1 /= n
        v = b0 - np.dot(b0, b1) * b1
        w = b2 - np.dot(b2, b1) * b1
        if np.linalg.norm(v) == 0 or np.linalg.norm(w) == 0:
            return 0.0
        return float(np.degrees(np.arctan2(np.dot(np.cross(b1, v), w), np.dot(v, w))))
    except Exception:
        return 0.0


def parse_pdb_string(pdb_str: str):
    THREE_TO_ONE = {
        'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C',
        'GLU': 'E', 'GLN': 'Q', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
        'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P',
        'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V',
    }
    coords, ca_atoms, b_factors = [], [], []
    res_num_map, backbone_atoms = {}, {}
    res_idx_counter = 0

    for line in pdb_str.strip().split('\n'):
        if not line.startswith('ATOM'):
            continue
        try:
            atom_name = line[12:16].strip()
            res_name = line[17:20].strip()
            res_num = int(line[22:26].strip())
            x, y, z = float(line[30:38]), float(line[38:46]), float(line[46:54])
            b_factor = float(line[60:66].strip())
            element = line[76:78].strip() or atom_name[0]
            one_letter = THREE_TO_ONE.get(res_name, 'X')

            if res_num not in res_num_map:
                res_num_map[res_num] = res_idx_counter
                res_idx_counter += 1
            res_idx = res_num_map[res_num]

            atom = {'x': x, 'y': y, 'z': z, 'atom_type': atom_name,
                    'residue_idx': res_idx, 'residue': one_letter,
                    'element': element, 'b_factor': b_factor / 100.0}
            coords.append(atom)

            if atom_name == 'CA':
                ca_atoms.append(atom)
                b_factors.append(b_factor)
            if res_idx not in backbone_atoms:
                backbone_atoms[res_idx] = {}
            if atom_name in ('N', 'CA', 'C'):
                backbone_atoms[res_idx][atom_name] = [x, y, z]
        except Exception:
            continue

    if not coords:
        return None

    n = len(ca_atoms)
    ss_list = ['L'] * n
    for i in range(n):
        if i + 4 < n:
            p1 = np.array([ca_atoms[i]['x'], ca_atoms[i]['y'], ca_atoms[i]['z']])
            p2 = np.array([ca_atoms[i+4]['x'], ca_atoms[i+4]['y'], ca_atoms[i+4]['z']])
            if 5.0 <= np.linalg.norm(p1 - p2) <= 6.5:
                for k in range(i, min(i+5, n)):
                    ss_list[k] = 'H'
        if ss_list[i] == 'L' and i + 2 < n:
            p1 = np.array([ca_atoms[i]['x'], ca_atoms[i]['y'], ca_atoms[i]['z']])
            p2 = np.array([ca_atoms[i+2]['x'], ca_atoms[i+2]['y'], ca_atoms[i+2]['z']])
            if 6.4 <= np.linalg.norm(p1 - p2) <= 7.4:
                for k in range(i, min(i+3, n)):
                    ss_list[k] = 'E'

    ramachandran = []
    for i in range(n):
        phi = psi = None
        if i > 0:
            pts = [backbone_atoms.get(i-1, {}).get('C'),
                   backbone_atoms.get(i, {}).get('N'),
                   backbone_atoms.get(i, {}).get('CA'),
                   backbone_atoms.get(i, {}).get('C')]
            if all(pts):
                phi = calculate_dihedral(*pts)
        if i < n - 1:
            pts = [backbone_atoms.get(i, {}).get('N'),
                   backbone_atoms.get(i, {}).get('CA'),
                   backbone_atoms.get(i, {}).get('C'),
                   backbone_atoms.get(i+1, {}).get('N')]
            if all(pts):
                psi = calculate_dihedral(*pts)
        ramachandran.append({
            'residue_idx': i, 'residue': ca_atoms[i]['residue'],
            'phi': round(phi, 1) if phi is not None else None,
            'psi': round(psi, 1) if psi is not None else None,
            'ss': ss_list[i],
        })

    hydrophobic_aa = 'AVIFMLPWC'
    seq = ''.join(c['residue'] for c in ca_atoms)
    hydrophobic_res = [i for i, aa in enumerate(seq) if aa in hydrophobic_aa]

    structure_info = {
        'atoms': len(coords), 'residues': n,
        'secondary_structure': ''.join(ss_list),
        'hydrophobic_residues': hydrophobic_res[:20],
        'confidence': float(np.mean(b_factors)) / 100.0 if b_factors else 0.85,
        'ramachandran': ramachandran,
        'description': f'Real ESMFold structure prediction ({n} residues)',
    }
    return coords, structure_info


def _mock_ramachandran(sequence: str, ss: str) -> list:
    np.random.seed(42)
    result = []
    for idx, (aa, ss_type) in enumerate(zip(sequence, ss)):
        if ss_type == 'H':
            phi, psi = np.random.normal(-60, 5), np.random.normal(-45, 5)
        elif ss_type == 'E':
            phi, psi = np.random.normal(-135, 10), np.random.normal(135, 10)
        else:
            if np.random.rand() > 0.5:
                phi, psi = np.random.normal(-70, 20), np.random.normal(-20, 30)
            else:
                phi, psi = np.random.normal(-110, 30), np.random.normal(110, 40)
        phi = float(np.clip(phi, -180, 180))
        psi = float(np.clip(psi, -180, 180))
        result.append({
            'residue_idx': idx, 'residue': aa,
            'phi': round(phi, 1) if idx > 0 else None,
            'psi': round(psi, 1) if idx < len(sequence) - 1 else None,
            'ss': ss_type,
        })
    return result


def generate_mock_structure(sequence: str) -> dict:
    n = len(sequence)
    ss = ''
    hydrophobic_aa = 'AVIFMLPWC'
    hydrophobic_res = []
    for i, aa in enumerate(sequence):
        if i % 12 == 0 and i < n - 2:
            ss += 'H'
        elif i % 8 == 0 and i > 2:
            ss += 'E'
        else:
            ss += 'L'
        if aa in hydrophobic_aa:
            hydrophobic_res.append(i)
    confidence = float(np.round(np.clip(0.75 + (n / 200) * 0.2, 0.65, 0.95), 3))
    return {
        'atoms': n * 7, 'residues': n,
        'secondary_structure': ss,
        'hydrophobic_residues': hydrophobic_res[:10],
        'confidence': confidence,
        'ramachandran': _mock_ramachandran(sequence, ss),
        'description': f'Predicted structure ({n} residues)',
    }


def generate_coordinates(sequence: str, seed: int = 42) -> list:
    np.random.seed(seed)
    coords = []
    angle = 0.0
    for i, aa in enumerate(sequence):
        radius = 2.0 + (i % 20) * 0.1
        angle += 1.5
        x, y, z = radius * np.cos(angle), radius * np.sin(angle), i * 3.8 / len(sequence)
        for j, atype in enumerate(['CA', 'CB', 'CG', 'CD', 'NZ', 'OE', 'OG']):
            off = np.random.randn(3) * 1.2
            coords.append({
                'x': float(x + off[0]), 'y': float(y + off[1]), 'z': float(z + off[2]),
                'atom_type': atype, 'residue_idx': i, 'residue': aa,
                'element': 'C' if j < 4 else ('O' if j == 5 else 'N'),
                'b_factor': 0.85 + 0.15 * float(np.sin(i)),
            })
    return coords


def analyze_binding_pockets(coords: list) -> dict:
    points = np.array([[c['x'], c['y'], c['z']] for c in coords])
    center = points.mean(axis=0)
    distances = np.linalg.norm(points - center, axis=1)
    pocket_indices = np.where(distances > np.percentile(distances, 75))[0]
    return {
        'count': int(len(pocket_indices)),
        'center': [float(center[0]), float(center[1]), float(center[2])],
        'surface_atoms': [int(i) for i in pocket_indices[:20]],
    }


def predict_protein_structure(sequence: str) -> dict:
    pdb_str = predict_esmfold(sequence)
    if pdb_str:
        parsed = parse_pdb_string(pdb_str)
        if parsed:
            coordinates, structure = parsed
            return {
                'coordinates': coordinates,
                'structure': structure,
                'binding_pockets': analyze_binding_pockets(coordinates),
                'model_source': MODEL_SOURCE_ESMFOLD,
            }
    coordinates = generate_coordinates(sequence)
    return {
        'coordinates': coordinates,
        'structure': generate_mock_structure(sequence),
        'binding_pockets': analyze_binding_pockets(coordinates),
        'model_source': MODEL_SOURCE_MOCK,
    }
