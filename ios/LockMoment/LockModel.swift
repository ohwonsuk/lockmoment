import Foundation
import FamilyControls
import ManagedSettings
import SwiftUI

class LockModel: ObservableObject {
    @Published var selection = FamilyActivitySelection()
    
    static let shared = LockModel()
    
    // Store reference to keep it alive
    var store = ManagedSettingsStore()
    
    private init() {}
    
    func saveSelection() {
        // Here we can save to UserDefaults if persistent across launches is needed
        // For MVP, we just keep it in memory
        
        // Example: Apply shield immediately if desired, or wait for startLock
    }
    
    func startLock() {
        // Apply shielding to the selected applications and categories
        store.shield.applications = selection.applicationTokens
        store.shield.applicationCategories = ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
        store.shield.webDomainCategories = ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
    }
    
    func stopLock() {
        store.clearAllSettings()
    }
}
