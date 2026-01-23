import SwiftUI
import FamilyControls

@available(iOS 15.0, *)
struct PickerView: View {
    @StateObject var model = LockModel.shared
    @Binding var isPresented: Bool
    
    var body: some View {
        NavigationView {
            VStack {
                Text("Select Apps to Block")
                    .font(.headline)
                    .padding()
                
                Text("Selected: \(model.selection.applicationTokens.count) apps")
                    .foregroundColor(.secondary)
                
                Button("Done") {
                    isPresented = false
                }
                .padding()
            }
            .familyActivityPicker(isPresented: $isPresented, selection: $model.selection)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        isPresented = false
                    }
                }
            }
        }
    }
}
