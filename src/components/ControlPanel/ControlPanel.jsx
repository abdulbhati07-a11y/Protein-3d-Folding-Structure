import './ControlPanel.css';

export default function ControlPanel({ settings, onSettingsChange }) {
  const handleRenderModeChange = (e) => {
    onSettingsChange({ ...settings, renderMode: e.target.value });
  };

  const handleColorSchemeChange = (e) => {
    onSettingsChange({ ...settings, colorScheme: e.target.value });
  };

  return (
    <div className="control-panel">
      <h3>Visualization Controls</h3>
      
      <div className="control-group">
        <label htmlFor="renderMode">Render Mode</label>
        <select id="renderMode" value={settings.renderMode} onChange={handleRenderModeChange}>
          <option value="spheres">Spheres (Space Filling)</option>
          <option value="sticks">Sticks</option>
          <option value="cartoon">Cartoon Ribbon</option>
        </select>
      </div>

      <div className="control-group">
        <label htmlFor="colorScheme">Color Scheme</label>
        <select id="colorScheme" value={settings.colorScheme} onChange={handleColorSchemeChange}>
          <option value="confidence">By Confidence (pLDDT)</option>
          <option value="structure">By Secondary Structure</option>
          <option value="element">By Element</option>
        </select>
      </div>

      <div className="control-group">
        <label>Display Options</label>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={settings.showBonds} 
              onChange={(e) => onSettingsChange({ ...settings, showBonds: e.target.checked })}
            />
            Show Bonds
          </label>
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={settings.showLabels} 
              onChange={(e) => onSettingsChange({ ...settings, showLabels: e.target.checked })}
            />
            Show Labels
          </label>
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={settings.showPockets || false} 
              onChange={(e) => onSettingsChange({ ...settings, showPockets: e.target.checked })}
            />
            Highlight Pockets
          </label>
        </div>
      </div>
    </div>
  );
}
