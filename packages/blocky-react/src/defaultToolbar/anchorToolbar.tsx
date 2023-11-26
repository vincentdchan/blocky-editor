import React, { useRef, useState, useEffect, useCallback } from "react";
import Button from "@pkg/components/button";
import { anchorToolbarStyle } from "./style";

function isUrl(text: string): boolean {
  try {
    const url = new URL(text);
    const { protocol } = url;
    return protocol === "http:" || protocol === "https:";
  } catch (e) {
    return false;
  }
}

export interface AnchorToolbarProps {
  style?: React.CSSProperties;
  onSubmitLink?: (link: string) => void;
}

export function AnchorToolbar(props: AnchorToolbarProps) {
  const { style, onSubmitLink } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [valid, setValid] = useState(false);

  const handleClicked = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  const handleConfirmed = useCallback(() => {
    onSubmitLink?.(content);
  }, [onSubmitLink]);

  const handleContentChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const content = e.target.value as string;
      const valid = isUrl(content);
      setContent(content);
      setValid(valid);
    },
    []
  );

  const handleKeydown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!valid) {
          return;
        }
        handleConfirmed();
      }
    },
    [valid, handleClicked]
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      onClick={handleClicked}
      style={style}
      css={anchorToolbarStyle}
      className="blocky-example-toolbar-container"
    >
      <input
        ref={inputRef}
        placeholder="Link"
        value={content}
        onChange={handleContentChanged}
        onKeyDown={handleKeydown}
      />
      <Button disabled={!valid} onClick={handleConfirmed}>
        Confirm
      </Button>
    </div>
  );
}
