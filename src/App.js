import { useEffect, useState } from 'react';
import Editor from './components/Editor';
import parseContentType from 'content-type-parser';
import { languageIds } from './util/highlighting';
import { bytebinUrl } from './util/constants';

function getPasteIdFromUrl() {
  const path = window.location.pathname;
  if (path && /^\/[a-zA-Z0-9]+$/.test(path)) {
    return path.substring(1);
  } else {
    return undefined;
  }
}

async function loadFromBytebin(id) {
  try {
    const resp = await fetch(bytebinUrl + id);
    if (resp.ok) {
      const content = await resp.text();
      const type = parseLanguageFromContentType(
        resp.headers.get('content-type')
      );

      document.title = 'pastebean | ' + id;
      return { ok: true, content, type };
    } else {
      return { ok: false };
    }
  } catch (e) {
    return { ok: false };
  }
}

function parseLanguageFromContentType(contentType) {
  const { type, subtype: subType } = parseContentType(contentType);
  if (type === 'application' && subType === 'json') {
    return 'json';
  }
  if (type === 'text' && languageIds.includes(subType.toLowerCase())) {
    return subType.toLowerCase();
  }
}

const INITIAL = Symbol();
const LOADING = Symbol();
const LOADED = Symbol();

export default function App() {
  const [pasteId] = useState(getPasteIdFromUrl);
  const [state, setState] = useState(INITIAL);
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState();

  useEffect(() => {
    if (pasteId && state === INITIAL) {
      setState(LOADING);
      setContent('Loading...');
      loadFromBytebin(pasteId).then(({ ok, content, type }) => {
        if (ok) {
          setContent(content);
          if (type) {
            setContentType(type);
          }
        } else {
          setContent(get404Message(pasteId));
        }
        setState(LOADED);
      });
    }
  }, [pasteId, state, setContent]);

  return (
    <Editor
      content={content}
      setContent={setContent}
      contentType={contentType}
    />
  );
}

function get404Message(pasteId) {
  return `
  ██╗  ██╗ ██████╗ ██╗  ██╗
  ██║  ██║██╔═████╗██║  ██║
  ███████║██║██╔██║███████║
  ╚════██║████╔╝██║╚════██║
       ██║╚██████╔╝     ██║
       ╚═╝ ╚═════╝      ╚═╝

  not found: '${pasteId}'
  maybe the paste expired?
`;
}
