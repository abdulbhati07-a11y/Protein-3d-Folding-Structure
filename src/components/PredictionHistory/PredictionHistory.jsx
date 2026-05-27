import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/auth-context';
import {
  fetchPredictionHistory,
  fetchProjects,
  deletePrediction,
  updatePredictionSharing,
} from '../../services/api';
import './PredictionHistory.css';

export function PredictionHistory() {
  const { user, session, loading: authLoading } = useContext(AuthContext);
  const [predictions, setPredictions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [expandedPrediction, setExpandedPrediction] = useState(null);
  const [message, setMessage] = useState('');

  // Fetch history and projects
  useEffect(() => {
    if (!user || !session?.access_token || authLoading) {
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [historyData, projectsData] = await Promise.all([
          fetchPredictionHistory(session.access_token, 50),
          fetchProjects(session.access_token),
        ]);
        setPredictions(historyData);
        setProjects(projectsData);
      } catch (error) {
        setMessage(`Error loading history: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, session, authLoading]);

  const handleDelete = async (predictionId) => {
    if (!window.confirm('Are you sure you want to delete this prediction?')) {
      return;
    }

    try {
      await deletePrediction(session.access_token, predictionId);
      setPredictions((prev) => prev.filter((p) => p.prediction_id !== predictionId));
      setMessage('Prediction deleted successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`Error deleting: ${error.message}`);
    }
  };

  const handleToggleShare = async (predictionId, currentIsPublic) => {
    try {
      await updatePredictionSharing(
        session.access_token,
        predictionId,
        !currentIsPublic,
      );
      setPredictions((prev) =>
        prev.map((p) =>
          p.prediction_id === predictionId
            ? { ...p, is_public: !currentIsPublic }
            : p,
        ),
      );
      setMessage(
        `Prediction ${!currentIsPublic ? 'shared' : 'unshared'} successfully`,
      );
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`Error updating share: ${error.message}`);
    }
  };

  const handleCopyShareLink = (predictionId) => {
    const shareUrl = `${window.location.origin}/shared/${predictionId}`;
    navigator.clipboard.writeText(shareUrl);
    setMessage('Share link copied to clipboard!');
    setTimeout(() => setMessage(''), 3000);
  };

  // Filter predictions by selected project
  const filteredPredictions = selectedProject
    ? predictions.filter((p) => p.project_id === selectedProject)
    : predictions;

  const unassignedCount = predictions.filter((p) => !p.project_id).length;

  if (authLoading) {
    return <div className="prediction-history-loading">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="prediction-history-empty">
        <p>Please log in to view your prediction history.</p>
      </div>
    );
  }

  return (
    <div className="prediction-history">
      <h2>Prediction History</h2>

      {message && <div className="alert alert-info">{message}</div>}

      {/* Projects Filter */}
      <div className="projects-filter">
        <button
          className={`project-tag ${!selectedProject ? 'active' : ''}`}
          onClick={() => setSelectedProject(null)}
        >
          All ({predictions.length})
        </button>
        {unassignedCount > 0 && (
          <button
            className={`project-tag ${selectedProject === '' ? 'active' : ''}`}
            onClick={() => setSelectedProject('')}
          >
            Unassigned ({unassignedCount})
          </button>
        )}
        {projects.map((proj) => {
          const count = predictions.filter((p) => p.project_id === proj.id).length;
          return (
            <button
              key={proj.id}
              className={`project-tag ${selectedProject === proj.id ? 'active' : ''}`}
              onClick={() => setSelectedProject(proj.id)}
            >
              {proj.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Predictions List */}
      {loading ? (
        <div className="prediction-history-loading">Loading predictions...</div>
      ) : filteredPredictions.length === 0 ? (
        <div className="prediction-history-empty">
          <p>No predictions in this view.</p>
        </div>
      ) : (
        <div className="predictions-list">
          {filteredPredictions.map((pred) => (
            <div
              key={pred.prediction_id}
              className={`prediction-item ${expandedPrediction === pred.prediction_id ? 'expanded' : ''}`}
            >
              <div
                className="prediction-header"
                onClick={() =>
                  setExpandedPrediction(
                    expandedPrediction === pred.prediction_id
                      ? null
                      : pred.prediction_id,
                  )
                }
              >
                <div className="prediction-info">
                  <span className="prediction-id">{pred.prediction_id}</span>
                  <span className="prediction-length">
                    Length: {pred.length} aa
                  </span>
                  {pred.project_id && (
                    <span className="prediction-project">
                      {projects.find((p) => p.id === pred.project_id)?.name || 'Unknown Project'}
                    </span>
                  )}
                </div>
                <div className="prediction-date">
                  {new Date(pred.timestamp).toLocaleDateString()}
                </div>
              </div>

              {expandedPrediction === pred.prediction_id && (
                <div className="prediction-details">
                  {pred.notes && (
                    <div className="prediction-notes">
                      <strong>Notes:</strong> {pred.notes}
                    </div>
                  )}
                  {pred.tags && pred.tags.length > 0 && (
                    <div className="prediction-tags">
                      {pred.tags.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="prediction-actions">
                    <button
                      className={`btn btn-small ${pred.is_public ? 'btn-warning' : 'btn-success'}`}
                      onClick={() =>
                        handleToggleShare(pred.prediction_id, pred.is_public)
                      }
                    >
                      {pred.is_public ? 'Unshare' : 'Share'}
                    </button>
                    {pred.is_public && (
                      <button
                        className="btn btn-small btn-info"
                        onClick={() => handleCopyShareLink(pred.prediction_id)}
                      >
                        Copy Link
                      </button>
                    )}
                    <button
                      className="btn btn-small btn-primary"
                      onClick={() => {
                        // TODO: Navigate to view this prediction
                        console.log('View prediction:', pred.prediction_id);
                      }}
                    >
                      View
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => handleDelete(pred.prediction_id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
