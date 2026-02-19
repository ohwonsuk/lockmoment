import SwiftUI
import FamilyControls

@available(iOS 15.0, *)
struct PickerView: View {
    @State private var selection: FamilyActivitySelection
    @State private var isPickerPresented = false
    
    let onDismiss: (FamilyActivitySelection) -> Void
    
    init(initialSelection: FamilyActivitySelection, onDismiss: @escaping (FamilyActivitySelection) -> Void) {
        self._selection = State(initialValue: initialSelection)
        self.onDismiss = onDismiss
    }
    
    var body: some View {
        Color.clear
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    isPickerPresented = true
                }
            }
            .familyActivityPicker(isPresented: $isPickerPresented, selection: $selection)
            .onChange(of: isPickerPresented) { isPresented in
                if !isPresented {
                    onDismiss(selection)
                }
            }
    }
}
