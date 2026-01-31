#!/usr/bin/env bash

# Exit on error
set -e

if [[ "$CI_COMMIT_MESSAGE" != *"[xcode-build]"* ]]; then
  echo "Skipping build as [xcode-build] tag is missing in commit message."
  exit 0
fi

# The script runs in the directory where it's located (ios/ci_scripts)
# Navigate to the repository root
cd ../..

echo "--- Installing Node.js dependencies ---"
if ! command -v npm &> /dev/null
then
    echo "npm could not be found, installing node via Homebrew..."
    # Xcode Cloud comes with Homebrew
    brew install node
fi

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
