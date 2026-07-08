import AppKit
import Foundation

@MainActor
protocol CompanionClipboardWriting: AnyObject {
    func write(_ string: String, clearAfter: TimeInterval?)
}

@MainActor
final class MacPasteboardClipboardWriter: CompanionClipboardWriting {
    private var clearToken: UUID?

    func write(_ string: String, clearAfter: TimeInterval?) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(string, forType: .string)

        guard let clearAfter else {
            clearToken = nil
            return
        }

        let token = UUID()
        clearToken = token

        Task { @MainActor [weak self] in
            let nanoseconds = UInt64(max(clearAfter, 0) * 1_000_000_000)
            try? await Task.sleep(nanoseconds: nanoseconds)

            guard self?.clearToken == token,
                  NSPasteboard.general.string(forType: .string) == string
            else {
                return
            }

            NSPasteboard.general.clearContents()
            self?.clearToken = nil
        }
    }
}
