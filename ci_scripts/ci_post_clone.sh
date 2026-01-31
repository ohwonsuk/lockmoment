#!/usr/bin/env bash

# 오류 발생 시 즉시 중단
set -e

echo "--- [Xcode Cloud] ci_post_clone.sh 시작 ---"

# Homebrew 및 Node 경로 설정
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin
export HOMEBREW_NO_AUTO_UPDATE=1

echo "현재 디렉토리: $(pwd)"
echo "커밋 메시지: $CI_COMMIT_MESSAGE"

# 태그 확인 (대소문자 구분 없이 확인)
if [[ "${CI_COMMIT_MESSAGE,,}" != *"[xcode-build]"* ]]; then
  echo "!!! [xcode-build] 태그가 커밋 메시지에 없습니다. 의존성 설치를 건너뜁니다. !!!"
  # 만약 의존성이 커밋되지 않은 상태라면 이 지점 이후의 빌드는 실패하게 됩니다.
  exit 0
fi

# 1. Node.js 설치 및 확인
echo "--- Node.js 환경 확인 ---"
if ! command -v node &> /dev/null; then
    echo "Node.js가 없습니다. Homebrew를 통해 설치합니다..."
    brew install node
else
    echo "Node.js 버전: $(node -v)"
fi

# 2. Node 의존성 설치
echo "--- NPM 의존성 설치 (Root) ---"
# Xcode Cloud는 기본적으로 repository root에서 스크립트를 실행합니다.
# 만약 스크립트 위치가 root/ci_scripts 라면 현재 위치는 root 입니다.
npm install --legacy-peer-deps

# 3. CocoaPods 설치 및 확인
echo "--- CocoaPods 환경 확인 ---"
if ! command -v pod &> /dev/null; then
    echo "Pod 명령어를 찾을 수 없습니다. 설치를 시도합니다..."
    gem install cocoapods
fi
echo "Pod 버전: $(pod --version)"

# 4. Pod Install 실행
echo "--- Pod Install 실행 (ios 디렉토리) ---"
cd ios

# Podfile 내에서 node를 호출하므로 PATH가 유지되어야 함
if [ -f "../Gemfile" ]; then
    echo "Bundler를 사용하여 Pod 설치..."
    bundle install
    bundle exec pod install --repo-update
else
    echo "기본 Pod 설치..."
    pod install --repo-update
fi

# 5. 결과 검증
echo "--- 설치 결과 검증 ---"
CONFIG_FILE="Pods/Target Support Files/Pods-LockMoment/Pods-LockMoment.release.xcconfig"
if [ -f "$CONFIG_FILE" ]; then
    echo "성공: Pods 설정 파일이 생성되었습니다."
else
    echo "오류: Pods 설정 파일이 생성되지 않았습니다! ($CONFIG_FILE)"
    ls -R Pods/Target\ Support\ Files/ || echo "디렉토리 구조를 읽을 수 없습니다."
    exit 1
fi

echo "--- [Xcode Cloud] ci_post_clone.sh 완료 ---"
