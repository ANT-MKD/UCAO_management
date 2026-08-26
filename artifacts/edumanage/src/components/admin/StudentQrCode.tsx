import QRCode from "react-qr-code";
import { cn } from "@/lib/utils";

interface StudentQrCodeProps {
  /** Contenu encodé — matricule étudiant (identifiant réel) */
  value: string;
  size?: number;
  className?: string;
  title?: string;
}

/**
 * QR Code étudiant — encode le matricule (même source que la liste / dossier).
 */
export function StudentQrCode({ value, size = 48, className, title }: StudentQrCodeProps) {
  if (!value) return null;
  return (
    <div
      className={cn("bg-white p-0.5 rounded-sm inline-flex flex-shrink-0", className)}
      title={title ?? `QR ${value}`}
      data-testid="student-qr"
    >
      <QRCode
        value={value}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor="#0f172a"
        style={{ height: "auto", maxWidth: "100%", width: size }}
      />
    </div>
  );
}
