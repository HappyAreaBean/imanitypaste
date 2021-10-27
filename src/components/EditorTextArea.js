import { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import ReactEditor from 'react-simple-code-editor';
import history from 'history/browser';
import EditorPrismStyle from './EditorPrismStyle';
import { getHighlighter } from '../util/highlighting';

export default function EditorTextArea({ code, setCode, language, fontSize }) {
  const [isSelected, isSelectionMiddle, toggleSelected] = useSelectedLine();
  const highlight = getHighlighter(language);

  function highlightWithLineNumbers(input, grammar) {
    return highlight(input, grammar)
      .split(/\r?\n/)
      .map((line, i) => (
        <span key={i}>
          <LineNumber
            lineNo={i + 1}
            selected={isSelected(i + 1)}
            shouldScroll={isSelectionMiddle(i + 1)}
            toggleSelected={toggleSelected}
          />
          <span dangerouslySetInnerHTML={{ __html: line }} />
        </span>
      ))
      .reduce((acc, curr, idx) => {
        if (idx !== 0) {
          acc.push('\n');
        }
        acc.push(curr);
        return acc;
      }, []);
  }

  const autoBracketState = useState(null);
  const editorRef = useRef();
  function keydown(e) {
    handleKeydown(e, editorRef.current, autoBracketState);
  }

  return (
    <EditorPrismStyle>
      <StyledReactEditor
        ref={editorRef}
        value={code}
        onValueChange={setCode}
        highlight={highlightWithLineNumbers}
        placeholder={'Paste (or type) some code...\n\nNOTE: Uploaded content is retained for 7 days then deleted.'}
        padding={10}
        size={fontSize}
        textareaId="code-area"
        autoFocus={true}
        onKeyDown={keydown}
      />
    </EditorPrismStyle>
  );
}

const LineNumber = ({ lineNo, selected, shouldScroll, toggleSelected }) => {
  const autoScroll = useAutoScroll(shouldScroll);

  function click(e) {
    toggleSelected(lineNo, e.shiftKey);
  }

  return selected ? (
    <HighlightedLineNumber ref={autoScroll} onClick={click}>
      {lineNo}
    </HighlightedLineNumber>
  ) : (
    <PlainLineNumber ref={autoScroll} onClick={click}>
      {lineNo}
    </PlainLineNumber>
  );
};

const StyledReactEditor = styled(ReactEditor)`
  counter-reset: line;
  font-size: ${props => props.size}px;
  outline: 0;
  min-height: calc(100vh - 2rem);

  #code-area {
    outline: none;
    padding-left: 60px !important;
  }

  pre {
    padding-left: 60px !important;
  }
`;

const PlainLineNumber = styled.span`
  position: absolute;
  left: 0px;
  color: ${props => props.theme.editor.lineNumber};
  text-align: right;
  width: 40px;
  font-weight: 100;
  user-select: none;

  // override parent <pre>
  pointer-events: auto;
  cursor: pointer;
`;

const HighlightedLineNumber = styled(PlainLineNumber)`
  color: ${props => props.theme.editor.lineNumberHl};
  background-color: ${props => props.theme.editor.lineNumberHlBackground};
  font-weight: bold;
`;

function useSelectedLine() {
  // extract highlighted lines from window hash
  const [selected, setSelected] = useState(() => {
    const hash = window.location.hash;
    if (/^#L\d+(-\d+)?$/.test(hash)) {
      const [start, end] = hash.substring(2).split('-').map(Number);
      return [start, isNaN(end) ? -1 : end];
    } else {
      return [-1, -1];
    }
  });

  // update window hash when a new line is highlighted
  useEffect(() => {
    let hash = '';

    if (selected[0] !== -1) {
      if (selected[1] !== -1) {
        const start = Math.min(...selected);
        const end = Math.max(...selected);
        hash = `#L${start}-${end}`;
      } else {
        hash = `#L${selected[0]}`;
      }
    }

    history.replace({ hash });
  }, [selected]);

  // toggle the highlighting for a given line
  function toggleSelected(lineNo, shift) {
    if (selected[0] === lineNo && selected[1] === -1) {
      setSelected([-1, -1]);
    } else if (selected[0] === -1 || !shift) {
      setSelected([lineNo, -1]);
    } else {
      setSelected([selected[0], lineNo]);
    }
  }

  // should a line be highlighted in the viewer?
  function isSelected(lineNo) {
    if (selected[0] === -1) {
      return false;
    }
    if (selected[1] === -1) {
      return selected[0] === lineNo;
    }

    return lineNo >= Math.min(...selected) && lineNo <= Math.max(...selected);
  }

  // is a line in the middle of the selection
  function isSelectionMiddle(lineNo) {
    if (selected[0] === -1) {
      return false;
    }
    if (selected[1] === -1) {
      return selected[0] === lineNo;
    }

    return (
      lineNo === Math.floor((Math.min(...selected) + Math.max(...selected)) / 2)
    );
  }

  return [isSelected, isSelectionMiddle, toggleSelected];
}

function useAutoScroll(shouldScroll) {
  const [firstRender, setFirstRender] = useState(true);
  const ref = useRef(null);

  useEffect(() => {
    // only attempt to autoscroll if this is the first render.
    if (!firstRender) {
      return;
    }
    setFirstRender(false);

    if (shouldScroll) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [shouldScroll, firstRender]);

  return ref;
}

const KEYCODE_ENTER = 13;
const KEYCODE_PARENS = 57;
const KEYCODE_PARENS_CLOSE = 48;
const KEYCODE_BRACKETS = 219;
const KEYCODE_BRACKETS_CLOSE = 221;
const KEYCODE_QUOTE = 222;
const KEYCODE_BACK_QUOTE = 192;

function getPair({ keyCode, shiftKey }) {
  if (keyCode === KEYCODE_PARENS && shiftKey) {
    return ['(', ')'];
  } else if (keyCode === KEYCODE_BRACKETS) {
    if (shiftKey) {
      return ['{', '}'];
    } else {
      return ['[', ']'];
    }
  } else if (keyCode === KEYCODE_QUOTE) {
    if (shiftKey) {
      return ['"', '"'];
    } else {
      return ["'", "'"];
    }
  } else if (keyCode === KEYCODE_BACK_QUOTE && !shiftKey) {
    return ['`', '`'];
  }
  return null;
}

function handleKeydown(e, editor, [autoBracket, setAutoBracket]) {
  const { value, selectionStart, selectionEnd } = e.target;
  if (selectionStart !== selectionEnd) {
    return;
  }

  // If the user types a closing bracket explictly, just jump to after the automatically added one
  if (
    selectionStart !== 0 &&
    autoBracket === e.key &&
    (e.keyCode === KEYCODE_BRACKETS_CLOSE || e.keyCode === KEYCODE_PARENS_CLOSE)
  ) {
    e.preventDefault();
    editor._applyEdits({
      value: value,
      selectionStart: selectionStart + 1,
      selectionEnd: selectionStart + 1,
    });
    setAutoBracket(null);
    return;
  }

  // reset auto brackets
  setAutoBracket(null);

  // When entering an open bracket/quote, add the closing one
  const pair = getPair(e);
  if (pair) {
    // don't add double apostrophes if it looks like a sentence
    if (
      e.keyCode === KEYCODE_QUOTE &&
      !e.shiftKey &&
      selectionStart !== 0 &&
      /[a-zA-Z]/.test(value.charAt(selectionStart - 1))
    ) {
      return;
    }

    e.preventDefault();
    editor._applyEdits({
      value:
        value.substring(0, selectionStart) +
        pair[0] +
        pair[1] +
        value.substring(selectionEnd),
      selectionStart: selectionStart + 1,
      selectionEnd: selectionStart + 1,
    });
    setAutoBracket(pair[1]);
  }

  // When pressing enter immediately after an open bracket, automatically add a newline plus extra indent
  if (
    e.keyCode === KEYCODE_ENTER &&
    selectionEnd !== 0 &&
    value[selectionEnd - 1] === '{'
  ) {
    const line = editor._getLines(value, selectionStart).pop();
    const matches = line.match(/^\s+/);
    const existingIndent = matches ? matches[0] : '';

    const indent = '  ';
    const updatedValue =
      value.substring(0, selectionStart) +
      '\n' +
      existingIndent +
      indent +
      '\n' +
      existingIndent +
      value.substring(selectionEnd);
    const updatedSelection =
      selectionStart + 1 /* newline */ + existingIndent.length + indent.length;

    e.preventDefault();
    editor._applyEdits({
      value: updatedValue,
      selectionStart: updatedSelection,
      selectionEnd: updatedSelection,
    });
  }
}
