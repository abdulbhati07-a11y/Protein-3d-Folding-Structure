import { useState, useEffect, useCallback } from 'react';
import { apiFetch, isEsmfoldSource } from './config/api';
import { useAuth } from './hooks/useAuth';
import AuthModal from './components/AuthModal/AuthModal';
import PredictionForm from './components/PredictionForm/PredictionForm';
import ProteinViewer from './components/ProteinViewer/ProteinViewer';
import StructureAnalysis from './components/StructureAnalysis/StructureAnalysis';
import ControlPanel from './components/ControlPanel/ControlPanel';
import ExportPanel from './components/ExportPanel/ExportPanel';
import ThemeSwitcher from './components/ThemeSwitcher/ThemeSwitcher';
import './App.css';

function App() {
  const { user, session, loading: authLoading, isConfigured, signOut, displayName } = useAuth();
  const [coordinates, setCoordinates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [predictionData, setPredictionData] = useState(null);
  const [refCoordinates, setRefCoordinates] = useState([]);
  const [refPredictionData, setRefPredictionData] = useState(null);
  const [history, setHistory] = useState([]);
  const [authModal, setAuthModal] = useState(null);
  const [settings, setSettings] = useState({
    renderMode: 'spheres',
    colorScheme: 'confidence',
    showBonds: true,
    showLabels: false,
    showPockets: false,
  });

  const canUseApp = !isConfigured || Boolean(session?.access_token);
  const visibleHistory = canUseApp ? history : [];

  const fetchHistory = useCallback(async () => {
    if (!canUseApp) return;
    try {
      const response = await apiFetch('/api/predictions/history');
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      } else if (response.status === 401) {
        setHistory([]);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, [canUseApp]);

  useEffect(() => {
    if (authLoading || !canUseApp) return undefined;
    let active = true;
    const init = async () => {
      try {
        const response = await apiFetch('/api/predictions/history');
        if (response.ok && active) {
          const data = await response.json();
          setHistory(data);
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [authLoading, canUseApp]);

  const loadHistoryItem = async (predId) => {
    if (!canUseApp) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`/api/predictions/history/${predId}`);
      if (response.ok) {
        const data = await response.json();
        setCoordinates(data.coordinates);
        setPredictionData(data);
      } else if (response.status === 401) {
        setError('Please sign in to view predictions.');
      } else {
        setError('Failed to load history item');
      }
    } catch (err) {
      setError('Failed to load history item due to network error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePredict = async (sequence) => {
    if (!canUseApp) {
      setAuthModal('signin');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/predictions/predict', {
        method: 'POST',
        body: JSON.stringify({ sequence }),
      });

      const data = await response.json();

      if (response.ok) {
        setCoordinates(data.coordinates);
        setPredictionData(data);
        fetchHistory();
      } else if (response.status === 401) {
        setError('Session expired or invalid. Please sign in again.');
        setAuthModal('signin');
      } else {
        setError(data.message || 'Failed to predict structure');
      }
    } catch (err) {
      setError('Network error. Is the backend running on port 5000?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setCoordinates([]);
    setPredictionData(null);
    setRefCoordinates([]);
    setRefPredictionData(null);
    setHistory([]);
    setError('');
  };

  const handleDeletePrediction = async (e, predId) => {
    // Stop the click from bubbling up to the history-item load handler
    e.stopPropagation();
    try {
      const response = await apiFetch(`/api/predictions/history/${predId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setHistory(prev => prev.filter(item => item.prediction_id !== predId));
        // Clear viewer if the deleted item is currently displayed
        if (predictionData?.prediction_id === predId) {
          setCoordinates([]);
          setPredictionData(null);
        }
        if (refPredictionData?.prediction_id === predId) {
          setRefCoordinates([]);
          setRefPredictionData(null);
        }
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message || 'Failed to delete prediction');
      }
    } catch (err) {
      setError('Network error while deleting prediction');
      console.error(err);
    }
  };

  return (
    <div className="app-container">
      {loading && <div className="top-progress-bar" />}
      <header className="app-header">
        <div className="header-main">
          <div className="header-brand">
            <div className="header-title-row">
              <h1>
                <span className="header-icon" aria-hidden="true">🧬 </span>
                Protein Folding Explorer
              </h1>
              <span className="badge">v1.0.0</span>
            </div>
            <p className="header-tagline">
              ML-Powered 3D Structure Prediction &amp; Visualization
            </p>
          </div>
          <div className="header-actions">
            <ThemeSwitcher />
            <div className="header-auth">
              {authLoading ? (
                <span className="header-user">Loading…</span>
              ) : user ? (
                <>
                  <span className="header-user" title={user.email}>
                    {displayName || user.email}
                  </span>
                  <button type="button" className="secondary-btn" onClick={handleSignOut}>
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="secondary-btn" onClick={() => setAuthModal('signin')}>
                    Sign In
                  </button>
                  <button type="button" className="primary-btn" onClick={() => setAuthModal('signup')}>
                    Register
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {isConfigured && !user && !authLoading && (
        <div className="auth-banner">
          <p>Sign in to save predictions and access your personal history.</p>
          <button type="button" className="primary-btn" onClick={() => setAuthModal('signin')}>
            Sign In
          </button>
        </div>
      )}

      <main className="app-main">
        <div className="left-column">
          <PredictionForm
            onPredict={handlePredict}
            loading={loading}
            disabled={!canUseApp}
          />
          <ControlPanel settings={settings} onSettingsChange={setSettings} />

          {visibleHistory.length > 0 && (
            <div className="prediction-history-panel stats-panel">
              <h3>Prediction History</h3>
              <div className="history-list">
                {visibleHistory.map((item) => (
                  <div
                    key={item.prediction_id}
                    className={`history-item ${predictionData?.prediction_id === item.prediction_id ? 'active-history' : ''}`}
                    onClick={() => loadHistoryItem(item.prediction_id)}
                    onKeyDown={(e) => e.key === 'Enter' && loadHistoryItem(item.prediction_id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '60%' }}>
                      <span className="history-seq">{item.sequence}</span>
                      <span className="history-meta">
                        Len: {item.length} • {isEsmfoldSource(item.model_source) ? '✨ ESMFold' : '🤖 Fallback'}
                      </span>
                    </div>
                    <div className="history-item-actions">
                      <span className="history-time">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        type="button"
                        className="history-delete-btn"
                        aria-label="Delete prediction"
                        title="Delete"
                        onClick={(e) => handleDeletePrediction(e, item.prediction_id)}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="error-alert">
              <strong>Error:</strong> {error}
            </div>
          )}

          {predictionData && !loading && (
            <>
              <div className="stats-panel">
                <h3>Structure Info</h3>
                <div className="stat-grid">
                  <div className="stat-card">
                    <label>Residues</label>
                    <span>{predictionData.length}</span>
                  </div>
                  <div className="stat-card">
                    <label>Confidence</label>
                    <span>{(predictionData.structure.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="stat-card">
                    <label>Binding Pockets</label>
                    <span>{predictionData.binding_pockets?.count || 0}</span>
                  </div>
                </div>
                <div className="stat-actions">
                  <button type="button" className="secondary-btn" onClick={() => {
                    setRefCoordinates(coordinates);
                    setRefPredictionData(predictionData);
                  }}>
                    Set as Reference
                  </button>
                  {refPredictionData && (
                    <button
                      type="button"
                      className="secondary-btn btn-danger"
                      onClick={() => {
                        setRefCoordinates([]);
                        setRefPredictionData(null);
                      }}
                    >
                      Clear Reference
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="right-column">
          <ProteinViewer
            coordinates={coordinates}
            settings={settings}
            predictionData={predictionData}
            coordinates2={refCoordinates}
            predictionData2={refPredictionData}
          />

          {predictionData && !loading && (
            <>
              <StructureAnalysis predictionData={predictionData} />
              <ExportPanel predictionData={predictionData} />
            </>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>@2026 Made By Muhammad Abdullah Bhatti</p>
      </footer>

      {authModal && (
        <AuthModal
          mode={authModal}
          onClose={() => setAuthModal(null)}
          onSwitchMode={setAuthModal}
        />
      )}
    </div>
  );
}

export default App;
