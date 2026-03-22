#!/usr/bin/env bash
set -euo pipefail

# SPECTRA SDD Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/juliosaraiva/spectra-sdd/main/install.sh | bash

REPO_URL="https://github.com/juliosaraiva/spectra-sdd.git"
INSTALL_DIR="${SPECTRA_INSTALL_DIR:-$HOME/.spectra-sdd}"
BIN_DIR="${SPECTRA_BIN_DIR:-}"
REQUIRED_NODE_MAJOR=20

# --- Colors ---

if [ -t 1 ] && [ "${NO_COLOR:-}" = "" ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' BOLD='' RESET=''
fi

info()    { printf "${BLUE}[info]${RESET}    %s\n" "$1"; }
success() { printf "${GREEN}[ok]${RESET}      %s\n" "$1"; }
warn()    { printf "${YELLOW}[warn]${RESET}    %s\n" "$1"; }
error()   { printf "${RED}[error]${RESET}   %s\n" "$1" >&2; exit 1; }

# --- Cleanup on failure ---

cleanup() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    printf "\n${RED}Installation failed.${RESET} Check the error above.\n" >&2
  fi
}
trap cleanup EXIT

# --- Banner ---

printf "\n${BOLD}SPECTRA SDD Installer${RESET}\n"
printf "Spec-Driven Development with Composable Traceability\n\n"

# --- Check prerequisites ---

info "Checking prerequisites..."

# Node.js
if ! command -v node >/dev/null 2>&1; then
  error "Node.js is not installed. Install Node.js >= ${REQUIRED_NODE_MAJOR} from https://nodejs.org"
fi

NODE_VERSION=$(node --version)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/^v//' | cut -d. -f1)

if [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
  error "Node.js >= ${REQUIRED_NODE_MAJOR}.0.0 required (found ${NODE_VERSION}). Update at https://nodejs.org"
fi

success "Node.js ${NODE_VERSION}"

# npm
if ! command -v npm >/dev/null 2>&1; then
  error "npm is not installed. It should come with Node.js — reinstall Node.js from https://nodejs.org"
fi

success "npm $(npm --version)"

# git
if ! command -v git >/dev/null 2>&1; then
  error "git is not installed. Install git from https://git-scm.com"
fi

success "git $(git --version | cut -d' ' -f3)"

# --- Clone or update ---

if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating existing installation at ${INSTALL_DIR}..."
  cd "$INSTALL_DIR"
  git pull --ff-only || error "Update failed. If you have local changes in ${INSTALL_DIR}, stash or discard them."
else
  if [ -d "$INSTALL_DIR" ]; then
    error "${INSTALL_DIR} exists but is not a git repo. Remove it first: rm -rf ${INSTALL_DIR}"
  fi
  info "Cloning SPECTRA to ${INSTALL_DIR}..."
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# --- Build ---

info "Installing dependencies..."
npm ci --silent 2>&1 | tail -1 || true

info "Building..."
npm run build --silent

if [ ! -f "dist/index.js" ]; then
  error "Build failed — dist/index.js not found"
fi

chmod +x dist/index.js
success "Build complete"

# --- Symlink ---

resolve_bin_dir() {
  if [ -n "$BIN_DIR" ]; then
    # User-specified via SPECTRA_BIN_DIR
    mkdir -p "$BIN_DIR"
    echo "$BIN_DIR"
    return
  fi

  # Try /usr/local/bin first
  if [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
    echo "/usr/local/bin"
    return
  fi

  # Try with sudo
  if [ -d "/usr/local/bin" ] && command -v sudo >/dev/null 2>&1; then
    echo "sudo:/usr/local/bin"
    return
  fi

  # Fallback to ~/.local/bin
  mkdir -p "$HOME/.local/bin"
  echo "$HOME/.local/bin"
}

RESOLVED_BIN=$(resolve_bin_dir)

if [[ "$RESOLVED_BIN" == sudo:* ]]; then
  ACTUAL_BIN_DIR="${RESOLVED_BIN#sudo:}"
  info "Linking spectra to ${ACTUAL_BIN_DIR}/spectra (requires sudo)..."
  sudo ln -sf "${INSTALL_DIR}/dist/index.js" "${ACTUAL_BIN_DIR}/spectra"
else
  ACTUAL_BIN_DIR="$RESOLVED_BIN"
  info "Linking spectra to ${ACTUAL_BIN_DIR}/spectra..."
  ln -sf "${INSTALL_DIR}/dist/index.js" "${ACTUAL_BIN_DIR}/spectra"
fi

success "Linked ${ACTUAL_BIN_DIR}/spectra"

# --- Check PATH ---

if ! echo "$PATH" | tr ':' '\n' | grep -qx "$ACTUAL_BIN_DIR"; then
  warn "${ACTUAL_BIN_DIR} is not in your PATH"
  SHELL_NAME=$(basename "${SHELL:-/bin/bash}")
  case "$SHELL_NAME" in
    zsh)  RC_FILE="~/.zshrc" ;;
    bash) RC_FILE="~/.bashrc" ;;
    fish) RC_FILE="~/.config/fish/config.fish" ;;
    *)    RC_FILE="your shell config" ;;
  esac
  printf "  Add this to ${RC_FILE}:\n"
  printf "  ${BOLD}export PATH=\"${ACTUAL_BIN_DIR}:\$PATH\"${RESET}\n\n"
fi

# --- Smoke test ---

if "${ACTUAL_BIN_DIR}/spectra" --version >/dev/null 2>&1; then
  SPECTRA_VERSION=$("${ACTUAL_BIN_DIR}/spectra" --version)
  success "spectra v${SPECTRA_VERSION} installed"
else
  warn "spectra was installed but the smoke test failed. You may need to restart your shell."
fi

# --- Done ---

printf "\n${GREEN}${BOLD}Installation complete!${RESET}\n\n"
printf "  Installed to:  ${INSTALL_DIR}\n"
printf "  Binary at:     ${ACTUAL_BIN_DIR}/spectra\n\n"
printf "  Get started:\n"
printf "    ${BOLD}spectra init --project-id my-app${RESET}\n"
printf "    ${BOLD}spectra spec new my-feature${RESET}\n"
printf "    ${BOLD}spectra validate --all${RESET}\n\n"
