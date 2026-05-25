import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import './AuthModal.css';

export default function AuthModal({ mode, onClose, onSwitchMode }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSignUp = mode === 'signup';
  const isReset = mode === 'reset';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isReset) {
        const { error: resetError } = await resetPassword(email);
        if (resetError) {
          setError(resetError.message);
          return;
        }
        setSuccess('Password reset email sent. Check your inbox.');
        // Don't auto-close — let the user read the message
        return;
      }

      if (isSignUp) {
        const { data, error: signUpError } = await signUp(email, password, displayName);
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        if (data?.session) {
          setSuccess('Account created. You are signed in.');
          setTimeout(onClose, 1200);
        } else {
          setSuccess('Check your email to confirm your account, then sign in.');
          setTimeout(onClose, 2500);
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError.message);
          return;
        }
        setSuccess('Signed in successfully.');
        setTimeout(onClose, 1000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const title = isReset ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back';

  return (
    <div className="auth-modal-overlay" onClick={onClose} role="presentation">
      <div className="auth-modal-content stats-panel" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h3>{title}</h3>
          <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {success ? (
          <div className="auth-success-block">
            <p className="auth-success">{success}</p>
            {isReset && (
              <button
                type="button"
                className="auth-back-link"
                onClick={() => onSwitchMode('signin')}
              >
                ← Back to Sign In
              </button>
            )}
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="auth-form-group">
                <label htmlFor="displayName">Display name</label>
                <input
                  id="displayName"
                  type="text"
                  placeholder="e.g. biochemist42"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}

            <div className="auth-form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {!isReset && (
              <div className="auth-form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
                {!isSignUp && (
                  <button
                    type="button"
                    className="auth-forgot-link"
                    onClick={() => onSwitchMode('reset')}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            {isReset && (
              <p className="auth-reset-hint">
                Enter your email and we'll send you a link to reset your password.
              </p>
            )}

            {error && <p className="auth-error">{error}</p>}

            <button
              type="submit"
              className="primary-btn auth-submit-btn"
              disabled={submitting}
            >
              {submitting
                ? 'Please wait…'
                : isReset
                  ? 'Send Reset Email'
                  : isSignUp
                    ? 'Register'
                    : 'Sign In'}
            </button>

            <p className="auth-switch">
              {isReset ? (
                <>
                  Remember your password?
                  <a
                    href="#signin"
                    onClick={(e) => { e.preventDefault(); onSwitchMode('signin'); }}
                  >
                    Sign In
                  </a>
                </>
              ) : isSignUp ? (
                <>
                  Already have an account?
                  <a
                    href="#signin"
                    onClick={(e) => { e.preventDefault(); onSwitchMode('signin'); }}
                  >
                    Sign In
                  </a>
                </>
              ) : (
                <>
                  New here?
                  <a
                    href="#signup"
                    onClick={(e) => { e.preventDefault(); onSwitchMode('signup'); }}
                  >
                    Register
                  </a>
                </>
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
