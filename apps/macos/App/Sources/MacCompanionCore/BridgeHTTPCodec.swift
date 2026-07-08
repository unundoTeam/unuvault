import Foundation

public struct BridgeHTTPResponse: Equatable {
    public let statusCode: Int
    public let headers: [String: String]
    public let body: Data

    public var bodyString: String {
        String(data: body, encoding: .utf8) ?? ""
    }
}

public final class BridgeHTTPCodec: @unchecked Sendable {
    private let service: CompanionBridgeService
    private let accessToken: String
    private let localVaultImporter: CompanionLocalVaultImporter?
    private let pairingCoordinator: CompanionPairingSessionCoordinator?

    public init(
        service: CompanionBridgeService,
        accessToken: String,
        localVaultImporter: CompanionLocalVaultImporter? = nil,
        pairingCoordinator: CompanionPairingSessionCoordinator? = nil,
        pairingTransferKeyData _: Data? = nil
    ) {
        self.service = service
        self.accessToken = accessToken
        self.localVaultImporter = localVaultImporter
        self.pairingCoordinator = pairingCoordinator
    }

    public func handle(
        method: String,
        path: String,
        headers: [String: String],
        body: Data
    ) -> BridgeHTTPResponse {
        let normalizedMethod = method.uppercased()
        let normalizedHeaders = normalized(headers)

        if normalizedMethod == "OPTIONS" {
            return json(statusCode: 204, payload: [:])
        }

        if normalizedMethod == "GET", path == "/status" {
            return statusResponse()
        }

        guard let components = URLComponents(
            string: "http://127.0.0.1\(path)"
        ) else {
            return invalidRequest()
        }

        if normalizedMethod == "POST", components.path == "/v1/pairing/claim" {
            return pairingClaimResponse(body: body)
        }

        guard normalizedHeaders["authorization"] == "Bearer \(accessToken)" else {
            return json(
                statusCode: 401,
                payload: ["ok": false, "error": "invalid_bridge_token"]
            )
        }

        switch (normalizedMethod, components.path) {
        case ("GET", "/v1/credentials"):
            return metadataResponse(queryItems: components.queryItems ?? [])
        case ("POST", "/v1/local-vault/import"):
            return localVaultImportResponse(body: body)
        case ("POST", "/v1/credentials/release"):
            return releaseResponse(body: body)
        case ("POST", "/v1/credentials/claim"):
            return claimResponse(body: body)
        default:
            return json(
                statusCode: 404,
                payload: ["ok": false, "error": "not_found"]
            )
        }
    }

    private func localVaultImportResponse(body: Data) -> BridgeHTTPResponse {
        guard let localVaultImporter,
              let request = decode(LocalVaultImportRequest.self, from: body)
        else {
            return invalidRequest()
        }

        switch localVaultImporter.importUnlockedWebAccountCredentials(
            source: request.source,
            credentials: request.credentials
        ) {
        case .imported(let receipt):
            return jsonEncodable(
                statusCode: 200,
                payload: LocalVaultImportResponse(
                    ok: true,
                    source: receipt.source,
                    importedCredentialIds: receipt.importedCredentialIds,
                    credentialCount: receipt.credentialCount
                )
            )
        case .invalidRequest:
            return invalidRequest()
        case .locked:
            return json(
                statusCode: 423,
                payload: ["ok": false, "error": "vault_locked"]
            )
        case .saveFailed:
            return json(
                statusCode: 500,
                payload: ["ok": false, "error": "local_vault_import_failed"]
            )
        }
    }

    private func pairingClaimResponse(body: Data) -> BridgeHTTPResponse {
        guard let pairingCoordinator,
              let request = decode(PairingClaimRequest.self, from: body),
              !request.sessionId.isEmpty,
              !request.sessionNonce.isEmpty,
              !request.target.deviceId.isEmpty,
              !request.target.displayName.isEmpty,
              !request.target.publicKeyFingerprint.isEmpty,
              !request.target.publicKeyAgreementDERBase64URL.isEmpty
        else {
            return pairingSessionErrorResponse(.invalidRequest)
        }

        let target = CompanionPairingTarget(
            deviceId: request.target.deviceId,
            displayName: request.target.displayName,
            publicKeyFingerprint: request.target.publicKeyFingerprint,
            publicKeyAgreementDERBase64URL: request.target.publicKeyAgreementDERBase64URL
        )
        guard target.isValidKeyAgreementPublicKey else {
            return pairingSessionErrorResponse(.invalidRequest)
        }

        do {
            let handoff = try pairingCoordinator.completeSession(
                sessionId: request.sessionId,
                sessionNonce: request.sessionNonce,
                target: target
            )

            return jsonEncodable(
                statusCode: 200,
                payload: PairingClaimResponse(handoff: handoff)
            )
        } catch let error as CompanionPairingSessionError {
            return pairingSessionErrorResponse(error)
        } catch {
            return json(
                statusCode: 500,
                payload: ["ok": false, "error": "pairing_exchange_failed"]
            )
        }
    }

    private func pairingSessionErrorResponse(
        _ error: CompanionPairingSessionError
    ) -> BridgeHTTPResponse {
        switch error {
        case .expired:
            return json(
                statusCode: 410,
                payload: ["ok": false, "error": "pairing_session_expired"]
            )
        case .invalidRequest:
            return json(
                statusCode: 400,
                payload: ["ok": false, "error": "invalid_pairing_claim"]
            )
        case .locked:
            return json(
                statusCode: 423,
                payload: ["ok": false, "error": "vault_locked"]
            )
        case .replayed:
            return json(
                statusCode: 409,
                payload: ["ok": false, "error": "pairing_session_replayed"]
            )
        }
    }

    private func statusResponse() -> BridgeHTTPResponse {
        let state: String

        switch service.metadata(origin: "https://example.invalid", profileId: "status-check") {
        case .locked:
            state = "locked"
        case .credentials:
            state = "unlocked"
        }

        return json(statusCode: 200, payload: ["ok": true, "state": state])
    }

    private func metadataResponse(queryItems: [URLQueryItem]) -> BridgeHTTPResponse {
        guard let origin = queryItems.value(named: "origin"),
              let profileId = queryItems.value(named: "profileId"),
              !origin.isEmpty,
              !profileId.isEmpty
        else {
            return invalidRequest()
        }

        switch service.metadata(origin: origin, profileId: profileId) {
        case .locked:
            return json(
                statusCode: 423,
                payload: ["ok": false, "error": "vault_locked"]
            )
        case .credentials(let credentials):
            return json(
                statusCode: 200,
                payload: [
                    "credentials": credentials.map { credential in
                        [
                            "id": credential.id,
                            "label": credential.label,
                            "username": credential.username
                        ]
                    }
                ]
            )
        }
    }

    private func releaseResponse(body: Data) -> BridgeHTTPResponse {
        guard let request = decode(ReleaseRequest.self, from: body),
              !request.id.isEmpty,
              !request.origin.isEmpty,
              !request.profileId.isEmpty,
              !request.reason.isEmpty
        else {
            return invalidRequest()
        }

        return releaseResultResponse(
            service.requestRelease(
                id: request.id,
                origin: request.origin,
                profileId: request.profileId,
                reason: request.reason
            )
        )
    }

    private func claimResponse(body: Data) -> BridgeHTTPResponse {
        guard let request = decode(ClaimRequest.self, from: body),
              !request.id.isEmpty,
              !request.origin.isEmpty,
              !request.profileId.isEmpty
        else {
            return invalidRequest()
        }

        return releaseResultResponse(
            service.consumeApprovedRelease(
                id: request.id,
                origin: request.origin,
                profileId: request.profileId
            )
        )
    }

    private func releaseResultResponse(_ result: CompanionReleaseResult) -> BridgeHTTPResponse {
        switch result {
        case .locked:
            return json(
                statusCode: 423,
                payload: ["ok": false, "error": "vault_locked"]
            )
        case .invalidRequest:
            return invalidRequest()
        case .notFound:
            return json(
                statusCode: 404,
                payload: ["ok": false, "error": "credential_not_found"]
            )
        case .approvalRequired(let approval):
            return json(
                statusCode: 409,
                payload: [
                    "ok": false,
                    "error": "approval_required",
                    "approval": [
                        "id": approval.id,
                        "origin": approval.origin,
                        "profileId": approval.profileId,
                        "label": approval.label,
                        "username": approval.username
                    ]
                ]
            )
        case .released(let credential):
            return json(
                statusCode: 200,
                payload: [
                    "credential": [
                        "username": credential.username,
                        "password": credential.password
                    ]
                ]
            )
        case .denied:
            return json(statusCode: 409, payload: ["ok": false, "error": "denied"])
        }
    }

    private func invalidRequest() -> BridgeHTTPResponse {
        json(statusCode: 400, payload: ["ok": false, "error": "invalid_bridge_request"])
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) -> T? {
        try? JSONDecoder().decode(type, from: data)
    }

    private func json(statusCode: Int, payload: [String: Any]) -> BridgeHTTPResponse {
        let data = (
            try? JSONSerialization.data(
                withJSONObject: payload,
                options: [.sortedKeys]
            )
        ) ?? Data("{}".utf8)

        return BridgeHTTPResponse(
            statusCode: statusCode,
            headers: [
                "access-control-allow-headers": "authorization, content-type",
                "access-control-allow-methods": "GET, POST, OPTIONS",
                "access-control-allow-origin": "http://127.0.0.1:3001",
                "content-type": "application/json"
            ],
            body: data
        )
    }

    private func jsonEncodable<T: Encodable>(
        statusCode: Int,
        payload: T
    ) -> BridgeHTTPResponse {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = (try? encoder.encode(payload)) ?? Data("{}".utf8)

        return BridgeHTTPResponse(
            statusCode: statusCode,
            headers: [
                "access-control-allow-headers": "authorization, content-type",
                "access-control-allow-methods": "GET, POST, OPTIONS",
                "access-control-allow-origin": "http://127.0.0.1:3001",
                "content-type": "application/json"
            ],
            body: data
        )
    }

    private func normalized(_ headers: [String: String]) -> [String: String] {
        var result: [String: String] = [:]

        for (key, value) in headers {
            result[key.lowercased()] = value
        }

        return result
    }
}

private struct ReleaseRequest: Decodable {
    let id: String
    let origin: String
    let profileId: String
    let reason: String
}

private struct ClaimRequest: Decodable {
    let id: String
    let origin: String
    let profileId: String
}

private struct LocalVaultImportRequest: Decodable {
    let source: String
    let credentials: [CompanionWebAccountVaultImportCredential]
}

private struct LocalVaultImportResponse: Encodable {
    let ok: Bool
    let source: String
    let importedCredentialIds: [String]
    let credentialCount: Int
}

private struct PairingClaimRequest: Decodable {
    let sessionId: String
    let sessionNonce: String
    let target: PairingClaimTarget
}

private struct PairingClaimTarget: Decodable {
    let deviceId: String
    let displayName: String
    let publicKeyFingerprint: String
    let publicKeyAgreementDERBase64URL: String
}

private struct PairingClaimResponse: Encodable {
    let handoff: CompanionPairingHandoff
}

private extension [URLQueryItem] {
    func value(named name: String) -> String? {
        first { item in
            item.name == name
        }?.value
    }
}
