"use client";

import { useEffect, useId, useRef, useState } from "react";

type ImageLightboxProps = {
  src: string;
  alt: string;
  caption?: string;
};

export function ImageLightbox({ src, alt, caption }: ImageLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const captionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      setZoom(1);
      document.body.classList.remove("modal-open");
      triggerRef.current?.focus();
    };

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  function open() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    document.body.classList.add("modal-open");
    window.requestAnimationFrame(() => closeRef.current?.focus());
  }

  function close() {
    dialogRef.current?.close();
  }

  if (failed) {
    return (
      <div className="manual-image-fallback" role="status">
        画像を表示できません。更新を確認しても表示できない場合は、管理者へお知らせください。
      </div>
    );
  }

  return (
    <figure className="manual-image">
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        aria-label={`${alt}を大きく表示`}
      >
        {/* Notionの期限付きURLを長期最適化キャッシュしないためnative imgを使用 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
        <span>押して拡大</span>
      </button>
      {caption ? <figcaption id={captionId}>{caption}</figcaption> : null}

      <dialog
        ref={dialogRef}
        className="image-dialog"
        aria-label={`${alt}の拡大表示`}
        aria-describedby={caption ? captionId : undefined}
      >
        <div className="image-dialog__toolbar">
          <div role="group" aria-label="画像の拡大率">
            <button
              type="button"
              onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
              aria-label="縮小"
            >
              −
            </button>
            <button type="button" onClick={() => setZoom(1)}>
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
              aria-label="拡大"
            >
              +
            </button>
          </div>
          <button ref={closeRef} type="button" onClick={close}>
            閉じる
          </button>
        </div>
        <div className="image-dialog__canvas">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} style={{ transform: `scale(${zoom})` }} />
        </div>
        {caption ? <p>{caption}</p> : null}
      </dialog>
    </figure>
  );
}
