import Foundation
import FamilyControls
import ManagedSettings
import SwiftUI

// 메인 앱 타겟용 ManagedSettingsStore.Name 확장
// (Extension 타겟은 DeviceActivityMonitorExtension.swift에 동일하게 선언)
extension ManagedSettingsStore.Name {
    static let lockMoment = ManagedSettingsStore.Name("com.lockmoment.store")
}

class LockModel: ObservableObject {
    @Published var appSelection: FamilyActivitySelection {
        didSet {
            saveSelection(type: "app")
        }
    }
    
    @Published var phoneSelection: FamilyActivitySelection {
        didSet {
            saveSelection(type: "phone")
        }
    }
    
    // For backward compatibility or active use
    var selection: FamilyActivitySelection {
        get { return currentType == "phone" ? phoneSelection : appSelection }
        set {
            if currentType == "phone" { phoneSelection = newValue }
            else { appSelection = newValue }
        }
    }
    
    var currentType: String = "app"
    
    static let shared = LockModel()
    
    @Published var isLocked: Bool = false
    @Published var endTime: Date? = nil
    var scheduledEndTime: Date? = nil
    var lockSource: String = "MANUAL" // MANUAL or SCHEDULED
    var currentLockName: String = "바로 잠금"
    var startTime: Date? = nil
    
    // Store reference to keep it alive - using named store for extension sharing
    var store = ManagedSettingsStore(named: .lockMoment)
    
    private let appSelectionKey = "SelectedApps_app"
    private let phoneSelectionKey = "SelectedApps_phone"
    private let legacySelectionKey = "SelectedApps"
    private let lockSourceKey = "lockSource"
    
    // Shared defaults for App Group
    private var sharedDefaults: UserDefaults
    
    private init() {
        // Shared defaults for App Group
        let defaults = UserDefaults(suiteName: "group.com.lockmoment") ?? UserDefaults.standard
        self.sharedDefaults = defaults

        // 1. Decoder Fallback (Migration: JSON -> PropertyList)
        func decodeSelection(key: String, legacyKey: String? = nil) -> FamilyActivitySelection {
            if let data = defaults.data(forKey: key) ?? (legacyKey != nil ? defaults.data(forKey: legacyKey!) : nil) {
                // Try PropertyList first (Secure Tokens)
                if let decoded = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) {
                    return decoded
                }
                // Fallback to JSON (Old format)
                if let decoded = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) {
                    return decoded
                }
            }
            return FamilyActivitySelection()
        }

        self.appSelection = decodeSelection(key: appSelectionKey, legacyKey: legacySelectionKey)
        self.phoneSelection = decodeSelection(key: phoneSelectionKey)
        
        // 2. Load State
        self.isLocked = defaults.bool(forKey: "isLocked")
        self.lockSource = defaults.string(forKey: lockSourceKey) ?? "MANUAL"
        self.currentLockName = defaults.string(forKey: "currentLockName") ?? "바로 잠금"
        self.startTime = defaults.object(forKey: "lockStartTime") as? Date
        
        if let time = defaults.object(forKey: "lockEndTime") as? Date {
            self.endTime = time
            _ = checkExpiration()
        }
        
        // 3. Ensure Shield is actually applied if we are in locked state
        if self.isLocked {
            let type = defaults.string(forKey: "lockType") ?? "FULL"
            applyShieldSettings(lockType: type)
        }
        
        // 4. Initial sync of scheduled locks
        checkScheduledLocks()
    }
    
    @discardableResult
    func checkScheduledLocks(apply: Bool = true) -> Bool {
        let defaults = sharedDefaults
        let now = Date()
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: now)
        let hour = calendar.component(.hour, from: now)
        let minute = calendar.component(.minute, from: now)
        let totalMinutes = hour * 60 + minute
        
        func isTimeInRange(current: Int, start: Int, end: Int) -> Bool {
            if start <= end { return current >= start && current < end }
            else { return current >= start || current < end } // Overnight support
        }
        
        let yesterday = (weekday == 1) ? 7 : weekday - 1
        
        // Loop through policies for both today and yesterday
        let allKeys = defaults.dictionaryRepresentation().keys
        var foundMatch = false
        
        for checkWeekday in [yesterday, weekday] {
            let suffix = "_\(checkWeekday)"
            for key in allKeys where key.hasPrefix("policy_") && key.hasSuffix(suffix) {
                if let policy = defaults.dictionary(forKey: key),
                   let startH = policy["startHour"] as? Int,
                   let startM = policy["startMinute"] as? Int,
                   let endH = policy["endHour"] as? Int,
                   let endM = policy["endMinute"] as? Int {
                    
                    let startTotal = startH * 60 + startM
                    let endTotal = endH * 60 + endM
                    let isOvernight = startTotal > endTotal
                    
                    var inRange = false
                    
                    if checkWeekday == weekday {
                        if isOvernight {
                            inRange = totalMinutes >= startTotal
                        } else {
                            inRange = totalMinutes >= startTotal && totalMinutes < endTotal
                        }
                    } else if isOvernight {
                        inRange = totalMinutes < endTotal
                    }
                    
                    if inRange {
                        foundMatch = true
                        
                        // Calculate actual end date
                        let calendar = Calendar.current
                        var endComponents = calendar.dateComponents([.year, .month, .day], from: now)
                        endComponents.hour = endH
                        endComponents.minute = endM
                        endComponents.second = 0
                        
                        if let calculatedEnd = calendar.date(from: endComponents) {
                            var finalEnd = calculatedEnd
                            if isOvernight && checkWeekday == yesterday {
                                // Already in the "next day" part of overnight
                            } else if isOvernight && totalMinutes >= startTotal {
                                // In the "first day" part of overnight, end is tomorrow
                                finalEnd = calendar.date(byAdding: .day, value: 1, to: calculatedEnd) ?? calculatedEnd
                            }
                            self.scheduledEndTime = finalEnd
                        }

                        if apply {
                            applyLock(policy: policy)
                        }
                        return true 
                    }
                }
            }
        }
        self.scheduledEndTime = nil
        return foundMatch
    }

    private func applyLock(policy: [String: Any]) {
        let name = policy["name"] as? String ?? "예약 잠금"
        let type = policy["lockType"] as? String ?? "FULL"
        let prevent = policy["preventAppRemoval"] as? Bool ?? true
        
        // If already locked with the same name, we still might need to ensure shield settings are active
        // as they could have been cleared by an ending schedule or app restart
        if isLocked && currentLockName == name {
            // Verify if shield is actually applied (optional but safer)
            // For simplicity, we can just re-apply if we are in scheduled mode and heartbeat triggers
            if lockSource == "SCHEDULED" {
                 // re-applying settings to ensure persistence
                 applyShieldSettings(lockType: type)
            }
            return
        }
        
        startLock(duration: 0, lockType: type, name: name, preventRemoval: prevent)
        self.lockSource = "SCHEDULED"
    }
    
    private func applyShieldSettings(lockType: String) {
        let normalizedType = lockType.uppercased() == "APP" ? "APP" : "FULL"
        let sel = normalizedType == "APP" ? appSelection : phoneSelection
        
        if normalizedType == "FULL" {
            store.shield.applications = nil
            store.shield.applicationCategories = .all()
        } else {
            // APP 타입인데 선택된 앱/카테고리가 없으면 FULL로 fallback
            let hasSelection = !sel.applicationTokens.isEmpty || !sel.categoryTokens.isEmpty
            if !hasSelection {
                print("[LockModel] APP type but selection is empty. Falling back to FULL lock.")
                store.shield.applications = nil
                store.shield.applicationCategories = .all()
            } else {
                store.shield.applications = sel.applicationTokens.isEmpty ? nil : sel.applicationTokens
                store.shield.applicationCategories = sel.categoryTokens.isEmpty ? nil : .specific(sel.categoryTokens)
                store.shield.webDomains = sel.webDomainTokens.isEmpty ? nil : sel.webDomainTokens
            }
        }
    }
    
    func checkExpiration() -> Bool {
        // 1. Sync state from shared storage (updated by Extension)
        let savedLocked = sharedDefaults.bool(forKey: "isLocked")
        if self.isLocked != savedLocked {
            self.isLocked = savedLocked
            // If it was unlocked externally, reset our local state
            if !savedLocked {
                self.endTime = nil
                self.startTime = nil
            }
        }
        
        // 2. Manual/Timed Lock Expiration
        if isLocked, let time = endTime, time < Date() {
            stopLock(status: "완료")
            return true
        }
        
        // 3. Scheduled Lock Check (Heartbeat)
        // If it's a timed lock (endTime != nil), we don't interfere with schedules
        if endTime == nil {
            let inSchedule = checkScheduledLocks(apply: !isLocked)
            
            // Auto-unlock if scheduled lock ended.
            // ONLY if this was a scheduled lock to begin with.
            if isLocked && lockSource == "SCHEDULED" && !inSchedule {
                stopLock(status: "완료")
                return true
            }
        }
        
        return false
    }
    
    func saveSelection(type: String) {
        let key = type == "phone" ? phoneSelectionKey : appSelectionKey
        let sel = type == "phone" ? phoneSelection : appSelection
        
        // Unified to use PropertyListEncoder for SecureToken compatibility
        if let encoded = try? PropertyListEncoder().encode(sel) {
            sharedDefaults.set(encoded, forKey: key)
        }
        
        // Only update combined counts for 'app' selection type (used for remote management range)
        if type == "app" {
            let appCount = sel.applicationTokens.count
            let categoryCount = sel.categoryTokens.count
            let hasSelection = (appCount + categoryCount) > 0
            
            sharedDefaults.set(hasSelection, forKey: "hasSelection")
            sharedDefaults.set(appCount, forKey: "selectedAppCount")
            sharedDefaults.set(categoryCount, forKey: "selectedCategoryCount")
        }
    }
    
    func startLock(duration: Double = 0, lockType: String = "FULL", name: String = "바로 잠금", preventRemoval: Bool = false) {
        self.lockSource = "MANUAL" // Default to Manual, can be overridden by applyLock
        // Normalize type
        let normalizedType = lockType.uppercased() == "APP" ? "APP" : "FULL"
        self.currentType = normalizedType
        self.currentLockName = name
        self.startTime = Date()
        
        sharedDefaults.set(name, forKey: "currentLockName")
        sharedDefaults.set(startTime, forKey: "lockStartTime")
        sharedDefaults.set(normalizedType, forKey: "lockType")
        sharedDefaults.set(self.lockSource, forKey: lockSourceKey)
        
        applyShieldSettings(lockType: normalizedType)
        
        // Apply app removal prevention whenever locked
        if #available(iOS 16.0, *) {
            store.application.denyAppRemoval = true
        }
        
        isLocked = true
        sharedDefaults.set(true, forKey: "isLocked")
        
        if duration > 0 {
            let end = Date().addingTimeInterval(duration / 1000) // duration is in ms from JS
            self.endTime = end
            sharedDefaults.set(end, forKey: "lockEndTime")
        } else {
            self.endTime = nil
            sharedDefaults.removeObject(forKey: "lockEndTime")
        }
    }
    
    func stopLock(status: String = "완료") {
        if isLocked {
            addHistoryEntry(name: currentLockName, start: startTime ?? Date(), end: Date(), status: status)
        }
        
        store.shield.applications = nil
        store.shield.applicationCategories = nil
        store.shield.webDomains = nil
        store.clearAllSettings()
        
        // Restore persistent "prevent app removal" setting if it was on
        if #available(iOS 16.0, *) {
            let pref = UserDefaults.standard.bool(forKey: "preventAppRemovalSetting")
            store.application.denyAppRemoval = pref
        }
        
        isLocked = false
        endTime = nil
        startTime = nil
        sharedDefaults.set(false, forKey: "isLocked")
        sharedDefaults.removeObject(forKey: "lockEndTime")
        sharedDefaults.removeObject(forKey: "lockStartTime")
        sharedDefaults.removeObject(forKey: "currentLockName")
    }

    func addHistoryEntry(name: String, start: Date, end: Date, status: String) {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy.MM.dd"
        let dateStr = fmt.string(from: start)
        
        let durationSec = Int(end.timeIntervalSince(start))
        let h = durationSec / 3600
        let m = (durationSec % 3600) / 60
        let s = durationSec % 60
        
        var durationStr = ""
        if h > 0 { durationStr = "\(h)시간 \(m)분" }
        else if m > 0 { durationStr = "\(m)분 \(s)초" }
        else { durationStr = "\(s)초" }
        
        let entry: [String: Any] = [
            "id": UUID().uuidString,
            "date": dateStr,
            "name": name,
            "duration": durationStr,
            "status": status,
            "timestamp": start.timeIntervalSince1970 * 1000
        ]
        
        var history = UserDefaults.standard.array(forKey: "lockHistory") as? [[String: Any]] ?? []
        history.insert(entry, at: 0)
        if history.count > 50 {
            history = Array(history.prefix(50))
        }
        UserDefaults.standard.set(history, forKey: "lockHistory")
    }

    func getHistoryJson() -> String {
        let history = UserDefaults.standard.array(forKey: "lockHistory") as? [[String: Any]] ?? []
        if let data = try? JSONSerialization.data(withJSONObject: history, options: []),
           let json = String(data: data, encoding: .utf8) {
            return json
        }
        return "[]"
    }
}
