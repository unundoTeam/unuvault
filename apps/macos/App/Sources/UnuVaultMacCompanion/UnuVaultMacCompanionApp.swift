import MacCompanionCore
import SwiftUI

@main
struct UnuVaultMacCompanionApp: App {
    var body: some Scene {
        MenuBarExtra("UnuVault", systemImage: "lock.shield") {
            Text("UnuVault Mac Companion")
            Text("Locked")
        }
    }
}
