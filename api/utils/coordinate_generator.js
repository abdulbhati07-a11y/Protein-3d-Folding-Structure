export async function predictEsmfold(sequence) {
  try {
    const response = await fetch("https://api.esmatlas.com/foldSequence/v1/pdb/", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: sequence,
    });
    if (response.ok) {
      return await response.text();
    }
  } catch (e) {
    console.error("Error querying ESMFold API:", e);
  }
  return null;
}

function calculateDihedral(p0, p1, p2, p3) {
  try {
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const norm = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);

    let b0 = sub(p0, p1);
    let b1 = sub(p2, p1);
    let b2 = sub(p3, p2);

    let b1_norm = norm(b1);
    if (b1_norm === 0) return 0.0;
    b1 = [b1[0] / b1_norm, b1[1] / b1_norm, b1[2] / b1_norm];

    const v = sub(b0, [b1[0] * dot(b0, b1), b1[1] * dot(b0, b1), b1[2] * dot(b0, b1)]);
    const w = sub(b2, [b1[0] * dot(b2, b1), b1[1] * dot(b2, b1), b1[2] * dot(b2, b1)]);

    const x = dot(v, w);
    const y = dot(cross(b1, v), w);

    if (norm(v) === 0 || norm(w) === 0) return 0.0;
    return (Math.atan2(y, x) * 180.0) / Math.PI;
  } catch (e) {
    return 0.0;
  }
}

export function parsePdbString(pdbStr) {
  const coords = [];
  const lines = pdbStr.trim().split('\n');
  const threeToOne = {
    ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C',
    GLU: 'E', GLN: 'Q', GLY: 'G', HIS: 'H', ILE: 'I',
    LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P',
    SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
  };

  const caAtoms = [];
  const bFactors = [];
  const resNumMap = {};
  let resIdxCounter = 0;
  const backboneAtoms = {};

  for (const line of lines) {
    if (line.startsWith('ATOM')) {
      try {
        const atomName = line.substring(12, 16).trim();
        const resName = line.substring(17, 20).trim();
        const resNum = parseInt(line.substring(22, 26).trim(), 10);

        const x = parseFloat(line.substring(30, 38).trim());
        const y = parseFloat(line.substring(38, 46).trim());
        const z = parseFloat(line.substring(46, 54).trim());

        const bFactor = parseFloat(line.substring(60, 66).trim());
        let element = line.substring(76, 78).trim();
        if (!element) element = atomName[0];

        const oneLetter = threeToOne[resName] || 'X';

        if (resNumMap[resNum] === undefined) {
          resNumMap[resNum] = resIdxCounter++;
        }

        const resIdx = resNumMap[resNum];

        const atomData = {
          x, y, z,
          atom_type: atomName,
          residue_idx: resIdx,
          residue: oneLetter,
          element,
          b_factor: bFactor / 100.0,
        };

        coords.push(atomData);

        if (atomName === 'CA') {
          caAtoms.push(atomData);
          bFactors.push(bFactor);
        }

        if (!backboneAtoms[resIdx]) backboneAtoms[resIdx] = {};
        if (["N", "CA", "C"].includes(atomName)) {
          backboneAtoms[resIdx][atomName] = [x, y, z];
        }
      } catch (e) {
        continue;
      }
    }
  }

  if (coords.length === 0) return null;

  const residueCount = caAtoms.length;
  const ssList = Array(residueCount).fill('L');

  for (let i = 0; i < residueCount; i++) {
    if (i + 4 < residueCount) {
      const p1 = [caAtoms[i].x, caAtoms[i].y, caAtoms[i].z];
      const p2 = [caAtoms[i + 4].x, caAtoms[i + 4].y, caAtoms[i + 4].z];
      const dist = Math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2 + (p1[2]-p2[2])**2);
      if (dist >= 5.0 && dist <= 6.5) {
        for (let k = i; k < i + 5; k++) {
          if (k < residueCount) ssList[k] = 'H';
        }
      }
    }

    if (ssList[i] === 'L' && i + 2 < residueCount) {
      const p1 = [caAtoms[i].x, caAtoms[i].y, caAtoms[i].z];
      const p2 = [caAtoms[i + 2].x, caAtoms[i + 2].y, caAtoms[i + 2].z];
      const dist = Math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2 + (p1[2]-p2[2])**2);
      if (dist >= 6.4 && dist <= 7.4) {
        for (let k = i; k < i + 3; k++) {
          if (k < residueCount) ssList[k] = 'E';
        }
      }
    }
  }

  const ss = ssList.join('');
  const avgConfidence = bFactors.length > 0 ? (bFactors.reduce((a, b) => a + b, 0) / bFactors.length) / 100.0 : 0.85;

  const ramachandran = [];
  for (let i = 0; i < residueCount; i++) {
    let phi = null;
    let psi = null;

    if (i > 0) {
      const cPrev = backboneAtoms[i - 1]?.C;
      const nCurr = backboneAtoms[i]?.N;
      const caCurr = backboneAtoms[i]?.CA;
      const cCurr = backboneAtoms[i]?.C;
      if (cPrev && nCurr && caCurr && cCurr) {
        phi = calculateDihedral(cPrev, nCurr, caCurr, cCurr);
      }
    }

    if (i < residueCount - 1) {
      const nCurr = backboneAtoms[i]?.N;
      const caCurr = backboneAtoms[i]?.CA;
      const cCurr = backboneAtoms[i]?.C;
      const nNext = backboneAtoms[i + 1]?.N;
      if (nCurr && caCurr && cCurr && nNext) {
        psi = calculateDihedral(nCurr, caCurr, cCurr, nNext);
      }
    }

    ramachandran.push({
      residue_idx: i,
      residue: caAtoms[i].residue,
      phi: phi !== null ? Math.round(phi * 10) / 10 : null,
      psi: psi !== null ? Math.round(psi * 10) / 10 : null,
      ss: ssList[i],
    });
  }

  const hydrophobicAA = "AVIFMLPWC";
  const hydrophobicRes = [];
  const sequence = caAtoms.map(c => c.residue).join('');
  for (let i = 0; i < sequence.length; i++) {
    if (hydrophobicAA.includes(sequence[i])) hydrophobicRes.push(i);
  }

  const structureInfo = {
    atoms: coords.length,
    residues: residueCount,
    secondary_structure: ss,
    hydrophobic_residues: hydrophobicRes.slice(0, 20),
    confidence: avgConfidence,
    ramachandran,
    description: `Real ESMFold structure prediction (${residueCount} residues)`,
  };

  return { coordinates: coords, structure: structureInfo };
}

export function generateCoordinates(sequence) {
  // Simple mock generation
  const residueCount = sequence.length;
  const coords = [];
  let angle = 0;
  for (let i = 0; i < residueCount; i++) {
    const radius = 2.0 + (i % 20) * 0.1;
    angle += 1.5;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    const z = i * 3.8 / residueCount;

    const atomTypes = ["CA", "CB", "CG", "CD", "NZ", "OE", "OG"];
    for (let j = 0; j < 7; j++) {
      coords.push({
        x: x + (Math.random() - 0.5) * 2.4,
        y: y + (Math.random() - 0.5) * 2.4,
        z: z + (Math.random() - 0.5) * 2.4,
        atom_type: atomTypes[j],
        residue_idx: i,
        residue: sequence[i],
        element: j < 4 ? "C" : j === 5 ? "O" : "N",
        b_factor: 0.85 + (0.15 * Math.sin(i)),
      });
    }
  }
  return coords;
}

export function generateMockStructure(sequence) {
  const residueCount = sequence.length;
  let ss = "";
  const hydrophobicRes = [];
  const hydrophobicAA = "AVIFMLPWC";

  for (let i = 0; i < residueCount; i++) {
    if (i % 12 === 0 && i < residueCount - 2) ss += "H";
    else if (i % 8 === 0 && i > 2) ss += "E";
    else ss += "L";

    if (hydrophobicAA.includes(sequence[i])) hydrophobicRes.push(i);
  }

  return {
    atoms: residueCount * 7,
    residues: residueCount,
    secondary_structure: ss,
    hydrophobic_residues: hydrophobicRes.slice(0, 10),
    confidence: 0.85,
    ramachandran: [],
    description: `Predicted structure (${residueCount} residues)`,
  };
}

export function analyzeBindingPockets(coords) {
  const count = coords.length;
  if (count === 0) return { count: 0, center: [0, 0, 0], surface_atoms: [] };
  const sum = coords.reduce((acc, c) => [acc[0] + c.x, acc[1] + c.y, acc[2] + c.z], [0, 0, 0]);
  const center = [sum[0] / count, sum[1] / count, sum[2] / count];
  
  const distances = coords.map(c => Math.sqrt((c.x - center[0])**2 + (c.y - center[1])**2 + (c.z - center[2])**2));
  const sortedDistances = [...distances].sort((a, b) => a - b);
  const p75 = sortedDistances[Math.floor(count * 0.75)];
  
  const pocketIndices = [];
  for (let i = 0; i < count; i++) {
    if (distances[i] > p75) pocketIndices.push(i);
  }

  return {
    count: pocketIndices.length,
    center,
    surface_atoms: pocketIndices.slice(0, 20),
  };
}

export async function predictProteinStructure(sequence) {
  const pdbStr = await predictEsmfold(sequence);
  if (pdbStr) {
    const parsed = parsePdbString(pdbStr);
    if (parsed) {
      const bindingPockets = analyzeBindingPockets(parsed.coordinates);
      return { ...parsed, binding_pockets: bindingPockets, model_source: 'ESMFold API' };
    }
  }

  const coordinates = generateCoordinates(sequence);
  const structure = generateMockStructure(sequence);
  const bindingPockets = analyzeBindingPockets(coordinates);
  return { coordinates, structure, binding_pockets: bindingPockets, model_source: 'Mock (JS)' };
}
