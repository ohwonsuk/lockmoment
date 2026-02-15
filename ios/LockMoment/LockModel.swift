import Foundation
import FamilyControls
import ManagedSettings
import SwiftUI

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
    var currentLockName: String = "바로 잠금"
    var startTime: Date? = nil
    
    // Store reference to keep it alive - using named store for extension sharing
    var store = ManagedSettingsStore(named: .lockMoment)
    
    private let appSelectionKey = "SelectedApps_app"
    private let phoneSelectionKey = "SelectedApps_phone"
    private let legacySelectionKey = "SelectedApps"
    
    // Shared defaults for App Group
    private let sharedDefaults = UserDefaults(suiteName: "group.com.lockmoment") ?? UserDefaults.standard
    
    private init() {
        // Load app selection from shared defaults
        if let data = sharedDefaults.data(forKey: appSelectionKey) ?? sharedDefaults.data(forKey: legacySelectionKey) {
            self.appSelection = (try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)) ?? FamilyActivitySelection()
        } else {
            self.appSelection = FamilyActivitySelection()
        }
        
        // Load phone selection
        if let data = sharedDefaults.data(forKey: phoneSelectionKey) {
            self.phoneSelection = (try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)) ?? FamilyActivitySelection()
        } else {
            self.phoneSelection = FamilyActivitySelection()
        }
        
        self.isLocked = sharedDefaults.bool(forKey: "isLocked")
        self.currentLockName = sharedDefaults.string(forKey: "currentLockName") ?? "바로 잠금"
        self.startTime = sharedDefaults.object(forKey: "lockStartTime") as? Date
        
        if let time = sharedDefaults.object(forKey: "lockEndTime") as? Date {
            self.endTime = time
            _ = checkExpiration()
        }
        
        // Initial sync of scheduled locks
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
        
        let allKeys = defaults.dictionaryRepresentation().keys
        for key in allKeys where key.hasPrefix("policy_") && key.hasSuffix("_\(weekday)") {
            if let policy = defaults.dictionary(forKey: key),
               let startH = policy["startHour"] as? Int,
               let startM = policy["startMinute"] as? Int,
               let endH = policy["endHour"] as? Int,
               let endM = policy["endMinute"] as? Int {
                
                if isTimeInRange(current: totalMinutes, start: startH * 60 + startM, end: endH * 60 + endM) {
                    if apply && !isLocked {
                        let type = policy["lockType"] as? String ?? "FULL"
                        let name = policy["name"] as? String ?? "예약 잠금"
                        let prevent = policy["preventAppRemoval"] as? Bool ?? true
                        startLock(duration: 0, lockType: type, name: name, preventRemoval: prevent)
                    }
                    return true
                }
            }
        }
        return false
    }
    
    func checkExpiration() -> Bool {
        // Sync state from shared storage (updated by Extension)
        let savedLocked = sharedDefaults.bool(forKey: "isLocked")
        if self.isLocked != savedLocked {
            self.isLocked = savedLocked
        }
        
        // 1. Manual/Timed Lock Expiration
        if isLocked, let time = endTime, time < Date() {
            stopLock(status: "완료")
            return true
        }
        
        // 2. Scheduled Lock Check (Start if needed)
        let inSchedule = checkScheduledLocks(apply: !isLocked)
        
        // 3. Auto-unlock if scheduled lock ended (safety cleanup)
        if isLocked && endTime == nil && !inSchedule {
            if currentLockName.contains("예약") {
                stopLock(status: "완료")
            }
        }
        
        return false
    }
    
    func saveSelection(type: String) {
        let key = type == "phone" ? phoneSelectionKey : appSelectionKey
        let sel = type == "phone" ? phoneSelection : appSelection
        if let encoded = try? JSONEncoder().encode(sel) {
            sharedDefaults.set(encoded, forKey: key)
        }
    }
    
    func startLock(duration: Double = 0, lockType: String = "FULL", name: String = "바로 잠금", preventRemoval: Bool = false) {
        // Normalize type
        let normalizedType = lockType.uppercased() == "APP" ? "APP" : "FULL"
        self.currentType = normalizedType
        self.currentLockName = name
        self.startTime = Date()
        
        sharedDefaults.set(name, forKey: "currentLockName")
        sharedDefaults.set(startTime, forKey: "lockStartTime")
        sharedDefaults.set(normalizedType, forKey: "lockType")
        
        let sel = normalizedType == "APP" ? appSelection : phoneSelection
        
        if normalizedType == "FULL" {
            // FULL Mode: Shield all applications but respect individual specific categories if selected
            // However, ManagedSettings doesn't have a simple "Shield Everything Except" mode.
            // The policy says: "허용 앱 외 전부 Shield = Full Lock"
            // So we use .all but allow specific tokens to be excluded if possible?
            // Actually, ShieldSettings.ActivityCategoryPolicy.all shields all.
            // For a true "Whitelist" we'd need to set all but then exclude? 
            // ManagedSettingsShield doesn't easily support "Shield All Except X".
            // Alternative: Add allCategories to shield and then we'd need a shield extension to allow through.
            // But for now, we follow the user's policy: "Shield all apps/categories"
            // store.shield.applications does not support .all. Rely on categories to block everything.
            store.shield.applications = nil 
            store.shield.applicationCategories = .all()
        } else {
            // APP Mode: Specific categories and apps from selection
            store.shield.applications = sel.applicationTokens
            store.shield.applicationCategories = ShieldSettings.ActivityCategoryPolicy.specific(sel.categoryTokens)
        }
        
        store.shield.webDomainCategories = ShieldSettings.ActivityCategoryPolicy.specific(sel.categoryTokens)
        
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
        store.shield.webDomainCategories = nil
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
