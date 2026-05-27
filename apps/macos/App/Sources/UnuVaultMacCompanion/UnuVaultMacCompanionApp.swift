import SwiftUI

@main
struct UnuVaultMacCompanionApp: App {
    @StateObject private var viewModel = CompanionViewModel()

    var body: some Scene {
        MenuBarExtra(L10n.string("app.title"), systemImage: "lock.shield") {
            CompanionMenuView(viewModel: viewModel)
                .onAppear {
                    viewModel.start()
                }
        }
        .menuBarExtraStyle(.window)
    }
}
