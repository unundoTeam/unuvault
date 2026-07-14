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

    static func loadReceivedVault(
        from configuration: PairingReceivedVaultStoreConfiguration = .appDefault()
    ) throws -> VaultListModel {
        VaultListModel(importStore: try configuration.makeImportStore())
    }
}

struct VaultListView: View {
    enum Copy {
        static let title = "Vault"
        static let readOnlyContext =
            "Local items received from your Mac. Sensitive values stay hidden until a future action is approved."
        static let importedItems = "Imported items"
        static let emptyTitle = "No imported vault items yet"
        static let emptyBody = "Pair with your Mac to receive local vault metadata."
    }

    let model: VaultListModel

    init(model: VaultListModel) {
        self.model = model
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text(Copy.title)
                        .font(.largeTitle.bold())
                    Text(Copy.readOnlyContext)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }
                .listRowBackground(Color.clear)
            }

            Section(Copy.importedItems) {
                if model.items.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(Copy.emptyTitle)
                            .font(.headline)
                        Text(Copy.emptyBody)
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
