import Foundation
import FamilyControls
import ManagedSettings
import SwiftUI

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
    
    // Store reference to keep it alive
    var store = ManagedSettingsStore()
    
    private let appSelectionKey = "SelectedApps_app"
    private let phoneSelectionKey = "SelectedApps_phone"
    private let legacySelectionKey = "SelectedApps"
    
    private init() {
        // Load app selection
        if let data = UserDefaults.standard.data(forKey: appSelectionKey) ?? UserDefaults.standard.data(forKey: legacySelectionKey) {
            self.appSelection = (try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)) ?? FamilyActivitySelection()
        } else {
            self.appSelection = FamilyActivitySelection()
        }
        
        // Load phone selection
        if let data = UserDefaults.standard.data(forKey: phoneSelectionKey) {
            self.phoneSelection = (try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)) ?? FamilyActivitySelection()
        } else {
            self.phoneSelection = FamilyActivitySelection()
        }
        
        self.isLocked = UserDefaults.standard.bool(forKey: "isLocked")
        self.currentLockName = UserDefaults.standard.string(forKey: "currentLockName") ?? "바로 잠금"
        self.startTime = UserDefaults.standard.object(forKey: "lockStartTime") as? Date
        
        if let time = UserDefaults.standard.object(forKey: "lockEndTime") as? Date {
            self.endTime = time
            _ = checkExpiration()
        }
    }
    
    func checkExpiration() -> Bool {
        if isLocked, let time = endTime, time < Date() {
            stopLock(status: "완료")
            return true
        }
        return false
    }
    
    func saveSelection(type: String) {
        let key = type == "phone" ? phoneSelectionKey : appSelectionKey
        let sel = type == "phone" ? phoneSelection : appSelection
        if let encoded = try? JSONEncoder().encode(sel) {
            UserDefaults.standard.set(encoded, forKey: key)
        }
    }
    
    func startLock(duration: Double = 0, lockType: String = "FULL", name: String = "바로 잠금", preventRemoval: Bool = false) {
        // Normalize type
        let normalizedType = lockType.uppercased() == "APP" ? "APP" : "FULL"
        self.currentType = normalizedType
        self.currentLockName = name
        self.startTime = Date()
        
        UserDefaults.standard.set(name, forKey: "currentLockName")
        UserDefaults.standard.set(startTime, forKey: "lockStartTime")
        UserDefaults.standard.set(normalizedType, forKey: "lockType")
        
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
            store.shield.applications = .all
            store.shield.applicationCategories = .all
        } else {
            // APP Mode: Specific categories and apps from selection
            store.shield.applications = sel.applicationTokens
            store.shield.applicationCategories = ShieldSettings.ActivityCategoryPolicy.specific(sel.categoryTokens)
        }
        
        store.shield.webDomainCategories = ShieldSettings.ActivityCategoryPolicy.specific(sel.categoryTokens)
        
        // Apply app removal prevention if requested
        if #available(iOS 16.0, *) {
            store.application.denyAppRemoval = preventRemoval
        }
        
        isLocked = true
        UserDefaults.standard.set(true, forKey: "isLocked")
        
        if duration > 0 {
            let end = Date().addingTimeInterval(duration / 1000) // duration is in ms from JS
            self.endTime = end
            UserDefaults.standard.set(end, forKey: "lockEndTime")
        } else {
            self.endTime = nil
            UserDefaults.standard.removeObject(forKey: "lockEndTime")
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
        
        isLocked = false
        endTime = nil
        startTime = nil
        UserDefaults.standard.set(false, forKey: "isLocked")
        UserDefaults.standard.removeObject(forKey: "lockEndTime")
        UserDefaults.standard.removeObject(forKey: "lockStartTime")
        UserDefaults.standard.removeObject(forKey: "currentLockName")
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
