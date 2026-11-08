"use client";

import { Camera, CameraOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { isValidGtin, normalizeBarcode } from "@/lib/products/gtin";
import { Sheet } from "../sheet";
import { Alert, Button, Field, inputClass } from "../ui";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "itf"];

type CameraState = "starting" | "scanning" | "denied" | "unsupported";

function ScannerBody({ onCode, busy, error }: { onCode: (code: string) => void; busy: boolean; error: string | null }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState(false);
  const handled = useRef(false);
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  });

  // After a lookup that did not navigate away, allow another scan, but not instantly (the code is still in view).
  useEffect(() => {
    if (busy) return;
    const timer = setTimeout(() => {
      handled.current = false;
    }, 2500);
    return () => clearTimeout(timer);
  }, [busy]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopZxing: (() => void) | undefined;

    const accept = (raw: string) => {
      const code = normalizeBarcode(raw);
      // misreads fail the checksum; keep scanning instead of reporting them
      if (cancelled || handled.current || !isValidGtin(code)) return;
      handled.current = true;
      onCodeRef.current(code);
    };

    async function start() {
      // Camera APIs require HTTPS (or localhost). On phone-over-LAN HTTP the browser
      // never shows a permission prompt — detect that before calling getUserMedia.
      if (
        typeof window !== "undefined" &&
        window.isSecureContext === false
      ) {
        if (!cancelled) setCamera("unsupported");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setCamera("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        // NotAllowedError = user denied; elsewhere on HTTP browsers may throw SecurityError.
        setCamera(
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "denied"
            : name === "SecurityError" || name === "NotSupportedError"
              ? "unsupported"
              : "denied",
        );
        return;
      }
      const el = video.current;
      if (cancelled || !el) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      el.srcObject = stream;
      await el.play().catch(() => undefined);
      setCamera("scanning");

      const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (Native) {
        const detector = new Native({ formats: NATIVE_FORMATS });
        const tick = async () => {
          if (cancelled) return;
          try {
            if (el.readyState >= 2) {
              const found = await detector.detect(el);
              if (found[0]) accept(found[0].rawValue);
            }
          } catch {
            // a failed frame is not fatal; try the next one
          }
          frame = requestAnimationFrame(() => void tick());
        };
        void tick();
        return;
      }

      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import("@zxing/browser"),
        import("@zxing/library"),
      ]);
      if (cancelled) return;
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.ITF]);
      const reader = new BrowserMultiFormatReader(hints);
      const controls = await reader.decodeFromStream(stream, el, (result) => {
        if (result) accept(result.getText());
      });
      stopZxing = () => controls.stop();
      if (cancelled) controls.stop();
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stopZxing?.();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function submitManual(event: FormEvent) {
    event.preventDefault();
    const code = normalizeBarcode(manual);
    if (!isValidGtin(code)) {
      setManualError(true);
      return;
    }
    setManualError(false);
    handled.current = true;
    onCode(code);
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] bg-black">
        <video ref={video} playsInline muted className="size-full object-cover" />
        {camera === "scanning" ? (
          <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 rounded bg-brand shadow-[0_0_12px_2px] shadow-brand/60" />
        ) : null}
        {camera !== "scanning" ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/90">
            {camera === "starting" ? (
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" aria-hidden />
                {t("products.scanStarting")}
              </span>
            ) : (
              <span className="flex flex-col items-center gap-2">
                <CameraOff size={28} aria-hidden />
                {camera === "denied" ? t("products.scanDenied") : t("products.scanUnsupported")}
              </span>
            )}
          </div>
        ) : null}
        {busy ? (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-white">
            <Loader2 size={28} className="animate-spin" aria-label={t("products.scanLooking")} />
          </div>
        ) : null}
      </div>
      <p className="flex items-center gap-2 text-sm text-muted">
        <Camera size={16} aria-hidden />
        {t("products.scanHint")}
      </p>
      {error ? <Alert>{error}</Alert> : null}
      <form onSubmit={submitManual} className="space-y-2">
        <Field label={t("products.scanManual")} htmlFor="manual-barcode">
          <div className="flex gap-2">
            <input
              id="manual-barcode"
              inputMode="numeric"
              autoComplete="off"
              placeholder="5901234123457"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className={`${inputClass} font-mono`}
            />
            <Button type="submit" variant="secondary" disabled={busy}>
              {t("products.scanLookup")}
            </Button>
          </div>
        </Field>
        {manualError ? <Alert>{t("products.scanInvalid")}</Alert> : null}
      </form>
    </div>
  );
}

export function ScannerSheet({
  open,
  onClose,
  onCode,
  busy,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onCode: (code: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} title={t("products.scanTitle")}>
      <ScannerBody onCode={onCode} busy={busy} error={error} />
    </Sheet>
  );
}
