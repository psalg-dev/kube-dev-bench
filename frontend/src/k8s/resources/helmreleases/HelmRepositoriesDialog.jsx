import React, { useState, useEffect } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

export default function HelmRepositoriesDialog({ onClose }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadRepos();
  }, []);

  const loadRepos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await AppAPI.GetHelmRepositories();
      setRepos(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load repositories');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newRepoName.trim() || !newRepoUrl.trim()) {
      setError('Name and URL are required');
      return;
    }

    setAdding(true);
    setError(null);
    try {
      await AppAPI.AddHelmRepository(newRepoName.trim(), newRepoUrl.trim());
      setNewRepoName('');
      setNewRepoUrl('');
      setShowAddForm(false);
      await loadRepos();
    } catch (err) {
      setError(err.message || 'Failed to add repository');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (name) => {
    if (!window.confirm(`Remove repository "${name}"?`)) return;

    setDeleting(name);
    setError(null);
    try {
      await AppAPI.RemoveHelmRepository(name);
      await loadRepos();
    } catch (err) {
      setError(err.message || 'Failed to remove repository');
    } finally {
      setDeleting(null);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setError(null);
    try {
      await AppAPI.UpdateHelmRepositories();
      await loadRepos();
    } catch (err) {
      setError(err.message || 'Failed to update repositories');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--gh-canvas-subtle, #161b22)',
          border: '1px solid var(--gh-border, #30363d)',
          borderRadius: 8,
          padding: 24,
          width: 600,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: 'var(--gh-text, #c9d1d9)' }}>
            Helm Repositories
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleUpdate}
              disabled={updating || repos.length === 0}
              style={{
                padding: '6px 12px',
                background: updating ? '#666' : 'var(--gh-btn-bg, #21262d)',
                color: 'var(--gh-btn-text, #c9d1d9)',
                border: '1px solid var(--gh-border, #30363d)',
                borderRadius: 6,
                cursor: updating || repos.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 13,
              }}
            >
              {updating ? 'Updating...' : 'Update All'}
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                padding: '6px 12px',
                background: 'var(--gh-btn-bg, #238636)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Add Repository
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: 12, background: 'rgba(215, 58, 73, 0.1)', border: '1px solid #d73a49', borderRadius: 6, color: '#d73a49', fontSize: 13 }}>
            {error}
          </div>
        )}

        {showAddForm && (
          <form onSubmit={handleAdd} style={{ marginBottom: 20, padding: 16, background: 'var(--gh-canvas-default, #0d1117)', borderRadius: 6, border: '1px solid var(--gh-border, #30363d)' }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text, #c9d1d9)', fontSize: 13 }}>
                Name
              </label>
              <input
                type="text"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder="e.g., bitnami"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--gh-canvas-subtle, #161b22)',
                  border: '1px solid var(--gh-border, #30363d)',
                  borderRadius: 6,
                  color: 'var(--gh-text, #c9d1d9)',
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text, #c9d1d9)', fontSize: 13 }}>
                URL
              </label>
              <input
                type="text"
                value={newRepoUrl}
                onChange={(e) => setNewRepoUrl(e.target.value)}
                placeholder="e.g., https://charts.bitnami.com/bitnami"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--gh-canvas-subtle, #161b22)',
                  border: '1px solid var(--gh-border, #30363d)',
                  borderRadius: 6,
                  color: 'var(--gh-text, #c9d1d9)',
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewRepoName('');
                  setNewRepoUrl('');
                }}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  color: 'var(--gh-text, #c9d1d9)',
                  border: '1px solid var(--gh-border, #30363d)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adding}
                style={{
                  padding: '6px 12px',
                  background: adding ? '#666' : 'var(--gh-btn-bg, #238636)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: adding ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                }}
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--gh-text-muted, #8b949e)' }}>
            Loading repositories...
          </div>
        ) : repos.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--gh-text-muted, #8b949e)' }}>
            No repositories configured. Add a repository to start searching for charts.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--gh-border, #30363d)', color: 'var(--gh-text-muted, #8b949e)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>URL</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', width: 80 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {repos.map((repo) => (
                <tr key={repo.name} style={{ borderBottom: '1px solid var(--gh-border, #30363d)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--gh-text, #c9d1d9)', fontWeight: 500 }}>
                    {repo.name}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--gh-text-muted, #8b949e)', wordBreak: 'break-all' }}>
                    {repo.url}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleRemove(repo.name)}
                      disabled={deleting !== null}
                      style={{
                        padding: '4px 10px',
                        background: deleting === repo.name ? '#666' : '#d73a49',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: deleting !== null ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                      }}
                    >
                      {deleting === repo.name ? '...' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'var(--gh-btn-bg, #21262d)',
              color: 'var(--gh-btn-text, #c9d1d9)',
              border: '1px solid var(--gh-border, #30363d)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
