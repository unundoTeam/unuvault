import SwiftUI

struct VaultListItem: Equatable, Identifiable, Codable, Sendable {
    let id: String
    let label: String
    let username: String
    let websiteOrigin: String
}

struct VaultListModel: Equatable, Sendable {
    let items: [VaultListItem]

    init(items: [VaultListItem] = []) {
        self.items = items
    }

    init(importStore: PairingHandoffImportStore) {
        self.init(
            items: importStore.importedCredentialMetadata().map {
                VaultListItem(
                    id: $0.id,
                    label: $0.label,
                    username: $0.username,
                    websiteOrigin: $0.websiteOrigin
                )
            }
        )
    }
}

struct VaultListView: View {
    let model: VaultListModel

    init(model: VaultListModel = VaultListModel()) {
        self.model = model
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Vault")
                        .font(.largeTitle.bold())
                    Text(
                        "Local items received from your Mac. Sensitive values stay hidden until a future action is approved."
                    )
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }
                .listRowBackground(Color.clear)
            }

            Section("Imported items") {
                if model.items.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("No imported vault items yet")
                            .font(.headline)
                        Text("Pair with your Mac to receive local vault metadata.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    ForEach(model.items) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.label)
                                .font(.headline)
                            Text(item.username)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Text(item.websiteOrigin)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}
