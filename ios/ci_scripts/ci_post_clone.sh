#!/usr/bin/env bash

# Exit on error
set -e

echo "--- [Xcode Cloud] ci_post_clone.sh started ---"

# 1. Environment Setup
# Add Homebrew to PATH (standard Apple Silicon paths)
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin
export HOMEBREW_NO_AUTO_UPDATE=1

echo "Current Directory: $(pwd)"
# The script usually runs from ios/ci_scripts/
# Move to the project root
cd ../..
echo "Project Root: $(pwd)"

# 2. Node.js Installation
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing via Homebrew..."
    brew install node
else
    echo "Node.js version: $(node -v)"
fi

# 3. Node Dependencies
echo "--- Installing NPM dependencies ---"
# Using --legacy-peer-deps to avoid common RN version conflicts
npm install --legacy-peer-deps

# 4. CocoaPods Installation
echo "--- Installing CocoaPods ---"
# Ensure we are using the project's preferred Ruby environment if possible
if ! command -v pod &> /dev/null; then
    echo "Pod command not found. Installing via Gem..."
    gem install cocoapods
fi
echo "Pod version: $(pod --version)"

# 5. Pod Install
echo "--- Running Pod Install ---"
cd ios
echo "iOS Directory: $(pwd)"

# React Native 0.74+ often requires these env vars for Pod install
export RCT_NEW_ARCH_ENABLED=1

if [ -f "../Gemfile" ]; then
    echo "Using Bundler..."
    bundle install
    bundle exec pod install --repo-update
else
    echo "Using Standard Pod..."
    pod install --repo-update
fi

# 6. Verification
echo "--- Verifying Output ---"
# Check the specific file Xcode was complaining about
EXPECTED_FILE="Pods/Target Support Files/Pods-LockMoment/Pods-LockMoment.release.xcconfig"
if [ -f "$EXPECTED_FILE" ]; then
    echo "SUCCESS: Pods configuration found."
else
    echo "ERROR: Pods configuration NOT FOUND at $EXPECTED_FILE"
    echo "Directory contents of ios/Pods/Target Support Files/Pods-LockMoment/:"
    ls -la "Pods/Target Support Files/Pods-LockMoment/" || echo "Directory not found."
    exit 1
fi

echo "--- [Xcode Cloud] ci_post_clone.sh completed successfully ---"
