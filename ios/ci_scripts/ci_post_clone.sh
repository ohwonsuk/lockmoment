#!/usr/bin/env bash

# Exit on error
set -e

echo "--- CI Post-Clone Script Starting ---"
echo "Current Directory: $(pwd)"
echo "Commit Message: $CI_COMMIT_MESSAGE"

if [[ "$CI_COMMIT_MESSAGE" != *"[xcode-build]"* ]]; then
  echo "!!! [xcode-build] tag missing in commit message. Skipping dependency installation !!!"
  echo "Note: This will likely cause the build to fail if Pods are not committed."
  exit 0
fi

# Navigate to the repository root
cd ../..
echo "Root Directory: $(pwd)"

echo "--- Installing Node.js dependencies ---"
if ! command -v npm &> /dev/null
then
    echo "npm not found, installing node via Homebrew..."
    brew install node
fi

npm install --legacy-peer-deps

echo "--- Installing CocoaPods ---"
cd ios
echo "iOS Directory: $(pwd)"

# Ensure CocoaPods is installed
if ! command -v pod &> /dev/null
then
    echo "pod command not found, installing cocoapods..."
    gem install cocoapods
fi

# Run pod install with repo update
if [ -f "../Gemfile" ]; then
    echo "Using Bundler for CocoaPods..."
    cd ..
    bundle install
    cd ios
    bundle exec pod install --repo-update
else
    echo "Using system CocoaPods..."
    pod install --repo-update
fi

echo "--- Verifying Generated Files ---"
if [ -f "Pods/Target Support Files/Pods-LockMoment/Pods-LockMoment.release.xcconfig" ]; then
    echo "SUCCESS: Pods configuration generated."
else
    echo "ERROR: Pods configuration NOT found!"
    exit 1
fi

echo "--- CI Post-Clone Script Complete ---"
