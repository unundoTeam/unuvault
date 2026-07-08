import AppKit
import Foundation
import UniformTypeIdentifiers

@MainActor
protocol CompanionBackupFilePicking {
    func exportBackupURL() -> URL?
    func restoreBackupURL() -> URL?
}

@MainActor
final class MacCompanionBackupFilePicker: CompanionBackupFilePicking {
    func exportBackupURL() -> URL? {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.canCreateDirectories = true
        panel.isExtensionHidden = false
        panel.nameFieldStringValue = "unuvault-local-backup.json"
        panel.title = L10n.string("action.export_backup")

        return panel.runModal() == .OK ? panel.url : nil
    }

    func restoreBackupURL() -> URL? {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.title = L10n.string("action.restore_backup")

        return panel.runModal() == .OK ? panel.url : nil
    }
}
