#!/usr/bin/env bash
set -euo pipefail

# SPECTRA SDD Uninstaller

INSTALL_DIR="${SPECTRA_INSTALL_DIR:-$HOME/.spectra-sdd}"

# --- Colors ---

if [ -t 1 ] && [ "${NO_COLOR:-}" = "" ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' BOLD='' RESET=''
fi

info()    { printf "${YELLOW}[info]${RESET}    %s\n" "$1"; }
success() { printf "${GREEN}[ok]${RESET}      %s\n" "$1"; }

printf "\n${BOLD}SPECTRA SDD Uninstaller${RESET}\n\n"

# --- Find and remove symlink ---

FOUND_SYMLINK=""
for BIN_PATH in "/usr/local/bin/spectra" "$HOME/.local/bin/spectra"; do
  if [ -L "$BIN_PATH" ]; then
    TARGET=$(readlink "$BIN_PATH" 2>/dev/null || true)
    if [[ "$TARGET" == *spectra-sdd* ]]; then
      FOUND_SYMLINK="$BIN_PATH"
      break
    fi
  fi
done

# Also check SPECTRA_BIN_DIR
if [ -z "$FOUND_SYMLINK" ] && [ -n "${SPECTRA_BIN_DIR:-}" ]; then
  if [ -L "${SPECTRA_BIN_DIR}/spectra" ]; then
    FOUND_SYMLINK="${SPECTRA_BIN_DIR}/spectra"
  fi
fi

if [ -n "$FOUND_SYMLINK" ]; then
  if [ -w "$(dirname "$FOUND_SYMLINK")" ]; then
    rm -f "$FOUND_SYMLINK"
  elif command -v sudo >/dev/null 2>&1; then
    sudo rm -f "$FOUND_SYMLINK"
  else
    info "Could not remove ${FOUND_SYMLINK} (permission denied). Remove it manually."
  fi
  success "Removed symlink ${FOUND_SYMLINK}"
else
  info "No spectra symlink found in PATH"
fi

# --- Remove install directory ---

if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  success "Removed ${INSTALL_DIR}"
else
  info "Install directory ${INSTALL_DIR} not found (already removed?)"
fi

printf "\n${GREEN}${BOLD}SPECTRA SDD has been uninstalled.${RESET}\n\n"
