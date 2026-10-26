'use client';
import { Scan, ZoomIn, ZoomOut, Magnet, Link2 } from 'lucide-react';
import { IconTip } from '@/components/ui-tooltip';
interface Props {
  zoom: number;
  magnetOn: boolean;
  showLinks: boolean;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onMagnet: () => void;
  onLinks: () => void;
}
export function CanvasNavigation({
  zoom,
  magnetOn,
  showLinks,
  onFit,
  onZoomIn,
  onZoomOut,
  onMagnet,
  onLinks,
}: Props) {
  const fitToScreen = onFit,
    zoomIn = onZoomIn,
    zoomOut = onZoomOut,
    toggleLinks = onLinks;
  return (
    <>
      {' '}
      <div className="canvas-bottom-toolbar" role="toolbar" aria-label="Navegação do mapa">
        <IconTip label="Zoom to Fit" shortcut="1">
          <button className="canvas-tool" onClick={fitToScreen} aria-label="Ajustar à tela">
            <Scan size={17} />
          </button>
        </IconTip>
        <IconTip label="Zoom In" shortcut="+">
          <button
            className="canvas-tool"
            onClick={zoomIn}
            aria-label="Aproximar"
            disabled={zoom >= 8}
          >
            <ZoomIn size={18} />
          </button>
        </IconTip>
        <IconTip label="Zoom Out" shortcut="-">
          <button
            className="canvas-tool"
            onClick={zoomOut}
            aria-label="Afastar"
            disabled={zoom <= 0.3}
          >
            <ZoomOut size={18} />
          </button>
        </IconTip>
        <span className="canvas-tool-separator" />
        <IconTip label={magnetOn ? 'Desativar magnetismo' : 'Ativar magnetismo'}>
          <button
            className={`canvas-tool ${magnetOn ? 'tool-active' : ''}`}
            aria-label="Alternar magnetismo"
            aria-pressed={magnetOn}
            onClick={onMagnet}
          >
            <Magnet size={17} />
          </button>
        </IconTip>
      </div>
      <div className="canvas-bottom-right">
        <IconTip label={showLinks ? 'Ocultar conexões' : 'Mostrar conexões'}>
          <button
            className={`canvas-tool ${showLinks ? 'tool-active' : ''}`}
            aria-label="Alternar conexões"
            aria-pressed={showLinks}
            onClick={toggleLinks}
          >
            <Link2 size={17} />
          </button>
        </IconTip>
        <span className="canvas-zoom-value">{Math.round(zoom * 100)}%</span>
      </div>
    </>
  );
}
