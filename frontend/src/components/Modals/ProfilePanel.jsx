import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/auth-context';
import { updateProfile } from '../../services/api';
import '../Common/Modal.css';
import './ProfilePanel.css';

export function ProfilePanel({ isOpen, onClose }) {
  const { user, profile, session } = useContext(AuthContext);
  const [displayName, setDisplayName] = useState('');
  const [theme, setTheme] = useState('light');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayName(profile.display_name || '');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(profile.theme || 'light');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBio(profile.bio || '');
    }
  }, [profile, isOpen]);

  const handleSave = async () => {
    if (!session?.access_token) {
      setMessage('Not authenticated');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await updateProfile(session.access_token, {
        display_name: displayName,
        theme,
        bio,
      });
      setMessage('Profile updated successfully!');
      setTimeout(() => {
        setMessage('');
        onClose();
      }, 2000);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content profile-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Profile Settings</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              className="form-control"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="theme">Theme Preference</label>
            <select
              id="theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="form-control"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto</option>
            </select>
          </div>

          {message && (
            <div className={`alert ${message.includes('Error') ? 'alert-danger' : 'alert-success'}`}>
              {message}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
