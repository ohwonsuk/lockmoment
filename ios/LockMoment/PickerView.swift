import SwiftUI
import FamilyControls

@available(iOS 15.0, *)
struct PickerView: View {
    @StateObject var model = LockModel.shared
    @State private var isPickerPresented = false
    var onDismiss: () -> Void
    
    var body: some View {
        VStack {
            Text("Opening Picker...")
                .onAppear {
                    // Small delay to ensure view is mounted before presenting picker
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        isPickerPresented = true
                    }
                }
        }
        .familyActivityPicker(isPresented: $isPickerPresented, selection: $model.selection)
        .onChange(of: isPickerPresented) { isPresented in
            if !isPresented {
                onDismiss()
            }
        }
    }
}
