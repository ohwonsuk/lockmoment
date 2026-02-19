# 크래시 디버깅 가이드

앱이 계속 크래시되는 경우, 다음 방법으로 정확한 오류 원인을 파악할 수 있습니다:

## 1. Xcode Console 로그 확인

1. Xcode에서 앱 실행
2. 하단의 Console 패널 열기 (View > Debug Area > Activate Console)
3. "차단 대상 선택하기" 버튼 클릭
4. 크래시 발생 시 콘솔에 출력되는 에러 메시지 확인

## 2. 크래시 리포트 확인

### 방법 A: Xcode에서 확인
1. Window > Devices and Simulators
2. 연결된 기기 선택
3. "View Device Logs" 클릭
4. 최신 크래시 로그 확인

### 방법 B: 기기에서 직접 확인
1. 설정 > 개인정보 보호 및 보안 > 분석 및 개선사항
2. 분석 데이터
3. "LockMoment" 관련 최신 파일 찾기

## 3. 확인해야 할 주요 정보

크래시 로그에서 다음 정보를 찾아주세요:

- **Exception Type**: 어떤 종류의 크래시인지
- **Exception Message**: 구체적인 에러 메시지
- **Termination Reason**: 앱이 종료된 이유
- **Thread Stack**: 크래시가 발생한 코드 위치

## 4. 일반적인 FamilyActivityPicker 크래시 원인

### A. 권한 관련
- **증상**: "NSInternalInconsistencyException"
- **원인**: Screen Time 권한이 없는 상태에서 피커 호출
- **확인**: Settings > Screen Time > See All Activity에서 앱 권한 확인

### B. Entitlement 누락
- **증상**: 앱이 즉시 종료되거나 "API Misuse" 에러
- **원인**: Info.plist나 .entitlements 파일 설정 누락
- **확인**: 
  - Info.plist에 `NSFamilyControlsUsageDescription` 있는지
  - LockMoment.entitlements에 `com.apple.developer.family-controls` 있는지

### C. iOS 버전
- **증상**: "unavailable" 관련 에러
- **원인**: iOS 15.0 미만에서 실행
- **확인**: 설정 > 일반 > 정보에서 iOS 버전 확인

### D. App Group 설정
- **증상**: 데이터 접근 오류
- **원인**: App Group이 올바르게 설정되지 않음
- **확인**: 
  - Xcode > Signing & Capabilities
  - App Groups에 `group.com.lockmoment` 있는지

## 5. 긴급 테스트

다음 코드를 `AppLockSettingsScreen.tsx`에 임시로 추가하여 권한 상태를 확인:

```typescript
useEffect(() => {
    const checkAuth = async () => {
        try {
            const status = await NativeLockControl.checkAuthorization();
            console.log('[DEBUG] Authorization Status:', status);
            // 0: notDetermined, 1: denied, 2: approved
        } catch (e) {
            console.error('[DEBUG] Auth check failed:', e);
        }
    };
    checkAuth();
}, []);
```

## 6. 결과 보고

크래시 로그를 확인한 후 다음 정보를 공유해주세요:
1. Exception Type
2. Exception Message  
3. 크래시가 발생한 정확한 코드 위치 (스택 트레이스)
4. Authorization Status 값
5. iOS 버전

이 정보가 있으면 정확한 원인을 파악하고 해결할 수 있습니다.
