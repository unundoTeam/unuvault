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

    public init(service: CompanionBridgeService, accessToken: String) {
        self.service = service
        self.accessToken = accessToken
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

        guard normalizedHeaders["authorization"] == "Bearer \(accessToken)" else {
            return json(
                statusCode: 401,
                payload: ["ok": false, "error": "invalid_bridge_token"]
            )
        }

        guard let components = URLComponents(
            string: "http://127.0.0.1\(path)"
        ) else {
            return invalidRequest()
        }

        switch (normalizedMethod, components.path) {
        case ("GET", "/v1/credentials"):
            return metadataResponse(queryItems: components.queryItems ?? [])
        case ("POST", "/v1/credentials/release"):
            return releaseResponse(body: body)
        case ("POST", "/v1/credentials/approve"):
            return approvalResponse(body: body, approve: true)
        case ("POST", "/v1/credentials/deny"):
            return approvalResponse(body: body, approve: false)
        default:
            return json(
                statusCode: 404,
                payload: ["ok": false, "error": "not_found"]
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

    private func approvalResponse(body: Data, approve: Bool) -> BridgeHTTPResponse {
        guard let request = decode(ApprovalDecisionRequest.self, from: body),
              !request.id.isEmpty
        else {
            return invalidRequest()
        }

        if approve {
            return releaseResultResponse(service.approvePendingRelease(id: request.id))
        }

        switch service.denyPendingRelease(id: request.id) {
        case .denied:
            return json(statusCode: 200, payload: ["ok": true, "status": "denied"])
        case .notFound:
            return json(
                statusCode: 404,
                payload: ["ok": false, "error": "credential_not_found"]
            )
        default:
            return invalidRequest()
        }
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

private struct ApprovalDecisionRequest: Decodable {
    let id: String
}

private extension [URLQueryItem] {
    func value(named name: String) -> String? {
        first { item in
            item.name == name
        }?.value
    }
}
