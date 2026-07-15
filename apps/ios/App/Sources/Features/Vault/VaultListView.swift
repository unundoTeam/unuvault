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
            "Read-only metadata received from your Mac. Passwords and secret values are never shown here."
        static let importedItems = "Imported items"
        static let emptyTitle = "No vault received yet"
        static let emptyBody =
            "Open Pairing to import read-only metadata from a trusted Mac."
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
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .listRowBackground(Color.clear)
            }

            Section(Copy.importedItems) {
                if model.items.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(Copy.emptyTitle)
                            .font(.headline)
                            .lineLimit(nil)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(Copy.emptyBody)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(nil)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                } else {
                    ForEach(model.items) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.label)
                                .font(.headline)
                                .lineLimit(nil)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(item.username)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(nil)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(item.websiteOrigin)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(nil)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}
