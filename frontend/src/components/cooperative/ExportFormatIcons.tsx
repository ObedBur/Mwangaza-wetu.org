/**
 * Icônes de format de fichier pour les boutons d'export.
 * Couleurs universelles des formats : PDF rouge/blanc, Excel vert/blanc.
 * Elles remplacent les icônes génériques de téléchargement afin que le format
 * soit identifiable immédiatement dans l'en-tête des pages.
 */

type ExportFormatIconProps = {
  className?: string;
};

export function PdfFileIcon({ className }: ExportFormatIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 2.5h8.2L19 7.3v12.2c0 1-.8 1.8-1.8 1.8H6c-1 0-1.8-.8-1.8-1.8V4.3c0-1 .8-1.8 1.8-1.8Z"
        fill="#D93025"
      />
      <path d="M14.2 2.5V7.3H19L14.2 2.5Z" fill="#A50E0E" />
      <text
        x="11.4"
        y="16.6"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="6.4"
        fontWeight="700"
      >
        PDF
      </text>
    </svg>
  );
}

export function ExcelFileIcon({ className }: ExportFormatIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 2.5h8.2L19 7.3v12.2c0 1-.8 1.8-1.8 1.8H6c-1 0-1.8-.8-1.8-1.8V4.3c0-1 .8-1.8 1.8-1.8Z"
        fill="#217346"
      />
      <path d="M14.2 2.5V7.3H19L14.2 2.5Z" fill="#165C36" />
      <text
        x="11.4"
        y="17.4"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="9"
        fontWeight="700"
      >
        X
      </text>
    </svg>
  );
}
