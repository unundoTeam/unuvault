import SwiftUI

struct VaultListItem: Equatable, Identifiable, Codable, Sendable {
    let id: String
    let label: String
    let username: String
    let websiteOrigin: String
}

struct VaultListModel: Equatable, Sendable {
    let items: [VaultListItem]

    init(importStore: PairingHandoffImportStore) {
        items = importStore.importedCredentialMetadata().map {
            VaultListItem(
                id: $0.id,
                label: $0.label,
                username: $0.username,
                websiteOrigin: $0.websiteOrigin
            )
        }
    }
}

struct VaultListView: View {
    var body: some View {
        List {
            Text("unuvault vault items will appear here.")
        }
    }
}
