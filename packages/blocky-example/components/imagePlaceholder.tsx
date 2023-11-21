"use client";
import { useRef } from "react";
import Button from "@pkg/components/button";

function ImagePlaceholder({ setSrc }: { setSrc: (src: string) => void }) {
  const selectorRef = useRef<HTMLInputElement>(null);
  const handleUpload = () => {
    selectorRef.current?.click();
  };
  const handleSelectedFileChanged = () => {
    const files = selectorRef.current?.files;
    if (!files || files.length === 0) {
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      setSrc(fr.result as string);
    };
    fr.readAsDataURL(files[0]);
  };
  return (
    <>
      <Button onClick={handleUpload}>Upload</Button>
      <input
        type="file"
        accept=".jpg, .png, .jpeg, .gif, .bmp, .tif, .tiff|image/*"
        className="blocky-image-block-file-selector"
        onChange={handleSelectedFileChanged}
        ref={selectorRef}
      />
    </>
  );
}

export default ImagePlaceholder;
