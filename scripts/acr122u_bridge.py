"""Windows ACR122U NFC bridge for the Workshop Sign-In System.

This script uses Windows PC/SC directly through winscard.dll, so it does not
need Node native build tools or npm packages. It reads the card UID and posts it
to the local Express app's scan endpoint.
"""

from __future__ import annotations

import ctypes
import json
import os
import sys
import time
import urllib.request
from ctypes import wintypes


API_URL = os.environ.get("NFC_BRIDGE_URL", "http://localhost:3005/api/nfc/manual-scan")
POLL_SECONDS = float(os.environ.get("NFC_BRIDGE_POLL_SECONDS", "0.5"))

SCARD_SCOPE_USER = 0
SCARD_SHARE_SHARED = 2
SCARD_PROTOCOL_T0 = 1
SCARD_PROTOCOL_T1 = 2
SCARD_LEAVE_CARD = 0
SCARD_S_SUCCESS = 0
SCARD_E_NO_SMARTCARD = 0x8010000C
SCARD_W_REMOVED_CARD = 0x80100069


class SCardIORequest(ctypes.Structure):
    _fields_ = [
        ("dwProtocol", wintypes.DWORD),
        ("cbPciLength", wintypes.DWORD),
    ]


def load_winscard():
    if os.name != "nt":
        raise RuntimeError("This bridge only works on Windows.")
    return ctypes.WinDLL("Winscard.dll")


winscard = load_winscard()

winscard.SCardEstablishContext.argtypes = [
    wintypes.DWORD,
    wintypes.LPVOID,
    wintypes.LPVOID,
    ctypes.POINTER(ctypes.c_void_p),
]
winscard.SCardEstablishContext.restype = wintypes.LONG

winscard.SCardReleaseContext.argtypes = [ctypes.c_void_p]
winscard.SCardReleaseContext.restype = wintypes.LONG

winscard.SCardListReadersW.argtypes = [
    ctypes.c_void_p,
    wintypes.LPCWSTR,
    wintypes.LPWSTR,
    ctypes.POINTER(wintypes.DWORD),
]
winscard.SCardListReadersW.restype = wintypes.LONG

winscard.SCardConnectW.argtypes = [
    ctypes.c_void_p,
    wintypes.LPCWSTR,
    wintypes.DWORD,
    wintypes.DWORD,
    ctypes.POINTER(ctypes.c_void_p),
    ctypes.POINTER(wintypes.DWORD),
]
winscard.SCardConnectW.restype = wintypes.LONG

winscard.SCardDisconnect.argtypes = [ctypes.c_void_p, wintypes.DWORD]
winscard.SCardDisconnect.restype = wintypes.LONG

winscard.SCardTransmit.argtypes = [
    ctypes.c_void_p,
    ctypes.POINTER(SCardIORequest),
    ctypes.POINTER(ctypes.c_ubyte),
    wintypes.DWORD,
    ctypes.c_void_p,
    ctypes.POINTER(ctypes.c_ubyte),
    ctypes.POINTER(wintypes.DWORD),
]
winscard.SCardTransmit.restype = wintypes.LONG


def check(result: int, action: str) -> None:
    if result != SCARD_S_SUCCESS:
        raise RuntimeError(f"{action} failed: 0x{result & 0xFFFFFFFF:08X}")


def establish_context() -> ctypes.c_void_p:
    context = ctypes.c_void_p()
    check(winscard.SCardEstablishContext(SCARD_SCOPE_USER, None, None, ctypes.byref(context)), "SCardEstablishContext")
    return context


def list_readers(context: ctypes.c_void_p) -> list[str]:
    length = wintypes.DWORD(0)
    result = winscard.SCardListReadersW(context, None, None, ctypes.byref(length))
    if result != SCARD_S_SUCCESS or length.value <= 1:
        return []

    buffer = ctypes.create_unicode_buffer(length.value)
    result = winscard.SCardListReadersW(context, None, buffer, ctypes.byref(length))
    if result != SCARD_S_SUCCESS:
        return []

    return [reader for reader in buffer.value.split("\x00") if reader]


def read_uid(context: ctypes.c_void_p, reader: str) -> str | None:
    card = ctypes.c_void_p()
    active_protocol = wintypes.DWORD(0)
    result = winscard.SCardConnectW(
        context,
        reader,
        SCARD_SHARE_SHARED,
        SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1,
        ctypes.byref(card),
        ctypes.byref(active_protocol),
    )

    if result in (SCARD_E_NO_SMARTCARD, SCARD_W_REMOVED_CARD):
        return None
    if result != SCARD_S_SUCCESS:
        return None

    try:
        send_pci = SCardIORequest(active_protocol.value, ctypes.sizeof(SCardIORequest))
        command = (ctypes.c_ubyte * 5)(0xFF, 0xCA, 0x00, 0x00, 0x00)
        recv_buffer = (ctypes.c_ubyte * 258)()
        recv_length = wintypes.DWORD(len(recv_buffer))
        result = winscard.SCardTransmit(
            card,
            ctypes.byref(send_pci),
            command,
            len(command),
            None,
            recv_buffer,
            ctypes.byref(recv_length),
        )

        if result != SCARD_S_SUCCESS or recv_length.value < 3:
            return None

        response = bytes(recv_buffer[: recv_length.value])
        if response[-2:] != b"\x90\x00":
            return None

        return response[:-2].hex().upper()
    finally:
        winscard.SCardDisconnect(card, SCARD_LEAVE_CARD)


def post_scan(uid: str) -> None:
    payload = json.dumps({"uid": uid}).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        response.read()


def main() -> int:
    print("ACR122U bridge starting.")
    print(f"Posting scans to {API_URL}")
    context = establish_context()
    last_uid = None

    try:
        while True:
            readers = list_readers(context)
            if not readers:
                print("No PC/SC reader found. Plug in the ACR122U reader.")
                time.sleep(2)
                continue

            uid = read_uid(context, readers[0])
            if uid and uid != last_uid:
                print(f"Card scanned: {uid}")
                try:
                    post_scan(uid)
                    last_uid = uid
                except Exception as error:  # noqa: BLE001 - keep the bridge alive.
                    print(f"Could not post scan to app: {error}")
            elif not uid:
                last_uid = None

            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        print("ACR122U bridge stopped.")
        return 0
    finally:
        winscard.SCardReleaseContext(context)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 - command-line script should print errors.
        print(error, file=sys.stderr)
        raise SystemExit(1)
