import XCTest
@testable import UnuVaultMacCompanion

final class L10nTests: XCTestCase {
    func testSimplifiedChineseStringsResolveForChinesePreferredLanguages() {
        XCTAssertEqual(
            L10n.string("app.subtitle", preferredLanguages: ["zh-CN"]),
            "本机保险库"
        )
        XCTAssertEqual(
            L10n.string("action.unlock_vault", preferredLanguages: ["zh-Hans"]),
            "解锁保险库"
        )
    }
}
