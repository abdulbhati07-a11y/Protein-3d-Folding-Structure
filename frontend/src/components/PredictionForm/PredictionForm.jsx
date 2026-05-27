import { useState, useRef } from 'react';
import './PredictionForm.css';

export default function PredictionForm({ onPredict, loading, disabled = false }) {
  const [sequence, setSequence] = useState('');
  const [error, setError] = useState('');
  const [batchProgress, setBatchProgress] = useState(null);
  const fileInputRef = useRef();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setSequence(event.target.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!sequence.trim()) {
      setError('Sequence cannot be empty');
      return;
    }

    // Parse FASTA or multi-line/comma-separated sequences
    const rawLines = sequence.split('\n');
    let seqsToPredict = [];
    let currentSeq = '';

    for (let line of rawLines) {
      line = line.trim();
      if (!line) continue;
      if (line.startsWith('>')) {
        if (currentSeq) {
          seqsToPredict.push(currentSeq);
          currentSeq = '';
        }
      } else {
        currentSeq += line;
      }
    }
    if (currentSeq) seqsToPredict.push(currentSeq);

    if (seqsToPredict.length === 0) {
      seqsToPredict = sequence.split(/[\s,]+/).filter(Boolean);
    }

    const validAA = /^[ACDEFGHIKLMNPQRSTVWY]+$/i;
    const finalSeqs = [];
    for (let seq of seqsToPredict) {
      const clean = seq.replace(/\s+/g, '');
      if (clean && validAA.test(clean)) {
        finalSeqs.push(clean.toUpperCase());
      }
    }

    if (finalSeqs.length === 0) {
      setError('No valid sequences found. Please enter valid amino acids.');
      return;
    }

    if (disabled) return;

    if (finalSeqs.length === 1) {
      onPredict(finalSeqs[0]);
    } else {
      setBatchProgress({ current: 0, total: finalSeqs.length });
      for (let i = 0; i < finalSeqs.length; i++) {
        setBatchProgress({ current: i + 1, total: finalSeqs.length });
        await onPredict(finalSeqs[i]);
        if (i < finalSeqs.length - 1) {
            await new Promise(r => setTimeout(r, 1500)); // Rate limit throttle
        }
      }
      setBatchProgress(null);
      setSequence(''); 
    }
  };

  const handleExample = () => {
    setSequence('>Spike Protein\nMKFLKFSLLTAVLLSVV\n>Another\nMAPKGK');
  };

  const isLoading = loading || !!batchProgress;

  return (
    <div className="prediction-form">
      <h3>Structure Prediction</h3>
      <p className="subtitle">
        {disabled
          ? 'Sign in to run structure predictions and save your history.'
          : 'Enter an amino acid sequence or upload a FASTA file.'}
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
             <label htmlFor="sequence">Amino Acid Sequence</label>
             <button type="button" className="text-btn" onClick={() => fileInputRef.current?.click()} style={{ fontSize: '0.8rem', padding: '0', background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer' }}>Upload FASTA</button>
             <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".fasta,.txt,.fa" style={{ display: 'none' }} />
          </div>
          <textarea
            id="sequence"
            placeholder="e.g. MKFLKFSLLTAVLLSVV..."
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            disabled={isLoading || disabled}
            rows={5}
          />
        </div>
        {error && <div className="error-message">{error}</div>}
        {batchProgress && (
          <div className="batch-progress" style={{ fontSize: '0.9rem', color: 'var(--primary-color)', marginBottom: '1rem', fontWeight: 500 }}>
            Batch Prediction: {batchProgress.current} of {batchProgress.total} sequences processed...
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="secondary-btn" onClick={handleExample} disabled={isLoading || disabled}>
            Load Example
          </button>
          <button type="submit" className="primary-btn" disabled={isLoading || disabled}>
            {isLoading ? (
              <span className="spinner-loader">Predicting...</span>
            ) : (
              'Run Prediction'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
