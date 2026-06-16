import Foundation

enum L10n {
    static func string(_ key: String) -> String {
        string(key, preferredLanguages: Locale.preferredLanguages)
    }

    static func string(_ key: String, preferredLanguages: [String]) -> String {
        localizedBundle(preferredLanguages: preferredLanguages)
            .localizedString(forKey: key, value: nil, table: nil)
    }

    static func format(_ key: String, _ arguments: CVarArg...) -> String {
        String(format: string(key), locale: Locale.current, arguments: arguments)
    }

    private static func localizedBundle(preferredLanguages: [String]) -> Bundle {
        if prefersSimplifiedChinese(preferredLanguages),
           let bundle = localizedBundle(named: "zh-Hans") ?? localizedBundle(named: "zh-hans") {
            return bundle
        }

        return .module
    }

    private static func prefersSimplifiedChinese(_ languages: [String]) -> Bool {
        languages.contains { language in
            let normalized = language.lowercased()
            return normalized == "zh" ||
                normalized.hasPrefix("zh-hans") ||
                normalized.hasPrefix("zh-cn") ||
                normalized.hasPrefix("zh-sg")
        }
    }

    private static func localizedBundle(named name: String) -> Bundle? {
        guard let path = Bundle.module.path(forResource: name, ofType: "lproj") else {
            return nil
        }

        return Bundle(path: path)
    }
}
