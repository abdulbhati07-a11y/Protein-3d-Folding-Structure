import { useState } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ReferenceArea, ReferenceLine, Cell as ScatterCell 
} from 'recharts';
import './StructureAnalysis.css';

const getSsColor = (ss) => {
  if (ss === 'H') return '#4a90e2';
  if (ss === 'E') return '#50c878';
  return '#ffc300';
};

const RamachandranTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const ssName = data.ss === 'H' ? 'Helix' : data.ss === 'E' ? 'Beta Sheet' : 'Loop';
    return (
      <div className="ramachandran-tooltip">
        <strong style={{ color: getSsColor(data.ss) }}>{data.label} ({ssName})</strong>
        <div>Phi (φ): {data.x.toFixed(1)}°</div>
        <div>Psi (ψ): {data.y.toFixed(1)}°</div>
      </div>
    );
  }
  return null;
};

export default function StructureAnalysis({ predictionData }) {
  const [activeTab, setActiveTab] = useState('structure');

  if (!predictionData) {
    return (
      <div className="analysis-empty">
        <p>No analysis data available. Run a prediction first.</p>
      </div>
    );
  }

  const { structure, sequence } = predictionData;
  const secondary_structure = structure.secondary_structure;
  
  // Calculate distribution
  const counts = { H: 0, E: 0, L: 0 };
  for (const char of secondary_structure) {
    if (counts[char] !== undefined) counts[char]++;
  }

  const pieData = [
    { name: 'Helix (H)', value: counts.H, color: '#4a90e2' },
    { name: 'Sheet (E)', value: counts.E, color: '#50c878' },
    { name: 'Loop (L)', value: counts.L, color: '#ffc300' },
  ].filter(item => item.value > 0);

  // Prepare Ramachandran Data
  const ramachandranData = (structure.ramachandran || [])
    .filter(r => r.phi !== null && r.psi !== null)
    .map(r => ({
      x: r.phi,
      y: r.psi,
      residue: r.residue,
      residue_idx: r.residue_idx,
      ss: r.ss,
      label: `${r.residue}${r.residue_idx + 1}`
    }));


  return (
    <div className="structure-analysis">
      <div className="tabs">
        <button 
          className={activeTab === 'structure' ? 'active' : ''} 
          onClick={() => setActiveTab('structure')}
        >
          Structure
        </button>
        <button 
          className={activeTab === 'ramachandran' ? 'active' : ''} 
          onClick={() => setActiveTab('ramachandran')}
        >
          Ramachandran
        </button>
        <button 
          className={activeTab === 'residues' ? 'active' : ''} 
          onClick={() => setActiveTab('residues')}
        >
          Residues
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'structure' && (
          <div className="structure-tab">
            <h4>Secondary Structure Distribution</h4>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="sequence-display">
              <label>Sequence & Secondary Structure</label>
              <div className="seq-ss-grid">
                <div className="seq-row">{sequence}</div>
                <div className="ss-row">{secondary_structure}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ramachandran' && (
          <div className="ramachandran-tab">
            <h4>Ramachandran Plot (φ vs ψ)</h4>
            <p className="tab-desc">
              Dihedral angles map the protein's backbone conformation. Alpha-helices cluster in the blue region; Beta-sheets in the green region.
            </p>
            <div className="chart-container ramachandran-chart-wrapper">
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                  
                  {/* Standard Alpha Helix core region */}
                  <ReferenceArea x1={-90} x2={-40} y1={-60} y2={-20} fill="#4a90e2" fillOpacity={0.08} />
                  
                  {/* Standard Beta Sheet core region */}
                  <ReferenceArea x1={-150} x2={-90} y1={100} y2={160} fill="#50c878" fillOpacity={0.08} />
                  
                  <ReferenceLine x={0} stroke="#4a5568" strokeWidth={1} />
                  <ReferenceLine y={0} stroke="#4a5568" strokeWidth={1} />

                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="Phi (φ)" 
                    unit="°" 
                    domain={[-180, 180]} 
                    ticks={[-180, -120, -60, 0, 60, 120, 180]}
                    stroke="#a0aec0"
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="Psi (ψ)" 
                    unit="°" 
                    domain={[-180, 180]} 
                    ticks={[-180, -120, -60, 0, 60, 120, 180]}
                    stroke="#a0aec0"
                  />
                  
                  <Tooltip content={<RamachandranTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#4a5568' }} />
                  
                  <Scatter name="Residues" data={ramachandranData}>
                    {ramachandranData.map((entry, index) => (
                      <ScatterCell key={`cell-${index}`} fill={getSsColor(entry.ss)} radius={6} stroke="#111827" strokeWidth={1.5} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            
            <div className="ramachandran-legend">
              <div className="legend-item"><span className="legend-dot ss-h"></span> Helix</div>
              <div className="legend-item"><span className="legend-dot ss-e"></span> Beta Sheet</div>
              <div className="legend-item"><span className="legend-dot ss-l"></span> Loop</div>
            </div>
          </div>
        )}

        {activeTab === 'residues' && (
          <div className="residues-tab">
            <h4>Residue List</h4>
            <div className="residue-table-container">
              <table className="residue-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>AA</th>
                    <th>SS</th>
                    <th>Phi (φ)</th>
                    <th>Psi (ψ)</th>
                  </tr>
                </thead>
                <tbody>
                  {sequence.split('').map((aa, idx) => {
                    const match = (structure.ramachandran || [])[idx] || {};
                    return (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{aa}</td>
                        <td className={`ss-${secondary_structure[idx]}`}>{secondary_structure[idx]}</td>
                        <td>{match.phi !== undefined && match.phi !== null ? `${match.phi}°` : '-'}</td>
                        <td>{match.psi !== undefined && match.psi !== null ? `${match.psi}°` : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
