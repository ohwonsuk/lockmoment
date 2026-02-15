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
        
        // Only set isLocked = false if no other schedules are active
        if !isAnyScheduleActive() {
            sharedDefaults.set(false, forKey: "isLocked")
            sharedDefaults.removeObject(forKey: "currentLockName")
        }
    }
    
    // Helper to check if any other schedule is active at this moment
    private func isAnyScheduleActive() -> Bool {
        let now = Date()
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: now)
        let hour = calendar.component(.hour, from: now)
        let minute = calendar.component(.minute, from: now)
        let totalMinutes = hour * 60 + minute
        
        let yesterday = (weekday == 1) ? 7 : weekday - 1
        let allKeys = sharedDefaults.dictionaryRepresentation().keys
        
        for checkWeekday in [yesterday, weekday] {
            let suffix = "_\(checkWeekday)"
            for key in allKeys where key.hasPrefix("policy_") && key.hasSuffix(suffix) {
                if let policy = sharedDefaults.dictionary(forKey: key),
                   let startH = policy["startHour"] as? Int,
                   let startM = policy["startMinute"] as? Int,
                   let endH = policy["endHour"] as? Int,
                   let endM = policy["endMinute"] as? Int {
                    
                    let startTotal = startH * 60 + startM
                    let endTotal = endH * 60 + endM
                    let isOvernight = startTotal > endTotal
                    
                    if checkWeekday == weekday {
                        if isOvernight {
                            if totalMinutes >= startTotal { return true }
                        } else {
                            if totalMinutes >= startTotal && totalMinutes < endTotal { return true }
                        }
                    } else if isOvernight {
                        if totalMinutes < endTotal { return true }
                    }
                }
            }
        }
        return false
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
