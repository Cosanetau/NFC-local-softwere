import { EventEmitter } from "node:events";
import { normaliseUid } from "./db.js";

export class NfcService extends EventEmitter {
  constructor() {
    super();
    this.lastScan = null;
    this.enabled = process.env.NFC_ENABLED === "true";
    this.started = false;
    this.error = null;
  }

  async start() {
    if (!this.enabled || this.started) {
      return;
    }

    this.started = true;

    try {
      const { NFC } = await import("nfc-pcsc");
      const nfc = new NFC();

      nfc.on("reader", (reader) => {
        reader.autoProcessing = false;

        reader.on("card", (card) => {
          const uid = normaliseUid(card.uid);
          if (uid) {
            this.recordScan(uid, "reader");
          }
        });

        reader.on("error", (error) => {
          this.error = error.message;
          this.emit("error", error);
        });
      });

      nfc.on("error", (error) => {
        this.error = error.message;
        this.emit("error", error);
      });
    } catch (error) {
      this.error =
        "NFC_ENABLED is true, but nfc-pcsc is not installed or the PC/SC driver is unavailable. Install the Windows ACR122U driver and run npm install nfc-pcsc on the host PC.";
      this.emit("error", error);
    }
  }

  recordScan(uid, source = "manual") {
    this.lastScan = {
      uid: normaliseUid(uid),
      source,
      scannedAt: new Date().toISOString(),
      sequence: Date.now(),
    };

    this.emit("scan", this.lastScan);
    return this.lastScan;
  }

  getStatus() {
    return {
      enabled: this.enabled,
      started: this.started,
      error: this.error,
      lastScan: this.lastScan,
    };
  }

  getLastScan(since = 0) {
    if (!this.lastScan || Number(this.lastScan.sequence) <= Number(since || 0)) {
      return null;
    }

    return this.lastScan;
  }
}

export const nfcService = new NfcService();
