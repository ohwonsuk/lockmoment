import DeviceActivity
import ManagedSettings
import FamilyControls
import Foundation

extension ManagedSettingsStore.Name {
    static let lockMoment = ManagedSettingsStore.Name("com.lockmoment.store")
}

class DeviceActivityMonitorExtension: DeviceActivityMonitor {
    
    // 객체가 해제되어 설정이 풀리는 것을 방지하기 위해 클래스 수준에서 유지
    let namedStore = ManagedSettingsStore(named: .lockMoment)
    let defaultStore = ManagedSettingsStore()
    
    let sharedDefaults = UserDefaults(suiteName: "group.com.lockmoment") ?? UserDefaults.standard
    
    // MARK: - Interval Did Start
    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        
        let activityId = activity.rawValue.replacingOccurrences(of: "lms.", with: "")
        log("[Extension] intervalDidStart: \(activityId)")
        
        let policyKey = "policy_\(activityId)"
        
        guard let policy = sharedDefaults.dictionary(forKey: policyKey) else {
            log("[Extension] No policy found for \(policyKey). Full lock forced.")
            applyLock(lockType: "FULL", policy: [:], activityId: activityId)
            return
        }
        
        let lockType = (policy["lockType"] as? String ?? "FULL").uppercased()
        applyLock(lockType: lockType, policy: policy, activityId: activityId)
    }
    
    private func applyLock(lockType: String, policy: [String: Any], activityId: String) {
        let name = policy["name"] as? String ?? "예약 잠금"
        let preventAppRemoval = policy["preventAppRemoval"] as? Bool ?? true
        
        log("[Extension] Applying \(lockType) lock for \(name)")

        // 1. Named Store와 Default Store 양쪽에 적용 (안정성 극대화)
        let stores = [namedStore, defaultStore]
        
        for store in stores {
            if lockType == "FULL" {
                applyFullLock(store: store)
            } else {
                let parts = activityId.split(separator: "_")
                let scheduleId = String(parts.dropLast().joined(separator: "_"))
                
                let success = applyAppSelection(store: store, policy: policy, scheduleId: scheduleId)
                if !success {
                    log("[Extension] App selection missing. Falling back to FULL.")
                    applyFullLock(store: store)
                }
            }
            
            if preventAppRemoval {
                if #available(iOS 16.0, *) {
                    store.application.denyAppRemoval = true
                }
            }
        }
        
        updateSharedState(isLocked: true, name: name, lockType: lockType)
        sharedDefaults.synchronize()
    }
    
    // MARK: - Interval Did End
    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        let activityId = activity.rawValue.replacingOccurrences(of: "lms.", with: "")
        log("[Extension] intervalDidEnd: \(activityId)")
        
        if !isAnyScheduleActive() {
            log("[Extension] No more active schedules. Clearing all shields.")
            namedStore.clearAllSettings()
            defaultStore.clearAllSettings()
            
            // 글로벌 앱 삭제 방지 설정 복구
            let globalPrevent = sharedDefaults.bool(forKey: "preventAppRemovalSetting")
            if #available(iOS 16.0, *) {
                namedStore.application.denyAppRemoval = globalPrevent
                defaultStore.application.denyAppRemoval = globalPrevent
            }
            
            sharedDefaults.set(false, forKey: "isLocked")
            sharedDefaults.removeObject(forKey: "currentLockName")
        } else {
            log("[Extension] Other schedules still active. Keep lock.")
        }
    }
    
    // MARK: - Helper Methods
    
    private func applyFullLock(store: ManagedSettingsStore) {
        store.shield.applications = nil
        store.shield.applicationCategories = .all()
        store.shield.webDomains = nil
    }
    
    private func applyAppSelection(store: ManagedSettingsStore, policy: [String: Any], scheduleId: String) -> Bool {
        // 복호화 시도 (다양한 소스)
        var selectionData: Data? = policy["selection"] as? Data
        if selectionData == nil {
            selectionData = sharedDefaults.data(forKey: "selection_\(scheduleId)")
        }
        if selectionData == nil {
            selectionData = sharedDefaults.data(forKey: "SelectedApps_app")
        }
        
        guard let data = selectionData, let selection = decodeSelection(from: data) else { return false }
        
        if selection.applicationTokens.isEmpty && selection.categoryTokens.isEmpty { return false }
        
        store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
        store.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
        store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
        return true
    }
    
    private func decodeSelection(from data: Data) -> FamilyActivitySelection? {
        if let decoded = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) { return decoded }
        if let decoded = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) { return decoded }
        return nil
    }
    
    private func updateSharedState(isLocked: Bool, name: String, lockType: String) {
        sharedDefaults.set(isLocked, forKey: "isLocked")
        sharedDefaults.set(name, forKey: "currentLockName")
        sharedDefaults.set(lockType, forKey: "lockType")
        sharedDefaults.set("SCHEDULED", forKey: "lockSource")
        sharedDefaults.set(Date(), forKey: "lastExtensionTrigger") // 마지막 실행 시각 기록
    }
    
    private func log(_ message: String) {
        print(message)
        var logs = sharedDefaults.stringArray(forKey: "extensionLogs") ?? []
        let timestamp = ISO8601DateFormatter().string(from: Date())
        logs.append("[\(timestamp)] \(message)")
        if logs.count > 100 { logs.removeFirst() } // 최대 100줄 유지
        sharedDefaults.set(logs, forKey: "extensionLogs")
    }
    
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
}
