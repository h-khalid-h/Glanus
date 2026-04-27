#!/bin/bash
# Build Glanus Agent PKG Installer for macOS
# Usage: ./build.sh <version>

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Error: Version required"
    echo "Usage: ./build.sh <version>"
    exit 1
fi

echo "Building Glanus Agent v$VERSION for macOS..."

# Step 1: Build universal binary
echo -e "\n[1/5] Building universal binary..."
cd ../../src-tauri
cargo tauri build --target universal-apple-darwin
cd -

# Step 2: Prepare app bundle
echo -e "\n[2/5] Preparing app bundle..."
BUILD_DIR="./build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/Applications"

# Copy app bundle
cp -R "../../src-tauri/target/universal-apple-darwin/release/bundle/macos/Glanus Agent.app" \
     "$BUILD_DIR/Applications/"

# Bundle installer resources that postinstall expects to find inside the app.
cp "./com.glanus.agent.plist" \
    "$BUILD_DIR/Applications/Glanus Agent.app/Contents/Resources/com.glanus.agent.plist"

# Step 3: Build component package
echo -e "\n[3/5] Building component package..."
pkgbuild --root "$BUILD_DIR" \
         --identifier com.glanus.agent \
         --version "$VERSION" \
         --install-location / \
         --scripts ./scripts \
         "glanus-agent-component.pkg"

# Step 4: Build product package
echo -e "\n[4/5] Building product package..."
sed "s/version=\"0.0.0\"/version=\"$VERSION\"/" ./distribution.xml > "$BUILD_DIR/distribution.xml"
productbuild --distribution "$BUILD_DIR/distribution.xml" \
             --package-path . \
             "glanus-agent-$VERSION-unsigned.pkg"

# Step 5: Sign package
echo -e "\n[5/5] Signing package..."

if [ -n "$APPLE_DEVELOPER_ID" ]; then
    productsign --sign "$APPLE_DEVELOPER_ID" \
                 "glanus-agent-$VERSION-unsigned.pkg" \
                 "glanus-agent-$VERSION.pkg"
    
    echo "✓ Package signed"
    
    # Notarize if credentials available
    if [ -n "$APPLE_ID" ] && [ -n "$APPLE_ID_PASSWORD" ] && [ -n "$APPLE_TEAM_ID" ]; then
        echo "Submitting for notarization..."
        xcrun notarytool submit "glanus-agent-$VERSION.pkg" \
            --apple-id "$APPLE_ID" \
            --password "$APPLE_ID_PASSWORD" \
            --team-id "$APPLE_TEAM_ID" \
            --wait

        xcrun stapler staple "glanus-agent-$VERSION.pkg"
        
        echo "✓ Notarization complete"
    else
        echo "⚠ Skipping notarization (credentials not found)"
    fi
    
    # Cleanup unsigned package
    rm "glanus-agent-$VERSION-unsigned.pkg"
else
    echo "⚠ Skipping code signing (APPLE_DEVELOPER_ID not set)"
    mv "glanus-agent-$VERSION-unsigned.pkg" "glanus-agent-$VERSION.pkg"
fi

# Cleanup
rm -rf "$BUILD_DIR"
rm -f glanus-agent-component.pkg

echo -e "\n✓ Build complete!"
echo "Output: glanus-agent-$VERSION.pkg"
