#!/usr/bin/env bash

# Exit on error
set -e

# The script runs in the directory where it's located (ios/ci_scripts)
# Navigate to the repository root
cd ../..

echo "--- Installing Node.js dependencies ---"
# Using --legacy-peer-deps might be safer for some RN setups, but npm install is standard
npm install

echo "--- Installing CocoaPods ---"
# Navigate back to ios directory
cd ios

# Check if Gemfile exists in the root for bundled cocoapods
if [ -f "../Gemfile" ]; then
    echo "Using Bundler for CocoaPods..."
    cd ..
    bundle install
    cd ios
    bundle exec pod install
else
    echo "Using system CocoaPods..."
    pod install
fi

echo "--- Xcode Cloud post-clone setup complete ---"
