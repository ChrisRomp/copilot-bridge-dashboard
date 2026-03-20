import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useData.js';
import { getFiles, getFileDownloadUrl, getFilePreviewUrl, isImageFile, uploadFiles, getBridgeHome } from '../lib/api.js';
import { Loading, ErrorBox, EmptyState, formatBytes, formatDate } from '../components/Common.js';
import { CodeViewer } from '../components/CodeViewer.js';

const FALLBACK_HOME = '/tmp/.copilot-bridge';

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'mdx', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'xml',
  'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'sh', 'bash', 'zsh',
  'py', 'rb', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'hpp', 'cs', 'swift', 'sql',
  'env', 'gitignore', 'dockerignore', 'editorconfig', 'log', 'csv',
  'diff', 'patch', 'graphql', 'makefile', 'dockerfile',
  'example', 'bak', 'orig', 'sample', 'template',
]);

function isTextFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (name.startsWith('.') && !ext) return true;
  // Check compound extensions: config.json.bak → check json
  const parts = name.split('.');
  if (parts.length > 2) {
    for (let i = 1; i < parts.length - 1; i++) {
      if (TEXT_EXTENSIONS.has(parts[i].toLowerCase())) return true;
    }
  }
  return false;
}

function relativeToBridgeHome(absPath: string, home: string): string {
  if (absPath.startsWith(home)) {
    const rel = absPath.slice(home.length);
    return rel.startsWith('/') ? rel.slice(1) : rel;
  }
  return absPath;
}

export function Files() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPath = searchParams.get('path') ?? '';
  const viewingFile = searchParams.get('file');

  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [bridgeHome, setBridgeHome] = useState<string | null>(null);

  // Fetch bridge home on mount
  useEffect(() => {
    getBridgeHome().then(setBridgeHome);
  }, []);

  // Load file content whenever viewingFile changes (including initial load and back/forward)
  useEffect(() => {
    if (!viewingFile) {
      setFileContent(null);
      setLoadingFile(false);
      return;
    }
    // Image files render via <img src> — skip the content API fetch
    if (isImageFile(viewingFile)) {
      setFileContent(null);
      setLoadingFile(false);
      return;
    }
    let cancelled = false;
    setLoadingFile(true);
    setFileContent(null);
    (async () => {
      try {
        const resp = await getFiles(viewingFile);
        if (cancelled) return;
        if (resp.type === 'file' && !resp.binary) {
          setFileContent(resp.content);
        } else {
          setFileContent('Binary file \u2014 use download link');
        }
      } catch {
        if (!cancelled) setFileContent('Error loading file content');
      } finally {
        if (!cancelled) setLoadingFile(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viewingFile]);

  const home = bridgeHome ?? FALLBACK_HOME;

  const fetcher = useCallback(() => getFiles(currentPath || undefined, showHidden), [currentPath, showHidden]);
  const { data, loading, error, reload } = useFetch(fetcher, [currentPath, showHidden]);

  const relPath = currentPath ? relativeToBridgeHome(currentPath, home) : '';
  const segments = relPath ? relPath.split('/').filter(Boolean) : [];

  function navigateTo(path: string) {
    const params: Record<string, string> = {};
    if (path) params.path = path;
    setSearchParams(params);
    setFileContent(null);
  }

  function navigateToSegment(index: number) {
    const rel = segments.slice(0, index + 1).join('/');
    navigateTo(home + '/' + rel);
  }

  async function viewFile(filePath: string) {
    // Push file view into URL — the useEffect on viewingFile handles fetching
    const params: Record<string, string> = {};
    if (currentPath) params.path = currentPath;
    params.file = filePath;
    setSearchParams(params);
  }

  function closeFile() {
    const params: Record<string, string> = {};
    if (currentPath) params.path = currentPath;
    setSearchParams(params);
    setFileContent(null);
  }

  // Upload state
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function doUpload(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const targetDir = currentPath || paths.bridgeHome;
      const result = await uploadFiles(files, targetDir);
      setUploadResult(`Uploaded ${result.uploaded.length} file${result.uploaded.length > 1 ? 's' : ''}`);
      reload();
      setTimeout(() => setUploadResult(null), 3000);
    } catch (err: any) {
      setUploadResult(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;
    const files = Array.from(e.dataTransfer.files);
    doUpload(files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    doUpload(files);
    e.target.value = '';
  }

  // Need bridge home available for upload target
  const paths = { bridgeHome: home };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {/* Drag overlay */}
      {dragging && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(59, 130, 246, 0.15)',
          border: '3px dashed var(--accent)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: 24, fontWeight: 600, color: 'var(--accent)',
            background: 'var(--bg-card)', padding: '24px 48px', borderRadius: 12,
          }}>
            Drop files to upload
          </div>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>File Browser</h1>
          <p>Browse bridge home directory</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {uploadResult && (
            <span style={{
              fontSize: 13,
              color: uploadResult.startsWith('Upload failed') ? 'var(--danger)' : 'var(--success, #22c55e)',
            }}>
              {uploadResult}
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              background: 'var(--accent)', color: '#fff', border: 'none',
              padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
              fontSize: 13, fontWeight: 500, opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'Uploading\u2026' : 'Upload Files'}
          </button>
        </div>
      </div>

      {/* Breadcrumb + controls */}
      <div style={{ marginBottom: 16, fontSize: 14, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); navigateTo(''); }}
          title={home}
          style={{ color: segments.length === 0 ? 'var(--text)' : 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {'\u{1F3E0}'} .copilot-bridge
        </a>
        {segments.map((segment, i) => (
          <span key={i}>
            <span style={{ color: 'var(--text-muted)', margin: '0 2px' }}>/</span>
            {i === segments.length - 1 ? (
              <span style={{ color: 'var(--text)' }}>{segment}</span>
            ) : (
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigateToSegment(i); }}
                style={{ color: 'var(--accent)' }}
              >
                {segment}
              </a>
            )}
          </span>
        ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Show hidden
        </label>
      </div>

      {/* File content viewer */}
      {viewingFile && (
        <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong style={{ fontSize: 14 }}>{viewingFile.split('/').pop()}</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href={getFileDownloadUrl(viewingFile)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  color: 'var(--text)', padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                  textDecoration: 'none', fontSize: 13, display: 'inline-flex', alignItems: 'center',
                }}
              >
                Download
              </a>
              <button
                onClick={closeFile}
                style={{
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  color: 'var(--text)', padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
          {loadingFile ? (
            <Loading message="Loading\u2026" />
          ) : viewingFile && isImageFile(viewingFile) ? (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <img
                src={getFilePreviewUrl(viewingFile)}
                alt={viewingFile.split('/').pop() ?? 'image'}
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </div>
          ) : fileContent ? (
            <CodeViewer content={fileContent} filename={viewingFile.split('/').pop() ?? 'file'} />
          ) : null}
        </div>
      )}

      {/* Directory listing */}
      {loading ? (
        <Loading message="Loading files\u2026" />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data?.entries || data.entries.length === 0 ? (
        <EmptyState message="Empty directory" />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Modified</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry: any) => (
                <tr key={entry.name}>
                  <td>
                    {entry.type === 'directory' ? (
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); navigateTo(entry.path); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                      >
                        <span>{'\u{1F4C1}'}</span> {entry.name}
                      </a>
                    ) : isTextFile(entry.name) || isImageFile(entry.name) ? (
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); viewFile(entry.path); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                      >
                        <span>{isImageFile(entry.name) ? '\u{1F5BC}' : '\u{1F4C4}'}</span> {entry.name}
                      </a>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span>{'\u{1F4C4}'}</span> {entry.name}
                        <a
                          href={getFileDownloadUrl(entry.path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12 }}
                        >
                          download
                        </a>
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {entry.type === 'directory' ? '\u2014' : formatBytes(entry.size ?? 0)}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {entry.modifiedAt ? formatDate(entry.modifiedAt) : '\u2014'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
