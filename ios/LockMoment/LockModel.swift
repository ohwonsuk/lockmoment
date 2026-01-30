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
        if let time = UserDefaults.standard.object(forKey: "lockEndTime") as? Date {
            self.endTime = time
            _ = checkExpiration()
        }
    }
    
    func checkExpiration() -> Bool {
        if let time = endTime, time < Date() {
            stopLock()
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
    
    func startLock(duration: Double = 0, type: String = "app", preventRemoval: Bool = false) {
        self.currentType = type
        let sel = type == "phone" ? phoneSelection : appSelection
        
        // Apply shielding to the selected applications and categories
        store.shield.applications = sel.applicationTokens
        store.shield.applicationCategories = ShieldSettings.ActivityCategoryPolicy.specific(sel.categoryTokens)
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
    
    func stopLock() {
        store.shield.applications = nil
        store.shield.applicationCategories = nil
        store.shield.webDomainCategories = nil
        store.clearAllSettings()
        
        isLocked = false
        endTime = nil
        UserDefaults.standard.set(false, forKey: "isLocked")
        UserDefaults.standard.removeObject(forKey: "lockEndTime")
    }
}
