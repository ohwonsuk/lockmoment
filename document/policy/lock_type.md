# 🔐 LockMoment

## Android 앱 잠금 구조 & iOS 1:1 매칭 설계

---

## 🎯 설계 목표 (공통)

|목표|설명|
|---|---|
|사용자 인지 일관성|Android / iOS 차이 인지 ❌|
|QR 기반 동일 UX|QR 스캔 → 잠금 즉시 실행|
|정책 중심 설계|플랫폼은 구현체|
|관리자는 동일 UI|관리자 화면 분기 ❌|

---

# 1️⃣ 개념 통합 (플랫폼 중립)

### 📌 Lock Policy (플랫폼 공통)

```json
{
  "lockType": "FULL | APP",
  "allowedApps": ["com.apple.mobilephone", "com.android.dialer"],
  "blockedApps": ["youtube", "tiktok"],
  "durationMinutes": 90,
  "unlockCondition": "TIME | ADMIN"
}
```

> ✔ 서버는 **정책만** 관리  
> ✔ 앱에서 플랫폼별 해석

---

# 2️⃣ Android 잠금 구조 (실제 구현)

## A. Android 권한 구조

|기능|권한|
|---|---|
|앱 차단|Accessibility Service|
|전체 잠금|Device Owner (선택)|
|앱 목록 조회|PACKAGE_USAGE_STATS|
|강제 화면|SYSTEM_ALERT_WINDOW|

---

## B. Android 잠금 유형

### 🔒 ① 전체 잠금 (Full Lock)

**구현**

- 전체 화면 Overlay
- Home / Back 차단
- 전화 / 카메라 예외 허용
    

```kotlin
if (lockType == FULL) {
    showFullScreenOverlay()
}
```

---

### 📵 ② 앱 잠금 (App Lock)

**구현**

- AccessibilityService로 foreground 앱 감지
- 차단 대상 실행 시 Lock UI 덮어쓰기
    

```kotlin
override fun onAccessibilityEvent(event: AccessibilityEvent) {
    val pkg = event.packageName.toString()
    if (blockedApps.contains(pkg)) {
        launchLockScreen()
    }
}
```

---

### 📱 ③ 허용 앱 방식 (권장)

```kotlin
if (!allowedApps.contains(pkg)) {
    launchLockScreen()
}
```

👉 iOS 구조와 **완벽 매칭됨**

---

# 3️⃣ iOS 대응 매핑 (Family Controls)

|공통 개념|Android|iOS|
|---|---|---|
|전체 잠금|Overlay|Shield(all except allowed)|
|앱 잠금|Accessibility|Shield(apps/categories)|
|허용 앱|allowList|allowList|
|시간 종료|Timer|DeviceActivity|
|관리자 해제|push|push|

---

## iOS “전체 잠금” 정의

> 🔴 iOS에는 진짜 전체 잠금 없음  
> ✅ **허용 앱 외 전부 Shield** = Full Lock

```swift
store.shield.applications = .all
store.shield.applicationCategories = .all
```

---

# 4️⃣ QR 기반 통합 실행 플로우

```
QR 스캔
 ↓
서버 정책 조회
 ↓
lockType 판단
 ↓
Android / iOS 분기
 ↓
즉시 잠금 실행
```
