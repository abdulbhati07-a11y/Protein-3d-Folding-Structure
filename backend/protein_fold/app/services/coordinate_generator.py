import numpy as np
import requests

from protein_fold.constants import MODEL_SOURCE_ESMFOLD, MODEL_SOURCE_MOCK

# Local ESMFold model is not used — the app always calls the remote ESMFold API.
# This constant is kept for the health endpoint to report the correct status.
ESM_AVAILABLE = False


def predict_esmfold(sequence):
    """
    Query the ESMFold API to get the 3D structure of the protein sequence in PDB format.
    Returns PDB string if successful, None otherwise.
    """
    url = "https://api.esmatlas.com/fold/v1/pdb/"
    try:
        response = requests.post(url, data=sequence, headers={"Content-Type": "text/plain"}, timeout=30)
        if response.status_code == 200:
            return response.text
    except Exception as e:
        print(f"Error querying ESMFold API: {e}")
    return None

def calculate_dihedral(p0, p1, p2, p3):
    """Calculate dihedral angle between four points in 3D space (returns degrees in [-180, 180])."""
    try:
        p0 = np.array(p0)
        p1 = np.array(p1)
        p2 = np.array(p2)
        p3 = np.array(p3)
        
        b0 = -1.0 * (p1 - p0)
        b1 = p2 - p1
        b2 = p3 - p2
        
        b1_norm = np.linalg.norm(b1)
        if b1_norm == 0:
            return 0.0
        b1 /= b1_norm
        
        v = b0 - np.dot(b0, b1) * b1
        w = b2 - np.dot(b2, b1) * b1
        
        x = np.dot(v, w)
        y = np.dot(np.cross(b1, v), w)
        
        v_norm = np.linalg.norm(v)
        w_norm = np.linalg.norm(w)
        if v_norm == 0 or w_norm == 0:
            return 0.0
            
        return float(np.degrees(np.arctan2(y, x)))
    except Exception:
        return 0.0

def parse_pdb_string(pdb_str):
    """
    Parses PDB format string and extracts coordinates, residue names, atom types, elements, and b_factors.
    Also estimates confidence, secondary structure, and Ramachandran dihedral angles.
    """
    coords = []
    lines = pdb_str.strip().split('\n')
    
    # Standard amino acid one-letter mapping
    three_to_one = {
        'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C',
        'GLU': 'E', 'GLN': 'Q', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
        'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P',
        'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V'
    }

    # Extract atoms
    ca_atoms = []
    b_factors = []
    
    # Map residue indices dynamically
    res_num_map = {}
    res_idx_counter = 0
    backbone_atoms = {}

    for line in lines:
        if line.startswith("ATOM"):
            try:
                atom_name = line[12:16].strip()
                res_name = line[17:20].strip()
                res_num = int(line[22:26].strip())
                
                x = float(line[30:38].strip())
                y = float(line[38:46].strip())
                z = float(line[46:54].strip())
                
                b_factor = float(line[60:66].strip())
                element = line[76:78].strip()
                if not element:
                    element = atom_name[0] # Fallback to first char of atom name
                
                one_letter = three_to_one.get(res_name, 'X')
                
                if res_num not in res_num_map:
                    res_num_map[res_num] = res_idx_counter
                    res_idx_counter += 1
                
                res_idx = res_num_map[res_num]
                
                atom_data = {
                    "x": x,
                    "y": y,
                    "z": z,
                    "atom_type": atom_name,
                    "residue_idx": res_idx,
                    "residue": one_letter,
                    "element": element,
                    "b_factor": b_factor / 100.0 # ESMFold outputs pLDDT (0-100) in B-factor col
                }
                
                coords.append(atom_data)
                
                if atom_name == 'CA':
                    ca_atoms.append(atom_data)
                    b_factors.append(b_factor)
                    
                if res_idx not in backbone_atoms:
                    backbone_atoms[res_idx] = {}
                if atom_name in ["N", "CA", "C"]:
                    backbone_atoms[res_idx][atom_name] = [x, y, z]
            except Exception as e:
                continue

    if not coords:
        return None

    # Estimate secondary structure using CA backbone distances:
    residue_count = len(ca_atoms)
    ss_list = ['L'] * residue_count
    
    # DSSP-like C-alpha distance metric for helix/sheet estimation
    for i in range(residue_count):
        # Helix detection: CA(i) to CA(i+4) distance is typically ~5.0 to 6.5 A
        if i + 4 < residue_count:
            p1 = np.array([ca_atoms[i]['x'], ca_atoms[i]['y'], ca_atoms[i]['z']])
            p2 = np.array([ca_atoms[i+4]['x'], ca_atoms[i+4]['y'], ca_atoms[i+4]['z']])
            dist = np.linalg.norm(p1 - p2)
            if 5.0 <= dist <= 6.5:
                for k in range(i, i+5):
                    if k < residue_count:
                        ss_list[k] = 'H'
        
        # Beta sheet detection: CA(i) to CA(i+2) is around 6.4 to 7.4 A
        if ss_list[i] == 'L' and i + 2 < residue_count:
            p1 = np.array([ca_atoms[i]['x'], ca_atoms[i]['y'], ca_atoms[i]['z']])
            p2 = np.array([ca_atoms[i+2]['x'], ca_atoms[i+2]['y'], ca_atoms[i+2]['z']])
            dist = np.linalg.norm(p1 - p2)
            if 6.4 <= dist <= 7.4:
                for k in range(i, i+3):
                    if k < residue_count:
                        ss_list[k] = 'E'
                        
    ss = "".join(ss_list)
    avg_confidence = float(np.mean(b_factors)) / 100.0 if b_factors else 0.85
    
    # Calculate Ramachandran dihedral angles
    ramachandran = []
    for i in range(residue_count):
        phi = None
        psi = None
        
        # phi is C(i-1) - N(i) - CA(i) - C(i)
        if i > 0:
            c_prev = backbone_atoms.get(i-1, {}).get("C")
            n_curr = backbone_atoms.get(i, {}).get("N")
            ca_curr = backbone_atoms.get(i, {}).get("CA")
            c_curr = backbone_atoms.get(i, {}).get("C")
            if c_prev and n_curr and ca_curr and c_curr:
                phi = calculate_dihedral(c_prev, n_curr, ca_curr, c_curr)
                
        # psi is N(i) - CA(i) - C(i) - N(i+1)
        if i < residue_count - 1:
            n_curr = backbone_atoms.get(i, {}).get("N")
            ca_curr = backbone_atoms.get(i, {}).get("CA")
            c_curr = backbone_atoms.get(i, {}).get("C")
            n_next = backbone_atoms.get(i+1, {}).get("N")
            if n_curr and ca_curr and c_curr and n_next:
                psi = calculate_dihedral(n_curr, ca_curr, c_curr, n_next)
                
        ramachandran.append({
            "residue_idx": i,
            "residue": ca_atoms[i]["residue"],
            "phi": round(phi, 1) if phi is not None else None,
            "psi": round(psi, 1) if psi is not None else None,
            "ss": ss_list[i]
        })
    
    # Hydrophobic residues list
    hydrophobic_aa = "AVIFMLPWC"
    hydrophobic_res = []
    sequence = "".join([ca['residue'] for ca in ca_atoms])
    for idx, aa in enumerate(sequence):
        if aa in hydrophobic_aa:
            hydrophobic_res.append(idx)

    structure_info = {
        "atoms": len(coords),
        "residues": residue_count,
        "secondary_structure": ss,
        "hydrophobic_residues": hydrophobic_res[:min(20, len(hydrophobic_res))],
        "confidence": avg_confidence,
        "ramachandran": ramachandran,
        "description": f"Real ESMFold structure prediction ({residue_count} residues)"
    }
    
    return coords, structure_info

def generate_mock_ramachandran(sequence, ss):
    """Generate realistic Ramachandran dihedral angles matching the secondary structure"""
    ramachandran = []
    np.random.seed(42)
    for idx, (aa, ss_type) in enumerate(zip(sequence, ss)):
        if ss_type == 'H':
            phi = float(np.random.normal(-60, 5))
            psi = float(np.random.normal(-45, 5))
        elif ss_type == 'E':
            phi = float(np.random.normal(-135, 10))
            psi = float(np.random.normal(135, 10))
        else: # Loop
            # Mix helical and sheet loop angles for a realistic scatter
            if np.random.rand() > 0.5:
                phi = float(np.random.normal(-70, 20))
                psi = float(np.random.normal(-20, 30))
            else:
                phi = float(np.random.normal(-110, 30))
                psi = float(np.random.normal(110, 40))
        
        # Keep inside bounds [-180, 180]
        phi = float(np.clip(phi, -180, 180))
        psi = float(np.clip(psi, -180, 180))
        
        # Null values for termini (first/last residue)
        if idx == 0:
            phi = None
        if idx == len(sequence) - 1:
            psi = None
            
        ramachandran.append({
            "residue_idx": idx,
            "residue": aa,
            "phi": round(phi, 1) if phi is not None else None,
            "psi": round(psi, 1) if psi is not None else None,
            "ss": ss_type
        })
    return ramachandran

def generate_mock_structure(sequence):
    """Generate realistic mock protein structure for demo"""
    residue_count = len(sequence)
    atom_count = residue_count * 7  # ~7 atoms per residue

    # Predict secondary structure (simple heuristic)
    ss = ""
    hydrophobic_aa = "AVIFMLPWC"
    hydrophobic_res = []

    for i, aa in enumerate(sequence):
        if i % 12 == 0 and i < residue_count - 2:
            ss += "H"  # Helix
        elif i % 8 == 0 and i > 2:
            ss += "E"  # Sheet
        else:
            ss += "L"  # Loop

        if aa in hydrophobic_aa:
            hydrophobic_res.append(i)

    confidence = np.clip(0.75 + (residue_count / 200) * 0.2, 0.65, 0.95)
    confidence = float(np.round(confidence, 3))
    
    # Generate mock Ramachandran dihedrals
    ramachandran = generate_mock_ramachandran(sequence, ss)

    return {
        "atoms": atom_count,
        "residues": residue_count,
        "secondary_structure": ss,
        "hydrophobic_residues": hydrophobic_res[:min(10, len(hydrophobic_res))],
        "confidence": confidence,
        "ramachandran": ramachandran,
        "description": f"Predicted structure ({residue_count} residues)"
    }

def generate_coordinates(sequence, seed=42):
    """Generate 3D coordinates for atoms"""
    np.random.seed(seed)
    residue_count = len(sequence)

    coords = []
    angle = 0
    x, y, z = 0, 0, 0

    for i in range(residue_count):
        # Simple helix-like trajectory
        radius = 2.0 + (i % 20) * 0.1
        angle += 1.5
        x = radius * np.cos(angle)
        y = radius * np.sin(angle)
        z = i * 3.8 / residue_count

        # Add ~7 atoms per residue (CA, CB, etc)
        for j in range(7):
            offset = np.random.randn(3) * 1.2
            coords.append({
                "x": float(x + offset[0]),
                "y": float(y + offset[1]),
                "z": float(z + offset[2]),
                "atom_type": ["CA", "CB", "CG", "CD", "NZ", "OE", "OG"][j],
                "residue_idx": i,
                "residue": sequence[i],
                "element": "C" if j < 4 else "O" if j == 5 else "N",
                "b_factor": 0.85 + (0.15 * np.sin(i))
            })

    return coords

def analyze_binding_pockets(coords):
    """Identify potential binding pockets (simplified)"""
    points = np.array([[c["x"], c["y"], c["z"]] for c in coords])
    center = points.mean(axis=0)
    distances = np.linalg.norm(points - center, axis=1)

    pocket_indices = np.where(distances > np.percentile(distances, 75))[0]

    return {
        "count": int(len(pocket_indices)),
        "center": [float(center[0]), float(center[1]), float(center[2])],
        "surface_atoms": [int(i) for i in pocket_indices[:20]]
    }

def predict_protein_structure(sequence):
    """
    Tries to predict using ESMFold API. If it fails or is offline,
    falls back gracefully to high-fidelity mock generators.
    """
    pdb_str = predict_esmfold(sequence)
    if pdb_str:
        parsed = parse_pdb_string(pdb_str)
        if parsed:
            coordinates, structure = parsed
            binding_pockets = analyze_binding_pockets(coordinates)
            return {
                "coordinates": coordinates,
                "structure": structure,
                "binding_pockets": binding_pockets,
                "model_source": MODEL_SOURCE_ESMFOLD
            }

    # Fallback to mock
    coordinates = generate_coordinates(sequence)
    structure = generate_mock_structure(sequence)
    binding_pockets = analyze_binding_pockets(coordinates)
    return {
        "coordinates": coordinates,
        "structure": structure,
        "binding_pockets": binding_pockets,
        "model_source": MODEL_SOURCE_MOCK
    }
