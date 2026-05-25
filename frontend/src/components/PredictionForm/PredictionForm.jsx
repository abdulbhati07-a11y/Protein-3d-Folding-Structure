import { useState } from 'react';
import './PredictionForm.css';

export default function PredictionForm({ onPredict, loading, disabled = false }) {
  const [sequence, setSequence] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const cleanSequence = sequence.replace(/\s+/g, '');

    if (!cleanSequence) {
      setError('Sequence cannot be empty');
      return;
    }

    // Basic validation
    const validAA = /^[ACDEFGHIKLMNPQRSTVWY]+$/i;
    if (!validAA.test(cleanSequence)) {
      setError('Invalid amino acids in sequence');
      return;
    }

    if (disabled) return;
    onPredict(cleanSequence.toUpperCase());
  };

  const handleExample = () => {
    setSequence('MKFLKFSLLTAVLLSVV');
  };

  return (
    <div className="prediction-form">
      <h3>Structure Prediction</h3>
      <p className="subtitle">
        {disabled
          ? 'Sign in to run structure predictions and save your history.'
          : 'Enter an amino acid sequence to predict its 3D structure.'}
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="sequence">Amino Acid Sequence</label>
          <textarea
            id="sequence"
            placeholder="e.g. MKFLKFSLLTAVLLSVV..."
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            disabled={loading || disabled}
            rows={5}
          />
        </div>
        {error && <div className="error-message">{error}</div>}
        <div className="form-actions">
          <button type="button" className="secondary-btn" onClick={handleExample} disabled={loading || disabled}>
            Load Example
          </button>
          <button type="submit" className="primary-btn" disabled={loading || disabled}>
            {loading ? (
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
