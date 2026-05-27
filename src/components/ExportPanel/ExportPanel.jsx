import './ExportPanel.css';

// One-letter to three-letter amino acid mapping for PDB ATOM records
const ONE_TO_THREE = {
  A: 'ALA', R: 'ARG', N: 'ASN', D: 'ASP', C: 'CYS',
  E: 'GLU', Q: 'GLN', G: 'GLY', H: 'HIS', I: 'ILE',
  L: 'LEU', K: 'LYS', M: 'MET', F: 'PHE', P: 'PRO',
  S: 'SER', T: 'THR', W: 'TRP', Y: 'TYR', V: 'VAL',
};

/**
 * Convert coordinate array + metadata into a valid PDB format string.
 * Follows the fixed-column PDB format spec (columns 1-80).
 */
function coordinatesToPDB(predictionData) {
  const { coordinates, sequence, prediction_id, structure, model_source } = predictionData;

  const pad = (str, len, right = false) => {
    const s = String(str ?? '');
    return right ? s.padEnd(len).slice(0, len) : s.padStart(len).slice(0, len);
  };

  const lines = [];

  // REMARK header
  lines.push('REMARK   1 Protein Folding Explorer — Generated PDB');
  lines.push(`REMARK   1 Prediction ID: ${prediction_id}`);
  lines.push(`REMARK   1 Model source:  ${model_source}`);
  lines.push(`REMARK   1 Sequence:      ${sequence}`);
  lines.push(`REMARK   2 Confidence:    ${((structure?.confidence ?? 0) * 100).toFixed(1)}%`);
  lines.push(`REMARK   2 Residues:      ${structure?.residues ?? sequence?.length ?? 0}`);
  lines.push('REMARK   3 B-factor column contains pLDDT confidence (0.00–1.00 scaled to 0–100)');

  // SEQRES records
  const seqChunks = [];
  for (let i = 0; i < sequence.length; i += 13) {
    seqChunks.push(sequence.slice(i, i + 13).split('').map(aa => ONE_TO_THREE[aa] ?? 'UNK').join(' '));
  }
  seqChunks.forEach((chunk, idx) => {
    lines.push(`SEQRES ${pad(idx + 1, 3)} A ${pad(sequence.length, 4)}  ${chunk}`);
  });

  // ATOM records
  coordinates.forEach((atom, idx) => {
    const serial = pad(idx + 1, 5);
    const atomName = pad(atom.atom_type ?? 'CA', 4, true); // left-justified in cols 13-16
    const resName = ONE_TO_THREE[atom.residue] ?? 'UNK';
    const resSeq = pad((atom.residue_idx ?? 0) + 1, 4);
    const x = pad(Number(atom.x).toFixed(3), 8);
    const y = pad(Number(atom.y).toFixed(3), 8);
    const z = pad(Number(atom.z).toFixed(3), 8);
    const occupancy = '  1.00';
    // pLDDT stored as 0–1 in b_factor; PDB convention is 0–100
    const bFactor = pad((Number(atom.b_factor ?? 0.85) * 100).toFixed(2), 6);
    const element = pad((atom.element ?? atom.atom_type?.[0] ?? 'C').slice(0, 2), 2);

    // PDB ATOM record: fixed 80-column format
    // cols:  1-6   7-11  12  13-16 17  18-20 21  22  23-26 27  28-30  31-38  39-46  47-54  55-60  61-66  67-76  77-78
    lines.push(
      `ATOM  ${serial} ${atomName} ${resName} A${resSeq}    ${x}${y}${z}${occupancy}${bFactor}          ${element}  `
    );
  });

  lines.push('END');
  return lines.join('\n');
}

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportPanel({ predictionData }) {
  const handleExportJSON = () => {
    if (!predictionData) return;
    triggerDownload(
      JSON.stringify(predictionData, null, 2),
      `prediction_${predictionData.prediction_id}.json`,
      'application/json'
    );
  };

  const handleExportPDB = () => {
    if (!predictionData?.coordinates?.length) return;
    const pdbContent = coordinatesToPDB(predictionData);
    triggerDownload(
      pdbContent,
      `structure_${predictionData.prediction_id}.pdb`,
      'chemical/x-pdb'
    );
  };

  return (
    <div className="export-panel">
      <h3>Export Options</h3>
      <p className="subtitle">Download prediction data and structures</p>
      <div className="export-buttons">
        <button 
          className="export-btn json-btn" 
          onClick={handleExportJSON} 
          disabled={!predictionData}
        >
          <span className="icon">📄</span> Export JSON
        </button>
        <button 
          className="export-btn pdb-btn" 
          onClick={handleExportPDB} 
          disabled={!predictionData}
        >
          <span className="icon">🧬</span> Export PDB
        </button>
      </div>
    </div>
  );
}
