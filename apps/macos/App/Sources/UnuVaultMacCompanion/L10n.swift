import Foundation

enum L10n {
    private static let bundle: Bundle = {
        let prefersSimplifiedChinese = Locale.preferredLanguages.contains { language in
            let normalized = language.lowercased()
            return normalized == "zh" ||
                normalized.hasPrefix("zh-hans") ||
                normalized.hasPrefix("zh-cn")
        }

        if prefersSimplifiedChinese,
           let bundle = localizedBundle(named: "zh-Hans") ?? localizedBundle(named: "zh-hans") {
            return bundle
        }

        return .module
    }()

    static func string(_ key: String) -> String {
        bundle.localizedString(forKey: key, value: nil, table: nil)
    }

    static func format(_ key: String, _ arguments: CVarArg...) -> String {
        String(format: string(key), locale: Locale.current, arguments: arguments)
    }

    private static func localizedBundle(named name: String) -> Bundle? {
        guard let path = Bundle.module.path(forResource: name, ofType: "lproj") else {
            return nil
        }

        return Bundle(path: path)
    }
}
