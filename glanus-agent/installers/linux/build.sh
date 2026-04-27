#!/bin/bash
# Build Glanus Agent DEB + RPM packages for Linux.
#
# The binary is a single artifact that serves both modes:
#   • systemd service  -> `glanus-agent --daemon` (headless, no display)
#   • desktop launcher -> `glanus-agent`          (full Tauri GUI)
#
# Usage: ./build.sh <version>

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Error: Version required"
    echo "Usage: ./build.sh <version>"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TAURI_DIR="$AGENT_ROOT/src-tauri"

echo "Building Glanus Agent v$VERSION for Linux (GUI + daemon)..."

# Step 1: Build the frontend (React/Vite) so tauri::generate_context! can
# embed dist/ into the binary.
echo -e "\n[1/5] Building frontend assets (npm run build)..."
cd "$AGENT_ROOT"
if [ ! -d node_modules ]; then
    npm ci
fi
npm run build

# Step 2: Build the Rust binary with Tauri GUI + remote-desktop host enabled.
# `remote_desktop` is the default Cargo feature so `--features` is technically
# redundant here, but kept explicit so the intent is clear in CI logs.
echo -e "\n[2/5] Building Rust binary..."
cd "$TAURI_DIR"
cargo build --release --target x86_64-unknown-linux-gnu --features remote_desktop

# Step 3: Prepare DEB package structure
echo -e "\n[3/5] Preparing DEB package structure..."
cd "$SCRIPT_DIR"
BUILD_DIR="$SCRIPT_DIR/build"
rm -rf "$BUILD_DIR"

mkdir -p "$BUILD_DIR/usr/bin"
mkdir -p "$BUILD_DIR/usr/lib/systemd/system"
mkdir -p "$BUILD_DIR/usr/share/applications"
mkdir -p "$BUILD_DIR/usr/share/icons/hicolor/128x128/apps"
mkdir -p "$BUILD_DIR/usr/share/icons/hicolor/32x32/apps"
mkdir -p "$BUILD_DIR/usr/share/icons/hicolor/256x256/apps"
mkdir -p "$BUILD_DIR/var/lib/glanus-agent"
mkdir -p "$BUILD_DIR/DEBIAN"

# Step 4: Copy files
echo -e "\n[4/5] Copying files..."

# Binary
cp "$TAURI_DIR/target/x86_64-unknown-linux-gnu/release/glanus-agent" \
   "$BUILD_DIR/usr/bin/"
chmod 755 "$BUILD_DIR/usr/bin/glanus-agent"

# X11 environment auto-detection helper (used by ExecStartPre in the unit).
cp glanus-agent-detect-x11 "$BUILD_DIR/usr/bin/"
chmod 755 "$BUILD_DIR/usr/bin/glanus-agent-detect-x11"

# systemd service
cp glanus-agent.service "$BUILD_DIR/usr/lib/systemd/system/"
chmod 644 "$BUILD_DIR/usr/lib/systemd/system/glanus-agent.service"

# Desktop entry (GUI launcher)
cp glanus-agent.desktop "$BUILD_DIR/usr/share/applications/"
chmod 644 "$BUILD_DIR/usr/share/applications/glanus-agent.desktop"

# Icons (hicolor theme so GNOME/KDE/XFCE/etc. pick it up)
cp "$TAURI_DIR/icons/32x32.png"   "$BUILD_DIR/usr/share/icons/hicolor/32x32/apps/glanus-agent.png"
cp "$TAURI_DIR/icons/128x128.png" "$BUILD_DIR/usr/share/icons/hicolor/128x128/apps/glanus-agent.png"
# 256x256: reuse 128@2x if available, otherwise 128x128
if [ -f "$TAURI_DIR/icons/128x128@2x.png" ]; then
    cp "$TAURI_DIR/icons/128x128@2x.png" "$BUILD_DIR/usr/share/icons/hicolor/256x256/apps/glanus-agent.png"
else
    cp "$TAURI_DIR/icons/128x128.png" "$BUILD_DIR/usr/share/icons/hicolor/256x256/apps/glanus-agent.png"
fi

# DEBIAN control files
cp DEBIAN/control  "$BUILD_DIR/DEBIAN/"
cp DEBIAN/postinst "$BUILD_DIR/DEBIAN/"
cp DEBIAN/prerm    "$BUILD_DIR/DEBIAN/"

# Update version in control file
sed -i "s/Version: .*/Version: $VERSION/" "$BUILD_DIR/DEBIAN/control"

# Set permissions for maintainer scripts
chmod 755 "$BUILD_DIR/DEBIAN/postinst"
chmod 755 "$BUILD_DIR/DEBIAN/prerm"

# Step 5: Build DEB package
echo -e "\n[5/5] Building DEB package..."
dpkg-deb --build --root-owner-group "$BUILD_DIR" "glanus-agent_${VERSION}_amd64.deb"

# Cleanup
rm -rf "$BUILD_DIR"

echo -e "\n✓ Build complete!"
echo "Output: glanus-agent_${VERSION}_amd64.deb"

# Show package info
echo -e "\nPackage info:"
dpkg-deb -I "glanus-agent_${VERSION}_amd64.deb"

# ── RPM package (requires rpm-build) ──────────────────────────────────────────
# RPM is best-effort — failure must not abort the overall build (the DEB is
# the primary artifact served by the Next.js /api/downloads route).
if command -v rpmbuild &> /dev/null; then
    echo -e "\n[+] Building RPM package (non-fatal)..."
    set +e
    (
        set -e
        RPM_ROOT="$SCRIPT_DIR/rpmbuild"
        RPM_BR="$RPM_ROOT/BUILDROOT/glanus-agent-${VERSION}-1.x86_64"
        mkdir -p "$RPM_ROOT"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
        mkdir -p "$RPM_BR/usr/bin"
        mkdir -p "$RPM_BR/usr/lib/systemd/system"
        mkdir -p "$RPM_BR/usr/share/applications"
        mkdir -p "$RPM_BR/usr/share/icons/hicolor/32x32/apps"
        mkdir -p "$RPM_BR/usr/share/icons/hicolor/128x128/apps"
        mkdir -p "$RPM_BR/usr/share/icons/hicolor/256x256/apps"
        mkdir -p "$RPM_BR/var/lib/glanus-agent"

        cp "$TAURI_DIR/target/x86_64-unknown-linux-gnu/release/glanus-agent" \
           "$RPM_BR/usr/bin/"
        cp glanus-agent.service       "$RPM_BR/usr/lib/systemd/system/"
        cp glanus-agent.desktop       "$RPM_BR/usr/share/applications/"
        cp "$TAURI_DIR/icons/32x32.png"   "$RPM_BR/usr/share/icons/hicolor/32x32/apps/glanus-agent.png"
        cp "$TAURI_DIR/icons/128x128.png" "$RPM_BR/usr/share/icons/hicolor/128x128/apps/glanus-agent.png"
        if [ -f "$TAURI_DIR/icons/128x128@2x.png" ]; then
            cp "$TAURI_DIR/icons/128x128@2x.png" "$RPM_BR/usr/share/icons/hicolor/256x256/apps/glanus-agent.png"
        else
            cp "$TAURI_DIR/icons/128x128.png"    "$RPM_BR/usr/share/icons/hicolor/256x256/apps/glanus-agent.png"
    fi

    cat > "$RPM_ROOT/SPECS/glanus-agent.spec" <<SPECEOF
Name:           glanus-agent
Version:        ${VERSION}
Release:        1
Summary:        Glanus remote monitoring and management agent
License:        MIT
BuildArch:      x86_64
Requires:       webkit2gtk4.1, gtk3, libappindicator-gtk3, librsvg2

%description
Glanus Agent — Tauri-based GUI for interactive monitoring and a systemd
daemon mode for background remote management.

%install
cp -r %{_builddir}/../BUILDROOT/%{name}-%{version}-%{release}.%{_arch}/* %{buildroot}/

%files
/usr/bin/glanus-agent
/usr/lib/systemd/system/glanus-agent.service
/usr/share/applications/glanus-agent.desktop
/usr/share/icons/hicolor/32x32/apps/glanus-agent.png
/usr/share/icons/hicolor/128x128/apps/glanus-agent.png
/usr/share/icons/hicolor/256x256/apps/glanus-agent.png
%dir /var/lib/glanus-agent

%post
systemctl daemon-reload
systemctl enable glanus-agent
/usr/bin/update-desktop-database -q /usr/share/applications || true
/usr/bin/gtk-update-icon-cache -q -f /usr/share/icons/hicolor 2>/dev/null || true

%preun
systemctl stop glanus-agent || true
systemctl disable glanus-agent || true
SPECEOF

    rpmbuild --define "_topdir $RPM_ROOT" \
             --define "_builddir $RPM_ROOT/BUILDROOT" \
             -bb "$RPM_ROOT/SPECS/glanus-agent.spec"

    RPM_FILE=$(find "$RPM_ROOT/RPMS" -name "*.rpm" | head -n1)
    if [ -n "$RPM_FILE" ]; then
        cp "$RPM_FILE" "glanus-agent-${VERSION}-1.x86_64.rpm"
        echo "  → glanus-agent-${VERSION}-1.x86_64.rpm"
    fi
    rm -rf "$RPM_ROOT"
    )
    rpm_rc=$?
    set -e
    if [ $rpm_rc -ne 0 ]; then
        echo "[!] RPM build failed (rc=$rpm_rc) — continuing since DEB is the primary artifact."
    fi
else
    echo -e "\n[+] Skipping RPM build (rpmbuild not found)"
    echo "  Install rpm-build to generate RPM: sudo apt install rpm"
fi
