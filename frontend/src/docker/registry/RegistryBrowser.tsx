import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { showError, showSuccess } from '../../notification';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../utils/tableSorting';
import {
    GetDockerHubRepositoryDetails,
    GetImageDigest,
    GetRegistryRepositoryDetails,
    ListRegistryRepositories,
    ListRegistryTags,
    PullDockerImageLatest,
    SearchDockerHubRepositories,
    SearchRegistryRepositories,
} from '../swarmApi';
import './registry.css';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../utils/tableSorting.js';

type RegistryBrowserProps = {
  registryName?: string;
  registryType?: string;
};

type SearchResult = {
  fullName?: string;
  namespace?: string;
  name?: string;
  description?: string;
  starCount?: number;
  pullCount?: number;
  lastUpdated?: string;
  url?: string;
  sizeBytes?: number;
};

export default function RegistryBrowser({ registryName, registryType = '' }: RegistryBrowserProps) {
  const [repos, setRepos] = useState<string[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState('');

  const [tags, setTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [digestByTag, setDigestByTag] = useState<Record<string, string>>({});

  const [pulling, setPulling] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedSearchRepo, setSelectedSearchRepo] = useState<SearchResult | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectDetails, setInspectDetails] = useState<SearchResult | null>(null);
  const [inspectError, setInspectError] = useState('');

  const inspectReqIdRef = useRef(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const title = useMemo(() => registryName ? `Browse: ${registryName}` : 'Browse', [registryName]);

  useEffect(() => {
    if (!registryName) return;
    let alive = true;

    setReposLoading(true);
    setRepos([]);
    setSelectedRepo('');
    setTags([]);
    setDigestByTag({});

    setSearchResults([]);
    setSelectedSearchRepo(null);
    setInspectDetails(null);
    setInspectError('');

    ListRegistryRepositories(registryName)
      .then((items) => {
        if (!alive) return;
        const list = Array.isArray(items) ? items : [];
        setRepos(list as string[]);
        if (list.length > 0) setSelectedRepo(list[0] as string);
      })
      .catch((e) => {
        if (!alive) return;
        showError(`Failed to list repositories: ${e}`);
      })
      .finally(() => {
        if (!alive) return;
        setReposLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [registryName]);

  useEffect(() => {
    if (!registryName || !selectedRepo) return;
    let alive = true;

    setTagsLoading(true);
    setTags([]);
    setDigestByTag({});

    ListRegistryTags(registryName, selectedRepo)
      .then((items) => {
        if (!alive) return;
        const list = Array.isArray(items) ? items : [];
        setTags(list as string[]);

        // Best-effort digest loading in the background.
        // Avoid overloading the backend: cap to first 50 tags.
        const cap = list.slice(0, 50);
        Promise.allSettled(
          cap.map(async (tag) => {
            const digest = await GetImageDigest(registryName, selectedRepo, tag as string);
            return { tag, digest };
          })
        ).then((results) => {
          if (!alive) return;
          const next: Record<string, string> = {};
          for (const r of results) {
            if (r.status === 'fulfilled') {
              next[r.value.tag as string] = r.value.digest as string;
            }
          }
          setDigestByTag(next);
        });
      })
      .catch((e) => {
        if (!alive) return;
        showError(`Failed to list tags: ${e}`);
      })
      .finally(() => {
        if (!alive) return;
        setTagsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [registryName, selectedRepo]);

  const typeLower = String(registryType).toLowerCase();
  const isDockerHub = typeLower === 'dockerhub';
  const isArtifactory = typeLower === 'artifactory';
  const isV2Search = isArtifactory || typeLower === 'generic_v2';
  const supportsSearch = isDockerHub || isV2Search;

  const searchColumns = useMemo(() => {
    if (isDockerHub) {
      return [
        { key: 'fullName', label: 'Name' },
        { key: 'description', label: 'Description' },
        { key: 'starCount', label: 'Stars' },
        { key: 'pullCount', label: 'Pulls' },
        { key: 'lastUpdated', label: 'Updated' },
      ];
    }
    return [{ key: 'fullName', label: 'Name' }];
  }, [isDockerHub]);
  const defaultSearchSortKey = useMemo(() => pickDefaultSortKey(searchColumns), [searchColumns]);
  const [searchSort, setSearchSort] = useState(() => ({ key: defaultSearchSortKey, direction: 'asc' as 'asc' | 'desc' }));

  useEffect(() => {
    if (!defaultSearchSortKey) return;
    setSearchSort((cur) => {
      const hasKey = searchColumns.some((col) => col.key === cur?.key);
      if (cur?.key && hasKey) return cur;
      return { key: defaultSearchSortKey, direction: 'asc' };
    });
  }, [defaultSearchSortKey, searchColumns]);

  const sortedSearchResults = useMemo(() => {
    return sortRows(searchResults, searchSort.key, searchSort.direction, (row: unknown, key: string) => {
      const fullName = (row.fullName || (row.namespace && row.name ? `${row.namespace}/${row.name}` : '') || row.name || '').trim();
      if (key === 'fullName') return fullName;
      return row?.[key];
    });
  }, [searchResults, searchSort]);

  useEffect(() => {
    if (!supportsSearch) return;

    // Debounced search: automatically search 2s after user stops typing.
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    const q = String(searchQuery || '').trim();
    if (!q) {
      setSearchResults([]);
      setSelectedSearchRepo(null);
      setInspectDetails(null);
      setInspectError('');
      return;
    }

    searchDebounceRef.current = setTimeout(() => {
      runSearch();
    }, 2000);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, supportsSearch]);

  const dockerHubRepoURL = (fullName: string) => {
    const s = String(fullName || '').trim();
    if (!s) return '';

    // Official images: https://hub.docker.com/_/ubuntu
    if (!s.includes('/')) {
      return `https://hub.docker.com/_/${encodeURIComponent(s)}`;
    }

    const [ns, name] = s.split('/', 2);
    if (!ns || !name) return '';
    if (ns === 'library') {
      return `https://hub.docker.com/_/${encodeURIComponent(name)}`;
    }
    return `https://hub.docker.com/r/${encodeURIComponent(ns)}/${encodeURIComponent(name)}`;
  };

  const formatBytes = (value: number) => {
    const bytes = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    if (bytes <= 0) return '-';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i += 1;
    }
    const decimals = i === 0 ? 0 : (n < 10 ? 2 : 1);
    return `${n.toFixed(decimals)} ${units[i]}`;
  };

  const handlePullLatest = async (imageRef: string, registryForAuth?: string) => {
    const img = String(imageRef || '').trim();
    if (!img) return;
    setPulling(true);
    try {
      await PullDockerImageLatest(img, registryForAuth || '');
      showSuccess(`Pulled ${img.includes(':') ? img : `${img}:latest`}`);
    } catch (e) {
      showError(`Failed to pull image: ${e}`);
    } finally {
      setPulling(false);
    }
  };

  const formatRepoURL = (details: SearchResult | null) => {
    if (isDockerHub) return dockerHubRepoURL(details?.fullName || '');
    const u = String(details?.url || '').trim();
    return u;
  };

  const runSearch = async () => {
    const q = String(searchQuery || '').trim();
    if (!q) {
      setSearchResults([]);
      setSelectedSearchRepo(null);
      setInspectDetails(null);
      setInspectError('');
      return;
    }
    setSearchLoading(true);
    try {
      const results = isDockerHub
        ? await SearchDockerHubRepositories(q)
        : await SearchRegistryRepositories(registryName as string, q);
      const list = Array.isArray(results) ? results : [];
      setSearchResults(list as SearchResult[]);
      setSelectedSearchRepo(null);
      setInspectDetails(null);
      setInspectError('');
    } catch (e) {
      showError(`${isDockerHub ? 'Docker Hub' : 'Registry'} search failed: ${e}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const selectSearchRepo = (repo: SearchResult) => {
    if (!repo) return;
    const fullName = String(
      repo.fullName ||
      (repo.namespace && repo.name ? `${repo.namespace}/${repo.name}` : '') ||
      repo.name ||
      ''
    ).trim();

    const selected = { ...repo, fullName };
    setSelectedSearchRepo(selected);

    // Always show immediate feedback (fallback details) from the search response.
    setInspectDetails({
      fullName,
      description: repo.description || '',
      url: repo.url || '',
      sizeBytes: typeof repo.sizeBytes === 'number' ? repo.sizeBytes : 0,
      starCount: typeof repo.starCount === 'number' ? repo.starCount : 0,
      pullCount: typeof repo.pullCount === 'number' ? repo.pullCount : 0,
      lastUpdated: repo.lastUpdated || '',
    });
    setInspectError('');

    if (!supportsSearch) return;
    if (!fullName) {
      setInspectError('Selected result has no repository name.');
      return;
    }

    const reqId = ++inspectReqIdRef.current;
    setInspectLoading(true);
    const p = isDockerHub
      ? GetDockerHubRepositoryDetails(fullName)
      : GetRegistryRepositoryDetails(registryName as string, fullName);

    p.then((d) => {
        if (inspectReqIdRef.current !== reqId) return;
        // Merge details but never lose the target fullName; Wails can decode an empty object
        // (or a zero-value struct) which would otherwise wipe the fallback.
        if (!d) return;
        setInspectDetails((prev) => ({
          ...(prev || {}),
          ...(d as SearchResult),
          fullName: ((d as SearchResult).fullName && String((d as SearchResult).fullName).trim()) ? (d as SearchResult).fullName : fullName,
        }));
      })
      .catch((e) => {
        if (inspectReqIdRef.current !== reqId) return;
        const msg = String(e || '').trim() || 'Unknown error.';
        setInspectError(msg);
        showError(`Failed to inspect repository: ${msg}`);
      })
      .finally(() => {
        if (inspectReqIdRef.current !== reqId) return;
        setInspectLoading(false);
      });
  };

  const selectedSearchKey = selectedSearchRepo?.fullName || '';

  // Note: inspection is triggered directly by row click (selectSearchRepo)
  // to avoid reliance on effect timing/dependency edge cases.

  if (!registryName) return null;

  return (
    <div className="registry-browser">
      <div className="registry-browser__header">
        <div className="registry-browser__title">{title}</div>
        <div className="registry-browser__muted">Repositories and tags</div>
      </div>

      <div className="registry-browser__grid">
        <div className="registry-browser__list">
          <div className="registry-browser__listHeader">Repositories</div>
          {reposLoading ? (
            <div className="registry-browser__item"><span className="registry-browser__muted">Loading…</span></div>
          ) : repos.length === 0 ? (
            <div className="registry-browser__item"><span className="registry-browser__muted">No repositories</span></div>
          ) : (
            repos.map((r) => (
              <div
                key={r}
                className={`registry-browser__item${selectedRepo === r ? ' registry-browser__item--selected' : ''}`}
                onClick={() => setSelectedRepo(r)}
              >
                <span>{r}</span>
              </div>
            ))
          )}
        </div>

        <div className="registry-browser__list">
          <div className="registry-browser__listHeader registry-browser__listHeaderRow">
            <span>Tags</span>
            {selectedRepo ? (
              <button
                className="registry-action-btn"
                disabled={pulling}
                onClick={() => handlePullLatest(selectedRepo, registryName)}
                title="Pull latest"
              >
                Pull
              </button>
            ) : null}
          </div>
          {tagsLoading ? (
            <div className="registry-browser__item"><span className="registry-browser__muted">Loading…</span></div>
          ) : !selectedRepo ? (
            <div className="registry-browser__item"><span className="registry-browser__muted">Select a repository</span></div>
          ) : tags.length === 0 ? (
            <div className="registry-browser__item"><span className="registry-browser__muted">No tags</span></div>
          ) : (
            tags.map((t) => (
              <div key={t} className="registry-browser__item">
                <span>{t}</span>
                <span className="registry-browser__muted">{digestByTag[t] || '…'}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {supportsSearch ? (
        <div className="registry-search">
          <div className="registry-search__header">
            <div className="registry-search__title">Search {isDockerHub ? 'Docker Hub' : (isArtifactory ? 'Artifactory' : 'Registry')}</div>
            <div className="registry-search__controls">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchDebounceRef.current) {
                      clearTimeout(searchDebounceRef.current);
                      searchDebounceRef.current = null;
                    }
                    runSearch();
                  }
                }}
                placeholder="Search repositories…"
                aria-label={isDockerHub ? 'Search Docker Hub' : 'Search registry'}
              />
              <button className="registry-action-btn" onClick={runSearch} disabled={searchLoading}>
                Search
              </button>
            </div>
          </div>

          <table className="gh-table" style={{ width: '100%' }}>
            <thead>
              {isDockerHub ? (
                <tr>
                  <th aria-sort={searchSort.key === 'fullName' ? (searchSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="sortable-header" onClick={() => setSearchSort((cur) => toggleSortState(cur, 'fullName'))}>
                      <span>Name</span>
                      <span className="sortable-indicator" aria-hidden="true">{searchSort.key === 'fullName' ? (searchSort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th aria-sort={searchSort.key === 'description' ? (searchSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="sortable-header" onClick={() => setSearchSort((cur) => toggleSortState(cur, 'description'))}>
                      <span>Description</span>
                      <span className="sortable-indicator" aria-hidden="true">{searchSort.key === 'description' ? (searchSort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th aria-sort={searchSort.key === 'starCount' ? (searchSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="sortable-header" onClick={() => setSearchSort((cur) => toggleSortState(cur, 'starCount'))}>
                      <span>Stars</span>
                      <span className="sortable-indicator" aria-hidden="true">{searchSort.key === 'starCount' ? (searchSort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th aria-sort={searchSort.key === 'pullCount' ? (searchSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="sortable-header" onClick={() => setSearchSort((cur) => toggleSortState(cur, 'pullCount'))}>
                      <span>Pulls</span>
                      <span className="sortable-indicator" aria-hidden="true">{searchSort.key === 'pullCount' ? (searchSort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th aria-sort={searchSort.key === 'lastUpdated' ? (searchSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="sortable-header" onClick={() => setSearchSort((cur) => toggleSortState(cur, 'lastUpdated'))}>
                      <span>Updated</span>
                      <span className="sortable-indicator" aria-hidden="true">{searchSort.key === 'lastUpdated' ? (searchSort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                </tr>
              ) : (
                <tr>
                  <th aria-sort={searchSort.key === 'fullName' ? (searchSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="sortable-header" onClick={() => setSearchSort((cur) => toggleSortState(cur, 'fullName'))}>
                      <span>Name</span>
                      <span className="sortable-indicator" aria-hidden="true">{searchSort.key === 'fullName' ? (searchSort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                </tr>
              )}
            </thead>
            <tbody>
              {searchLoading ? (
                <tr><td colSpan={isDockerHub ? 5 : 1} className="main-panel-loading">Searching…</td></tr>
              ) : searchResults.length === 0 ? (
                <tr><td colSpan={isDockerHub ? 5 : 1} className="main-panel-loading">No results.</td></tr>
              ) : (
                sortedSearchResults.map((r: SearchResult) => {
                  const rowFullName = (r.fullName || (r.namespace && r.name ? `${r.namespace}/${r.name}` : '') || r.name || '').trim();
                  const rowKey = rowFullName || `${r.namespace || ''}/${r.name || ''}`;
                  const isSelected = Boolean(selectedSearchKey && selectedSearchKey === rowFullName);
                  const fallbackDetails: SearchResult = {
                    fullName: rowFullName,
                    description: r.description || '',
                    starCount: typeof r.starCount === 'number' ? r.starCount : 0,
                    pullCount: typeof r.pullCount === 'number' ? r.pullCount : 0,
                    lastUpdated: r.lastUpdated || '',
                    sizeBytes: typeof r.sizeBytes === 'number' ? r.sizeBytes : 0,
                  };
                  const details = isSelected ? (inspectDetails || fallbackDetails) : null;

                  return (
                    <Fragment key={rowKey}>
                      <tr
                        className={isSelected ? 'registry-search__row--selected' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => selectSearchRepo({ ...r, fullName: rowFullName })}
                      >
                        <td>{rowFullName || '-'}</td>
                        {isDockerHub ? (
                          <>
                            <td>{r.description || '-'}</td>
                            <td>{typeof r.starCount === 'number' ? r.starCount : '-'}</td>
                            <td>{typeof r.pullCount === 'number' ? r.pullCount : '-'}</td>
                            <td>{r.lastUpdated ? String(r.lastUpdated).slice(0, 10) : '-'}</td>
                          </>
                        ) : null}
                      </tr>

                      {isSelected ? (
                        <tr>
                          <td colSpan={isDockerHub ? 5 : 1} style={{ paddingTop: 0 }}>
                            <div className="registry-search__inspect" style={{ marginTop: 0 }}>
                              {inspectLoading ? (
                                <div className="registry-browser__muted" style={{ marginBottom: 8 }}>Loading details…</div>
                              ) : null}

                              {details ? (
                                <>
                                  <div className="registry-search__inspectGrid">
                                    <div>
                                      <div className="registry-search__inspectLabel">Repository</div>
                                      <div className="registry-search__inspectValue">{details.fullName || rowFullName}</div>
                                    </div>
                                    <div>
                                      <div className="registry-search__inspectLabel">URL</div>
                                      <div className="registry-search__inspectValue">
                                        {formatRepoURL(details) ? (
                                          <a
                                            href={formatRepoURL(details)}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ color: 'inherit', textDecoration: 'underline' }}
                                          >
                                            {formatRepoURL(details)}
                                          </a>
                                        ) : (
                                          '-'
                                        )}
                                      </div>
                                    </div>
                                    {isDockerHub ? (
                                      <div>
                                        <div className="registry-search__inspectLabel">Description</div>
                                        <div className="registry-search__inspectValue">{details.description || '-'}</div>
                                      </div>
                                    ) : null}
                                    <div>
                                      <div className="registry-search__inspectLabel">Size</div>
                                      <div className="registry-search__inspectValue">{formatBytes(typeof details.sizeBytes === 'number' ? details.sizeBytes : 0)}</div>
                                    </div>
                                    {isDockerHub ? (
                                      <>
                                        <div>
                                          <div className="registry-search__inspectLabel">Stars</div>
                                          <div className="registry-search__inspectValue">{details.starCount ?? '-'}</div>
                                        </div>
                                        <div>
                                          <div className="registry-search__inspectLabel">Pulls</div>
                                          <div className="registry-search__inspectValue">{details.pullCount ?? '-'}</div>
                                        </div>
                                        <div>
                                          <div className="registry-search__inspectLabel">Last Updated</div>
                                          <div className="registry-search__inspectValue">{details.lastUpdated ? String(details.lastUpdated).slice(0, 19) : '-'}</div>
                                        </div>
                                      </>
                                    ) : null}
                                    <div className="registry-search__inspectActions">
                                      <button
                                        className="registry-action-btn"
                                        disabled={pulling}
                                        onClick={() => handlePullLatest((details.fullName || rowFullName), registryName)}
                                      >
                                        Pull
                                      </button>
                                    </div>
                                    {inspectError ? (
                                      <div style={{ gridColumn: '1 / -1' }}>
                                        <div className="registry-search__inspectLabel">Error</div>
                                        <div className="registry-search__inspectValue">{inspectError}</div>
                                      </div>
                                    ) : null}
                                  </div>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

