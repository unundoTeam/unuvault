import Foundation
import SwiftUI

struct CompanionMenuView: View {
    @ObservedObject var viewModel: CompanionViewModel
    @FocusState private var focusedCredentialField: CredentialField?

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            header
            content
        }
        .padding(16)
        .frame(width: 360)
        .background(CompanionMenuStyle.canvas)
        .foregroundStyle(CompanionMenuStyle.ink)
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.route {
        case .overview:
            overviewContent
        case .addLogin:
            addLoginPage
        }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text(L10n.string("app.title"))
                    .font(.system(size: 19, weight: .semibold))
                    .foregroundStyle(CompanionMenuStyle.ink)
                Text(L10n.string("app.subtitle"))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(CompanionMenuStyle.muted)
            }

            Spacer(minLength: 12)

            HStack(spacing: 6) {
                Circle()
                    .fill(viewModel.isUnlocked ? CompanionMenuStyle.secure : CompanionMenuStyle.muted)
                    .frame(width: 7, height: 7)
                Text(viewModel.statusBadgeText)
                    .font(.system(size: 11, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .foregroundStyle(CompanionMenuStyle.body)
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(CompanionMenuStyle.neutralSurface)
            )
            .overlay(
                Capsule()
                    .stroke(CompanionMenuStyle.border, lineWidth: 1)
            )
            .accessibilityElement(children: .combine)
            .accessibilityLabel(viewModel.statusBadgeText)
        }
    }

    private var overviewContent: some View {
        VStack(alignment: .leading, spacing: 11) {
            statusPanel
            launchAtLoginSetting
            primaryStateAction
            secondaryActionRow
            localCredentialSection
            Divider()
                .overlay(CompanionMenuStyle.hairline)
            approvalSection
            Divider()
                .overlay(CompanionMenuStyle.hairline)
            recoveryCopy
        }
    }

    private var statusPanel: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(viewModel.statusPanelTitle)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(CompanionMenuStyle.ink)
            Text(viewModel.statusPanelCopy)
                .font(.system(size: 12))
                .lineSpacing(2)
                .foregroundStyle(CompanionMenuStyle.body)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CompanionMenuStyle.panel)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(CompanionMenuStyle.hairline, lineWidth: 1)
        )
    }

    private var launchAtLoginBinding: Binding<Bool> {
        Binding(
            get: {
                viewModel.isLaunchAtLoginEnabled
            },
            set: { isEnabled in
                viewModel.setLaunchAtLoginEnabled(isEnabled)
            }
        )
    }

    private var launchAtLoginSetting: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(L10n.string("install.login_item.title"))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(CompanionMenuStyle.ink)
                Text(viewModel.launchAtLoginStatusText)
                    .font(.system(size: 11, weight: .medium))
                    .lineSpacing(2)
                    .foregroundStyle(CompanionMenuStyle.body)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 10)

            Toggle(
                L10n.string("install.login_item.title"),
                isOn: launchAtLoginBinding
            )
            .labelsHidden()
            .toggleStyle(.switch)
            .disabled(viewModel.isLaunchAtLoginControlDisabled)
            .accessibilityLabel(L10n.string("install.login_item.title"))
            .accessibilityValue(viewModel.launchAtLoginStatusText)
            .accessibilityHint(L10n.string("install.login_item.hint"))
            .accessibilityIdentifier("launch-at-login-toggle")
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CompanionMenuStyle.neutralSurface)
        .clipShape(RoundedRectangle(cornerRadius: 9))
        .overlay(
            RoundedRectangle(cornerRadius: 9)
                .stroke(CompanionMenuStyle.hairline, lineWidth: 1)
        )
    }

    private var primaryStateAction: some View {
        CompanionActionButton(
            title: viewModel.primaryActionTitle,
            style: .primary
        ) {
            viewModel.toggleLockState()
        }
        .keyboardShortcut(.defaultAction)
    }

    private var secondaryActionRow: some View {
        HStack(spacing: 8) {
            CompanionActionButton(
                title: L10n.string("action.add_login"),
                style: .secondary
            ) {
                viewModel.showAddLogin()
            }
            CompanionActionButton(
                title: L10n.string("action.pair_iphone"),
                style: .secondary
            ) {
                viewModel.pairIPhone()
            }
        }
    }

    @ViewBuilder
    private var localCredentialSection: some View {
        if viewModel.isUnlocked {
            VStack(alignment: .leading, spacing: 9) {
                HStack(alignment: .firstTextBaseline) {
                    Text(L10n.string("local_logins.title"))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(CompanionMenuStyle.ink)
                    Spacer(minLength: 10)
                    Text(viewModel.savedCredentialCountText)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(CompanionMenuStyle.muted)
                }

                CompanionSearchField(text: $viewModel.searchText)

                localCredentialList

                if let pendingDeleteCredential = viewModel.pendingDeleteCredential {
                    deleteConfirmation(for: pendingDeleteCredential)
                }
            }
            .padding(11)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(CompanionMenuStyle.hairline, lineWidth: 1)
            )
        }
    }

    @ViewBuilder
    private var localCredentialList: some View {
        if viewModel.savedCredentialRows.isEmpty {
            localCredentialEmptyState(L10n.string("local_logins.empty"))
        } else if viewModel.filteredCredentialRows.isEmpty {
            localCredentialEmptyState(L10n.string("local_logins.no_results"))
        } else {
            let rowHeight: CGFloat = 64
            let visibleRows = min(viewModel.filteredCredentialRows.count, 3)
            let listHeight = CGFloat(visibleRows) * rowHeight +
                CGFloat(max(visibleRows - 1, 0)) * 6

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 6) {
                    ForEach(viewModel.filteredCredentialRows) { credential in
                        CompanionCredentialRowView(
                            credential: credential,
                            isPendingDelete: viewModel.pendingDeleteCredential?.id == credential.id
                        ) {
                            viewModel.requestDeleteLocalCredential(credential)
                        }
                    }
                }
            }
            .frame(height: min(listHeight, 204))
            .accessibilityIdentifier("local-credential-list")
        }
    }

    private func localCredentialEmptyState(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(CompanionMenuStyle.body)
            .lineSpacing(2)
            .fixedSize(horizontal: false, vertical: true)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CompanionMenuStyle.neutralSurface)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(CompanionMenuStyle.hairline, lineWidth: 1)
            )
    }

    private func deleteConfirmation(
        for credential: CompanionLocalCredentialRow
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(L10n.format("local_logins.delete_confirm_title", credential.label))
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(CompanionMenuStyle.ink)
                .lineLimit(2)
            Text(L10n.string("local_logins.delete_confirm_copy"))
                .font(.system(size: 11, weight: .medium))
                .lineSpacing(2)
                .foregroundStyle(CompanionMenuStyle.warningText)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 8) {
                CompanionActionButton(
                    title: L10n.string("action.cancel"),
                    style: .secondary
                ) {
                    viewModel.cancelDeleteLocalCredential()
                }
                CompanionActionButton(
                    title: L10n.string("action.confirm_delete"),
                    style: .destructive
                ) {
                    Task { @MainActor in
                        await viewModel.confirmDeleteLocalCredential()
                    }
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CompanionMenuStyle.warningSurface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(CompanionMenuStyle.warningBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            L10n.format("local_logins.delete_confirm_title", credential.label)
        )
    }

    private var addLoginPage: some View {
        VStack(alignment: .leading, spacing: 11) {
            VStack(alignment: .leading, spacing: 4) {
                Text(L10n.string("add.title"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(CompanionMenuStyle.ink)
                Text(L10n.string("add.copy"))
                    .font(.system(size: 12))
                    .lineSpacing(2)
                    .foregroundStyle(CompanionMenuStyle.body)
                    .fixedSize(horizontal: false, vertical: true)
            }

            localLoginForm

            HStack(spacing: 8) {
                CompanionActionButton(
                    title: L10n.string("action.cancel"),
                    style: .secondary
                ) {
                    viewModel.cancelAddLogin()
                }
                CompanionActionButton(
                    title: L10n.string("action.save"),
                    style: .primary
                ) {
                    Task { @MainActor in
                        await viewModel.saveLocalCredential()
                    }
                }
                .keyboardShortcut(.defaultAction)
            }
        }
        .onAppear {
            focusedCredentialField = .origin
            DispatchQueue.main.async {
                focusedCredentialField = .origin
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                focusedCredentialField = .origin
            }
        }
    }

    private var localLoginForm: some View {
        VStack(alignment: .leading, spacing: 8) {
            CompanionTextField(
                focusedField: $focusedCredentialField,
                focusValue: .origin,
                identifier: "credential-origin",
                title: L10n.string("field.website_origin"),
                text: $viewModel.credentialOrigin
            ) {
                focusedCredentialField = .label
            }
            CompanionTextField(
                focusedField: $focusedCredentialField,
                focusValue: .label,
                identifier: "credential-label",
                title: L10n.string("field.label"),
                text: $viewModel.credentialLabel
            ) {
                focusedCredentialField = .username
            }

            HStack(spacing: 8) {
                CompanionTextField(
                    focusedField: $focusedCredentialField,
                    focusValue: .username,
                    identifier: "credential-username",
                    title: L10n.string("field.username"),
                    text: $viewModel.credentialUsername
                ) {
                    focusedCredentialField = .password
                }
                CompanionTextField(
                    focusedField: $focusedCredentialField,
                    focusValue: .password,
                    identifier: "credential-password",
                    title: L10n.string("field.password"),
                    text: $viewModel.credentialPassword,
                    isSecure: true
                ) {
                    Task { @MainActor in
                        await viewModel.saveLocalCredential()
                    }
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(L10n.string("store_note.title"))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(CompanionMenuStyle.ink)
                Text(L10n.string("store_note.copy"))
                    .font(.system(size: 11, weight: .medium))
                    .lineSpacing(2)
                    .foregroundStyle(CompanionMenuStyle.body)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(9)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CompanionMenuStyle.neutralSurface)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(CompanionMenuStyle.hairline, lineWidth: 1)
            )
        }
        .padding(11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(CompanionMenuStyle.hairline, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var approvalSection: some View {
        if let approval = viewModel.pendingApproval {
            VStack(alignment: .leading, spacing: 10) {
                Text(L10n.string("approval.title"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(CompanionMenuStyle.ink)
                VStack(alignment: .leading, spacing: 4) {
                    Text(L10n.format("approval.site", approval.origin))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(CompanionMenuStyle.ink)
                    Text(L10n.format("approval.meta", approval.label))
                        .font(.system(size: 12))
                        .foregroundStyle(CompanionMenuStyle.body)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 9))
                .overlay(
                    RoundedRectangle(cornerRadius: 9)
                        .stroke(CompanionMenuStyle.border, lineWidth: 1)
                )

                HStack(spacing: 8) {
                    CompanionActionButton(title: L10n.string("action.deny"), style: .secondary) {
                        viewModel.denyPendingFill()
                    }
                    CompanionActionButton(title: L10n.string("action.fill_once"), style: .primary) {
                        viewModel.approvePendingFill()
                    }
                    .keyboardShortcut(.defaultAction)
                }
            }
        } else {
            Text(viewModel.lastDecisionText)
                .font(.system(size: 12, weight: .semibold))
                .lineSpacing(2)
                .foregroundStyle(CompanionMenuStyle.body)
                .fixedSize(horizontal: false, vertical: true)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(CompanionMenuStyle.neutralSurface)
                .clipShape(RoundedRectangle(cornerRadius: 9))
                .overlay(
                    RoundedRectangle(cornerRadius: 9)
                        .stroke(CompanionMenuStyle.hairline, lineWidth: 1)
                )
                .accessibilityLabel(viewModel.lastDecisionText)
        }
    }

    private var recoveryCopy: some View {
        Text(L10n.string("recovery.copy"))
            .font(.system(size: 11, weight: .semibold))
            .lineSpacing(2)
            .foregroundStyle(CompanionMenuStyle.body)
            .fixedSize(horizontal: false, vertical: true)
    }
}

private enum CredentialField: Hashable {
    case origin
    case label
    case username
    case password
}

private enum CompanionMenuStyle {
    static let canvas = Color(red: 0.96, green: 0.96, blue: 0.96)
    static let panel = Color(red: 0.98, green: 0.98, blue: 0.98)
    static let neutralSurface = Color(red: 0.95, green: 0.96, blue: 0.96)
    static let ink = Color(red: 0.07, green: 0.09, blue: 0.14)
    static let body = Color(red: 0.29, green: 0.33, blue: 0.39)
    static let muted = Color(red: 0.42, green: 0.45, blue: 0.50)
    static let border = Color(red: 0.78, green: 0.80, blue: 0.83)
    static let hairline = Color(red: 0.88, green: 0.89, blue: 0.91)
    static let secure = Color(red: 0.25, green: 0.46, blue: 0.40)
    static let danger = Color(red: 0.72, green: 0.11, blue: 0.11)
    static let dangerSurface = Color(red: 1.00, green: 0.95, blue: 0.95)
    static let dangerBorder = Color(red: 0.94, green: 0.45, blue: 0.45)
    static let warningSurface = Color(red: 1.00, green: 0.97, blue: 0.91)
    static let warningBorder = Color(red: 0.96, green: 0.68, blue: 0.35)
    static let warningText = Color(red: 0.55, green: 0.22, blue: 0.07)
}

private struct CompanionSearchField: View {
    @Binding var text: String

    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(CompanionMenuStyle.muted)
                .frame(width: 16)

            TextField(
                L10n.string("local_logins.search_placeholder"),
                text: $text,
                prompt: Text(L10n.string("local_logins.search_placeholder"))
                    .foregroundStyle(CompanionMenuStyle.muted)
            )
            .textFieldStyle(.plain)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(CompanionMenuStyle.ink)

            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(CompanionMenuStyle.muted)
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(L10n.string("action.clear_search"))
            }
        }
        .padding(.horizontal, 10)
        .frame(height: 36)
        .background(CompanionMenuStyle.panel)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(CompanionMenuStyle.border, lineWidth: 1)
        )
        .accessibilityIdentifier("local-credential-search")
    }
}

private struct CompanionCredentialRowView: View {
    let credential: CompanionLocalCredentialRow
    let isPendingDelete: Bool
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 9) {
            VStack(alignment: .leading, spacing: 3) {
                Text(credential.label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(CompanionMenuStyle.ink)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Text(credential.username)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(CompanionMenuStyle.body)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Text(credential.websiteOrigin)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(CompanionMenuStyle.muted)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            Spacer(minLength: 8)

            Button(action: onDelete) {
                HStack(spacing: 5) {
                    Image(systemName: "trash")
                        .font(.system(size: 12, weight: .semibold))
                    Text(L10n.string("action.delete"))
                        .font(.system(size: 11, weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
                .foregroundStyle(CompanionMenuStyle.danger)
                .frame(width: 76, height: 40)
                .background(CompanionMenuStyle.dangerSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(CompanionMenuStyle.dangerBorder, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel(
                L10n.format("local_logins.delete_accessibility", credential.label)
            )
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, minHeight: 58, alignment: .leading)
        .background(
            isPendingDelete
                ? CompanionMenuStyle.warningSurface
                : CompanionMenuStyle.neutralSurface
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(
                    isPendingDelete ? CompanionMenuStyle.warningBorder : CompanionMenuStyle.hairline,
                    lineWidth: 1
                )
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("local-credential-row-\(credential.id)")
    }
}

private struct CompanionTextField: View {
    let focusedField: FocusState<CredentialField?>.Binding
    let focusValue: CredentialField
    let identifier: String
    let title: String
    @Binding var text: String
    var isSecure = false
    var onSubmit: () -> Void = {}

    var body: some View {
        Group {
            if isSecure {
                SecureField(
                    title,
                    text: $text,
                    prompt: Text(title).foregroundStyle(CompanionMenuStyle.muted)
                )
            } else {
                TextField(
                    title,
                    text: $text,
                    prompt: Text(title).foregroundStyle(CompanionMenuStyle.muted)
                )
            }
        }
        .textFieldStyle(.plain)
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(CompanionMenuStyle.ink)
        .focused(focusedField, equals: focusValue)
        .onSubmit(onSubmit)
        .padding(.horizontal, 10)
        .frame(height: 34)
        .background(CompanionMenuStyle.panel)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(CompanionMenuStyle.border, lineWidth: 1)
        )
        .accessibilityLabel(title)
        .accessibilityIdentifier(identifier)
    }
}

private struct CompanionActionButton: View {
    enum Style {
        case primary
        case secondary
        case destructive
    }

    let title: String
    let style: Style
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity)
                .frame(height: 34)
                .foregroundStyle(foreground)
                .background(background)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }

    private var foreground: Color {
        switch style {
        case .primary:
            Color.white
        case .secondary:
            CompanionMenuStyle.body
        case .destructive:
            Color.white
        }
    }

    private var background: Color {
        switch style {
        case .primary:
            CompanionMenuStyle.ink
        case .secondary:
            Color.white
        case .destructive:
            CompanionMenuStyle.danger
        }
    }

    private var border: Color {
        switch style {
        case .primary:
            CompanionMenuStyle.ink
        case .secondary:
            CompanionMenuStyle.border
        case .destructive:
            CompanionMenuStyle.danger
        }
    }
}
