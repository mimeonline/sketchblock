import React, {useEffect, useRef, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

type Props = {src: string; alt: string; title: string};

export default function ArchitectureDiagram({src, alt, title}: Props) {
  const url = useBaseUrl(src);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<number | null>(100);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {document.body.style.overflow = previous;};
  }, [open]);

  function show() {
    setZoom(100);
    dialog.current?.showModal();
    setOpen(true);
  }

  return (
    <figure className={styles.figure}>
      <button type="button" className={styles.preview} onClick={show} aria-label={`Enlarge ${title}`}>
        <img src={url} alt={alt} />
        <span className={styles.hint}>Enlarge diagram ↗</span>
      </button>
      <figcaption>Open for readable labels, zoom controls and scrolling. <a href={url} target="_blank" rel="noopener noreferrer">Open SVG in a new tab</a></figcaption>
      <dialog ref={dialog} className={styles.dialog} aria-label={title} onClose={() => setOpen(false)}>
        <div className={styles.toolbar}>
          <strong>{title}</strong>
          <div className={styles.controls}>
            <button type="button" aria-label="Zoom out" disabled={zoom !== null && zoom <= 50} onClick={() => setZoom(Math.max(50, (zoom ?? 100) - 25))}>−</button>
            <output aria-live="polite">{zoom === null ? 'Fit' : `${zoom}%`}</output>
            <button type="button" aria-label="Zoom in" disabled={zoom !== null && zoom >= 200} onClick={() => setZoom(Math.min(200, (zoom ?? 100) + 25))}>+</button>
            <button type="button" onClick={() => setZoom(null)}>Fit</button>
            <button type="button" autoFocus onClick={() => dialog.current?.close()}>Close</button>
          </div>
        </div>
        <div className={styles.viewport} tabIndex={0} aria-label="Scrollable diagram">
          <img src={url} alt={alt} style={{width: zoom === null ? '100%' : `${1072 * zoom / 100}px`}} />
        </div>
      </dialog>
    </figure>
  );
}
