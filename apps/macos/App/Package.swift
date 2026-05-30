// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "UnuVaultMacCompanion",
    defaultLocalization: "en",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(name: "MacCompanionCore", targets: ["MacCompanionCore"]),
        .executable(name: "UnuVaultMacCompanion", targets: ["UnuVaultMacCompanion"]),
        .executable(
            name: "MacCompanionSmokeHost",
            targets: ["MacCompanionSmokeHost"]
        ),
        .executable(
            name: "MacPairingReceiptHost",
            targets: ["MacPairingReceiptHost"]
        )
    ],
    targets: [
        .target(
            name: "MacCompanionCore",
            path: "Sources/MacCompanionCore"
        ),
        .executableTarget(
            name: "UnuVaultMacCompanion",
            dependencies: ["MacCompanionCore"],
            path: "Sources/UnuVaultMacCompanion",
            resources: [
                .process("Resources")
            ]
        ),
        .executableTarget(
            name: "MacCompanionSmokeHost",
            dependencies: ["MacCompanionCore"],
            path: "Sources/MacCompanionSmokeHost"
        ),
        .executableTarget(
            name: "MacPairingReceiptHost",
            dependencies: ["MacCompanionCore"],
            path: "Sources/MacPairingReceiptHost"
        ),
        .testTarget(
            name: "MacCompanionCoreTests",
            dependencies: ["MacCompanionCore", "UnuVaultMacCompanion"],
            path: "Tests/MacCompanionCoreTests"
        )
    ]
)
