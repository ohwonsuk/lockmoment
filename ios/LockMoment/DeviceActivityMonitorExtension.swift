import DeviceActivity
import ManagedSettings
import FamilyControls
import Foundation

// DeviceActivityMonitorExtension.swift
// 이 파일은 Xcode에서 'Device Activity Monitor Extension' 타켓을 생성한 후 해당 타겟에 포함되어야 합니다.

extension ManagedSettingsStore.Name {
    static let lockMoment = ManagedSettingsStore.Name("com.lockmoment.store")
}

class DeviceActivityMonitorExtension: DeviceActivityMonitor {
    
    let sharedDefaults = UserDefaults(suiteName: "group.com.lockmoment") ?? UserDefaults.standard
    
    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        
        let store = ManagedSettingsStore(named: .lockMoment)
        
        // activity.rawValue 는 "com.lockmoment.schedule.{id}_{weekday}" 형식입니다.
        let activityId = activity.rawValue.replacingOccurrences(of: "com.lockmoment.schedule.", with: "")
        let policyKey = "policy_\(activityId)"
        
        guard let policy = sharedDefaults.dictionary(forKey: policyKey) else {
            return
        }
        
        let lockType = policy["lockType"] as? String ?? "FULL"
        let preventAppRemoval = policy["preventAppRemoval"] as? Bool ?? true
        let name = policy["name"] as? String ?? "예약 잠금"
        
        if lockType.uppercased() == "FULL" {
            // FULL 모드: 전체 앱 차단 (시스템 앱 제외)
            store.shield.applications = nil
            store.shield.applicationCategories = .all()
        } else if let selectionData = policy["selection"] as? Data {
            // APP 모드: 선택된 앱/카테고리만 차단
            // FamilyActivitySelection 등 네이티브 타입은 PropertyListDecoder가 권장됨
            if let selection = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: selectionData) {
                store.shield.applications = selection.applicationTokens
                store.shield.applicationCategories = .specific(selection.categoryTokens)
            }
        }
        
        if preventAppRemoval {
            if #available(iOS 16.0, *) {
                store.application.denyAppRemoval = true
            }
        }
        
        // 메인 앱과 상태 공유
        sharedDefaults.set(true, forKey: "isLocked")
        sharedDefaults.set(name, forKey: "currentLockName")
    }
    
    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        
        let store = ManagedSettingsStore(named: .lockMoment)
        store.clearAllSettings()
        
        // 앱 삭제 방지 설정이 글로벌하게 켜져 있다면 복구
        let globalPrevent = sharedDefaults.bool(forKey: "preventAppRemovalSetting")
        if #available(iOS 16.0, *) {
            store.application.denyAppRemoval = globalPrevent
        }
        
        // 상태 업데이트
        sharedDefaults.set(false, forKey: "isLocked")
    }
    
    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        super.eventDidReachThreshold(event, activity: activity)
    }
    
    override func intervalWillStartWarning(for activity: DeviceActivityName) {
        super.intervalWillStartWarning(for: activity)
    }
    
    override func intervalWillEndWarning(for activity: DeviceActivityName) {
        super.intervalWillEndWarning(for: activity)
    }
}
