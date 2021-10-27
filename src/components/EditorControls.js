import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { gzip } from 'pako';
import history from 'history/browser';
import copy from 'copy-to-clipboard';

import { MenuButton, Button } from './Menu';
import { languageIds } from '../util/highlighting';
import themes from '../style/themes';

export default function EditorControls({
  code,
  setCode,
  language,
  setLanguage,
  theme,
  setTheme,
  zoom,
}) {
  const [saving, setSaving] = useState(false);
  const [recentlySaved, setRecentlySaved] = useState(false);

  useEffect(() => {
    setRecentlySaved(false);
  }, [code, language]);

  const save = useCallback(() => {
    if (!code || recentlySaved) {
      return;
    }
    setSaving(true);
    saveToBytebin(code, language).then(pasteId => {
      setSaving(false);
      setRecentlySaved(true);
      history.replace({
        pathname: pasteId,
      });
      copy(window.location.href);
      document.title = 'pastebean | ' + pasteId;
    });
  }, [code, language, recentlySaved]);

  useEffect(() => {
    const listener = e => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          save();
        }

        if (e.key === '=' || e.key === '-') {
          e.preventDefault();
          zoom(e.key === '=' ? 1 : -1);
        }
      }
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [save, zoom]);

  function reset() {
    setCode('');
    setLanguage('plain');
    history.replace({
      pathname: '/',
      hash: '',
    });
    document.title = 'paste';
  }

  return (
    <Header>
      <Section>
        <Button onClick={reset}>[new]</Button>
        <Button onClick={save}>
          {recentlySaved ? '[link copied!]' : saving ? '[saving...]' : '[save]'}
        </Button>
        <MenuButton
          label="language"
          value={language}
          setValue={setLanguage}
          ids={languageIds}
        />
      </Section>
      <Section>
        <Button onClick={() => zoom(1)}>[+ </Button>
        <Button onClick={() => zoom(-1)}> -]</Button>
        <MenuButton
          label="theme"
          value={theme}
          setValue={setTheme}
          ids={Object.keys(themes)}
        />
        <Button
          className="optional"
          as="a"
          href="https://github.com/HappyAreaBean/paste"
          target="_blank"
          rel="noreferrer"
        >
          [github]
        </Button>
        <Button
            className="optional"
            as="a"
            href="https://happyareabean.cc"
            rel="noreferrer"
        >
          [{"back"}]
        </Button>
      </Section>
    </Header>
  );
}

const Header = styled.header`
  position: fixed;
  z-index: 2;
  width: 100%;
  height: 2em;
  color: ${props => props.theme.primary};
  background: ${props => props.theme.secondary};
  display: flex;
  justify-content: space-between;
  user-select: none;
`;

const Section = styled.div`
  display: flex;
  align-items: center;

  @media (max-width: 470px) {
    .optional {
      display: none;
    }
  }
`;

function langaugeToContentType(language) {
  if (language === 'json') {
    return 'application/json';
  } else {
    return 'text/' + language;
  }
}

async function saveToBytebin(code, language) {
  try {
    const compressed = gzip(code);
    const contentType = langaugeToContentType(language);

    const resp = await fetch('https://bytebin.happyareabean.cc/post', {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Content-Encoding': 'gzip',
        'Accept': 'application/json',
      },
      body: compressed,
    });

    if (resp.ok) {
      const json = await resp.json();
      return json.key;
    }
  } catch (e) {
    console.log(e);
  }
  return null;
}
