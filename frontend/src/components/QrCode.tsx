import qrcode from "qrcode-generator";

/** Quiet zone around the code, in modules; scanners need some white space around it. */
const MARGIN = 2;

/**
 * A QR code drawn as an SVG in the browser, so the URL is never sent anywhere. Colors are fixed
 * black on white (not theme colors), because dark mode remaps white and scanners need contrast.
 */
export function QrCode({ text, className }: { text: string; className?: string }) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  let path = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (qr.isDark(row, col)) path += `M${col + MARGIN},${row + MARGIN}h1v1h-1z`;
    }
  }
  const full = size + MARGIN * 2;
  return (
    <svg
      viewBox={`0 0 ${full} ${full}`}
      role="img"
      aria-label={`QR code for ${text}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={full} height={full} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
