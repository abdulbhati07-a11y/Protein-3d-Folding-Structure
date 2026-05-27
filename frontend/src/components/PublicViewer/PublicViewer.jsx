import { useEffect, useState } from 'react';
import { fetchPublicPrediction } from '../../services/api';
import ProteinViewer from '../ProteinViewer/ProteinViewer';
import './PublicViewer.css';

export function PublicViewer({ predictionId }) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!predictionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('No prediction ID provided');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    const loadPrediction = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchPublicPrediction(predictionId);
        setPrediction(data);
      } catch (err) {
        setError(`Failed to load prediction: ${err.message}`);
        console.error('Error loading public prediction:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPrediction();
  }, [predictionId]);

  if (loading) {
    return (
      <div className="public-viewer">
        <div className="loading">
          <p>Loading prediction...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-viewer">
        <div className="error">
          <p className="error-message">{error}</p>
          <p className="error-hint">
            The prediction may have been deleted or made private.
          </p>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="public-viewer">
        <div className="error">
          <p className="error-message">Prediction not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-viewer">
      <div className="viewer-header">
        <h1>Shared Protein Structure</h1>
        <div className="prediction-metadata">
          <div className="metadata-item">
            <span className="label">Sequence Length:</span>
            <span className="value">{prediction.length} amino acids</span>
          </div>
          <div className="metadata-item">
            <span className="label">Model:</span>
            <span className="value">{prediction.model_source}</span>
          </div>
          {prediction.notes && (
            <div className="metadata-item full-width">
              <span className="label">Notes:</span>
              <span className="value">{prediction.notes}</span>
            </div>
          )}
          {prediction.tags && prediction.tags.length > 0 && (
            <div className="metadata-item full-width">
              <span className="label">Tags:</span>
              <div className="tags">
                {prediction.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="viewer-content">
        {prediction.coordinates && prediction.structure && (
          <ProteinViewer
            coordinates={prediction.coordinates}
            structure={prediction.structure}
            bindingPockets={prediction.binding_pockets}
            isReadOnly={true}
          />
        )}
      </div>

      <div className="viewer-footer">
        <p className="disclaimer">
          This is a shared protein structure prediction. To create your own predictions,
          {' '}
          <a href="/">visit the prediction tool</a>
          .
        </p>
      </div>
    </div>
  );
}
