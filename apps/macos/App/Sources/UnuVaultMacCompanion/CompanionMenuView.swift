import SwiftUI

struct CompanionMenuView: View {
    @ObservedObject var viewModel: CompanionViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("UnuVault")
                    .font(.headline)
                Spacer()
                Text(viewModel.statusText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            SecureField("Master password", text: $viewModel.masterPassword)

            HStack {
                Button("Unlock local vault") {
                    viewModel.unlockForDemo()
                }
                Button("Lock") {
                    viewModel.lock()
                }
            }

            Divider()

            if let approval = viewModel.pendingApproval {
                Text("Allow password fill?")
                    .font(.headline)
                Text("\(approval.origin) requests \(approval.label)")
                    .font(.caption)
                HStack {
                    Button("Deny") {
                        viewModel.denyPendingFill()
                    }
                    Button("Fill once") {
                        viewModel.approvePendingFill()
                    }
                    .keyboardShortcut(.defaultAction)
                }
            } else {
                Text(viewModel.lastDecisionText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Divider()

            Text("Lost-device recovery requires a trusted Mac, user-held recovery key, or encrypted backup. No server-side plaintext recovery.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(width: 340)
    }
}
