import { useState, useMemo, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Register languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import java from 'highlight.js/lib/languages/java';
import cLang from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import swift from 'highlight.js/lib/languages/swift';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import ini from 'highlight.js/lib/languages/ini';
import diff from 'highlight.js/lib/languages/diff';
import graphql from 'highlight.js/lib/languages/graphql';
import makefile from 'highlight.js/lib/languages/makefile';

// GitHub Dark theme
import 'highlight.js/styles/github-dark.css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('java', java);
hljs.registerLanguage('c', cLang);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('graphql', graphql);
hljs.registerLanguage('makefile', makefile);

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  java: 'java', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  cs: 'csharp', swift: 'swift',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini',
  xml: 'xml', html: 'html', css: 'css', scss: 'scss',
  sql: 'sql', graphql: 'graphql',
  md: 'markdown', mdx: 'markdown',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  ini: 'ini', conf: 'ini', cfg: 'ini',
  diff: 'diff',
};

function getLang(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const name = filename.toLowerCase();
  if (name === 'dockerfile') return 'dockerfile';
  if (name === 'makefile') return 'makefile';
  return EXT_TO_LANG[ext] ?? null;
}

function isMarkdown(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'md' || ext === 'mdx';
}

function highlightCode(code: string, lang: string | null): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang }).value;
    } catch {
      // fall through
    }
  }
  return hljs.highlightAuto(code).value;
}

interface CodeViewerProps {
  content: string;
  filename: string;
}

function HighlightedCode({
  code,
  lang,
  wrap = false,
  maxHeight,
  style = {},
}: {
  code: string;
  lang: string | null;
  wrap?: boolean;
  maxHeight?: number;
  style?: any;
}) {
  const ref = useRef<HTMLElement>(null);
  const html = useMemo(() => highlightCode(code, lang), [code, lang]);

  return (
    <pre style={{
      background: '#0d1117', padding: 16, borderRadius: 6,
      overflowX: 'auto', overflowY: maxHeight ? 'auto' : 'visible', maxHeight, margin: 0,
      maxWidth: '100%', minWidth: 0,
      whiteSpace: wrap ? 'pre-wrap' : 'pre',
      wordBreak: wrap ? 'break-word' : undefined,
      ...style,
    }}>
      <code
        ref={ref}
        className={lang ? `hljs language-${lang}` : 'hljs'}
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          fontFamily: "'SF Mono', Menlo, Monaco, 'Courier New', monospace",
          fontSize: 13, lineHeight: 1.5,
        }}
      />
    </pre>
  );
}

export function CodeViewer({ content, filename }: CodeViewerProps) {
  const [mode, setMode] = useState<'preview' | 'code'>(isMarkdown(filename) ? 'preview' : 'code');
  const [wrap, setWrap] = useState(false);
  const lang = useMemo(() => getLang(filename), [filename]);
  const mdFile = isMarkdown(filename);

  const toggleBtnStyle = (active: boolean) => ({
    background: active ? 'var(--accent)' : 'var(--bg-hover)',
    color: active ? '#fff' : 'var(--text)',
    border: '1px solid var(--border)', padding: '4px 12px',
    borderRadius: 6, cursor: 'pointer' as const, fontSize: 12,
  });

  return (
    <div style={{ minWidth: 0, maxWidth: '100%' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {mdFile && (
          <>
            <button onClick={() => setMode('preview')} style={toggleBtnStyle(mode === 'preview')}>
              Preview
            </button>
            <button onClick={() => setMode('code')} style={toggleBtnStyle(mode === 'code')}>
              Code
            </button>
            <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
          </>
        )}
        {(!mdFile || mode === 'code') && (
          <button onClick={() => setWrap(!wrap)} style={toggleBtnStyle(wrap)}>
            Wrap
          </button>
        )}
      </div>

      {mdFile && mode === 'preview' ? (
        <div className="markdown-preview" style={{
          lineHeight: 1.7,
          padding: '16px 24px',
          background: '#0d1117',
          borderRadius: 6,
          maxHeight: 600,
          overflow: 'auto',
          fontSize: 15,
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
          minWidth: 0,
          maxWidth: '100%',
        }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1({ children, ...props }) {
                return <h1 style={{ fontSize: '2em', fontWeight: 600, marginTop: '1em', marginBottom: '0.5em', paddingBottom: '0.3em', borderBottom: '1px solid var(--border)' }} {...props}>{children}</h1>;
              },
              h2({ children, ...props }) {
                return <h2 style={{ fontSize: '1.5em', fontWeight: 600, marginTop: '1em', marginBottom: '0.5em', paddingBottom: '0.3em', borderBottom: '1px solid var(--border)' }} {...props}>{children}</h2>;
              },
              h3({ children, ...props }) {
                return <h3 style={{ fontSize: '1.25em', fontWeight: 600, marginTop: '1em', marginBottom: '0.5em' }} {...props}>{children}</h3>;
              },
              h4({ children, ...props }) {
                return <h4 style={{ fontSize: '1em', fontWeight: 600, marginTop: '1em', marginBottom: '0.5em' }} {...props}>{children}</h4>;
              },
              p({ children, ...props }) {
                return <p style={{ marginTop: 0, marginBottom: '1em' }} {...props}>{children}</p>;
              },
              ul({ children, ...props }) {
                return <ul style={{ paddingLeft: '2em', marginBottom: '1em' }} {...props}>{children}</ul>;
              },
              ol({ children, ...props }) {
                return <ol style={{ paddingLeft: '2em', marginBottom: '1em' }} {...props}>{children}</ol>;
              },
              li({ children, ...props }) {
                return <li style={{ marginBottom: '0.25em' }} {...props}>{children}</li>;
              },
              pre({ children }) {
                return <div style={{ margin: 0, minWidth: 0, maxWidth: '100%' }}>{children}</div>;
              },
              code({ className, children, inline, ...props }: any) {
                const isInline = inline ?? !className;
                const codeStr = String(children).replace(/\n$/, '');
                if (isInline) {
                  return <code style={{ background: '#161b22', padding: '2px 6px', borderRadius: 4, fontSize: '0.85em', fontFamily: "'SF Mono', Menlo, Monaco, 'Courier New', monospace", overflowWrap: 'anywhere' }} {...props}>{children}</code>;
                }
                const langMatch = className?.match(/language-(\w+)/);
                const codeLang = langMatch?.[1] ?? null;
                return <div style={{ margin: '1em 0', minWidth: 0, maxWidth: '100%' }}><HighlightedCode code={codeStr} lang={codeLang} style={{ maxHeight: 'none' }} /></div>;
              },
              a({ href, children, ...props }) {
                return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }} {...props}>{children}</a>;
              },
              table({ children, ...props }) {
                return (
                  <div style={{ margin: '1em 0', overflowX: 'auto', maxWidth: '100%' }}>
                    <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }} {...props}>{children}</table>
                  </div>
                );
              },
              th({ children, ...props }) {
                return <th style={{ border: '1px solid var(--border)', padding: '6px 12px', textAlign: 'left', background: 'var(--bg-hover)', overflowWrap: 'anywhere' }} {...props}>{children}</th>;
              },
              td({ children, ...props }) {
                return <td style={{ border: '1px solid var(--border)', padding: '6px 12px', overflowWrap: 'anywhere' }} {...props}>{children}</td>;
              },
              blockquote({ children, ...props }) {
                return <blockquote style={{ borderLeft: '3px solid var(--accent)', margin: '1em 0', paddingLeft: 16, color: 'var(--text-muted)' }} {...props}>{children}</blockquote>;
              },
              img({ src, alt, ...props }) {
                return <img src={src} alt={alt} style={{ maxWidth: '100%', borderRadius: 6 }} {...props} />;
              },
              hr({ ...props }) {
                return <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.5em 0' }} {...props} />;
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      ) : (
        <HighlightedCode code={content} lang={lang} wrap={wrap} maxHeight={600} />
      )}
    </div>
  );
}
