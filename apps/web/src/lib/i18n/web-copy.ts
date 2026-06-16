type WebLocale = "en" | "zh-Hans";

const enWebCopy = {
  home: {
    title: "Run unuvault locally",
    body: "Start the API on port 3000, open the web app on port 3001, then verify the register flow.",
    registerLink: "Open register flow",
  },
  security: {
    title: "Security",
    trustSummary: {
      title: "Trust summary",
      body: "unuvault keeps security explanations visible instead of hiding them behind support pages.",
    },
    devices: {
      title: "Devices",
      body: "See which browsers and phones can currently access your unuvault vault.",
    },
    recentActivity: {
      title: "Recent activity",
      body: "Important sign-ins, imports, and security actions will appear here.",
    },
  },
  import: {
    title: "Import from Chrome, Edge, or Safari",
    reportTitle: "Import report",
    reportBody: "Imported items, duplicates, and follow-up guidance will appear here.",
  },
  auth: {
    badge: "Local onboarding",
    emailLabel: "Email",
    passwordLabel: "Password",
    emailPasswordRequired: "Email and password are required.",
    registerTitle: "Create your unuvault account",
    registerBody: "Start with a safer home for the passwords you already use every day.",
    registerSubmit: "Create account",
    registerSubmitting: "Creating account...",
    registerSuccess: "Check your email to finish setting up unuvault.",
    registerError: "We couldn't create your account. Please try again.",
    alreadyHaveAccount: "Already have an account?",
    signInLink: "Sign in",
    loginTitle: "Sign in to unuvault",
    loginBody:
      "Continue with your existing account so local handoff and vault access can finish in this browser.",
    loginSubmit: "Sign in",
    loginSubmitting: "Signing in...",
    googleSubmit: "Continue with Google",
    loginError: "We couldn't sign you in. Please try again.",
    needAccount: "Need a new account?",
    createAccountLink: "Create account",
  },
  vault: {
    title: "Vault",
    subtitle: "Keep your current unuvault items in sync across every trusted surface.",
    authNote: "Sign in from the register flow first.",
    syncError: "We couldn't sync your vault. Please try again.",
    missingItem: "We couldn't find that vault item.",
    status: {
      bootstrapping: "Syncing vault...",
      saving: "Saving item...",
      updating: "Updating item...",
      deleting: "Deleting item...",
      synced: "Vault synced",
      saved: "Item saved",
      updated: "Item updated",
      deleted: "Item deleted",
      lastSyncedAt: (time: string) => `Last synced at ${time}`,
    },
    unlock: {
      unlockedTitle: "Unlocked session",
      setupTitle: "Create master password",
      lockedTitle: "Unlock vault",
      unlockedBody: "Sensitive fields and row actions are available until you lock again.",
      lockedBody: "Use your master password to reveal saved credentials and enable row actions.",
      unlockedBadge: "Vault unlocked",
      lockButton: "Lock vault",
      formLabel: "Unlock vault",
      masterPassword: "Master password",
      confirmMasterPassword: "Confirm master password",
      setMasterPassword: "Set master password",
      unlockVault: "Unlock vault",
      requiredError: "Master password is required",
      mismatchError: "Passwords do not match",
      existingPasswordError: "Master password must unlock existing saved passwords",
      wrongPasswordError: "Wrong master password",
    },
    validation: {
      titleRequired: "Title is required.",
      editTitleRequired: "Edited title is required.",
      validWebsite: "Enter a valid website URL.",
      unlockBeforePassword: "Unlock the vault before saving a password.",
    },
    items: {
      title: "Vault items",
      unlockedBody: "Search, copy, edit, and save actions are available.",
      lockedBody: "Passwords stay hidden until the vault is unlocked.",
      searchLabel: "Search vault",
      searchPlaceholder: "Search vault",
      lockedSearchPlaceholder: "Unlock to search",
      newLogin: "New login",
      unlockedReviewLabel: "Unlocked session",
      lockedReviewLabel: "Locked state",
      unlockedReviewBody:
        "Secure green is state feedback only; danger red is reserved for destructive actions.",
      lockedReviewBody: "Save, copy, reveal, edit, and delete remain unavailable while locked.",
      notesAdded: "Notes added",
      usernameAndPasswordHidden: "Username hidden - password hidden",
      credentialsLocked: "Credentials unavailable until unlock",
      lockedButton: "Locked",
      copied: "Copied",
      copyUsername: "Copy username",
      copiedPassword: "Copied password",
      copyPassword: "Copy password",
      hide: "Hide",
      show: "Show",
      details: "Details",
      edit: "Edit",
      noMatches: "No matching vault items.",
      empty: "No vault items yet.",
      noPasswordSaved: "No password saved",
      hiddenPassword: "••••••••",
    },
    detail: {
      panelLabel: "Vault item detail",
      saveLoginTitle: "Save a login",
      saveFormLabel: "Save vault item",
      title: "Title",
      username: "Username",
      website: "Website",
      password: "Password",
      notes: "Notes",
      hidePassword: "Hide password",
      showPassword: "Show password",
      saveItem: "Save item",
      editKicker: "EDIT ITEM",
      editTitle: "Edit title",
      editUsername: "Edit username",
      editWebsite: "Edit website",
      editPassword: "Edit password",
      editNotes: "Edit notes",
      hideEditPassword: "Hide edit password",
      showEditPassword: "Show edit password",
      save: "Save",
      cancel: "Cancel",
      selectedKicker: "SELECTED ITEM",
      updatedToday: (username: string) => `${username} - updated today`,
      noUsernameSaved: "No username saved",
      editItem: "Edit item",
      dangerTitle: "Danger",
      dangerBody: "Delete remains visually separate from routine copy and edit actions.",
      deleteItem: "Delete item",
      selectOrCreate: "Select or create a vault item.",
    },
    aria: {
      lockedItem: (title: string) => `Locked ${title}`,
      copied: (title: string) => `Copied ${title}`,
      copyUsername: (title: string) => `Copy username ${title}`,
      copiedSavedPassword: (title: string) => `Copied saved password ${title}`,
      copiedPassword: (title: string) => `Copied password ${title}`,
      copySavedPassword: (title: string) => `Copy saved password ${title}`,
      copyPassword: (title: string) => `Copy password ${title}`,
      hideRowPassword: (title: string) => `Hide row password ${title}`,
      hidePassword: (title: string) => `Hide password ${title}`,
      showRowPassword: (title: string) => `Show row password ${title}`,
      showPassword: (title: string) => `Show password ${title}`,
      openDetails: (title: string) => `Open details ${title}`,
      editRow: (title: string) => `Edit row ${title}`,
      edit: (title: string) => `Edit ${title}`,
      delete: (title: string) => `Delete ${title}`,
    },
    macCompanion: {
      label: "Mac companion",
      title: "Save to this Mac",
      body: "Send unlocked vault items to the trusted Mac companion. The Mac vault must be running and unlocked.",
      saveButton: "Save to this Mac",
      savingButton: "Saving...",
      unlockWebVault: "Unlock the Web vault before saving to this Mac.",
      savingMessage: "Saving unlocked vault items to this Mac...",
      emptyMessage: "No saved passwords are available to send to this Mac.",
      vaultLockedMessage: "Unlock the Mac vault before saving Web items locally.",
      importError:
        "Mac companion could not import the vault. Unlock the Mac vault and try again.",
      unavailableError: "Mac companion is not available. Start or unlock the Mac app, then try again.",
      formatReceipt: (count: number) =>
        `Saved ${count} ${count === 1 ? "item" : "items"} to this Mac.`,
      statusLabel: {
        attention: "Mac companion attention",
        checking: "Checking Mac companion",
        locked: "Mac companion locked",
        unavailable: "Mac companion unavailable",
        unlocked: "Mac companion unlocked",
      },
      statusHelper: {
        attention: "Review the Mac app before saving Web items locally.",
        checking: "Checking whether the Mac app is running and unlocked.",
        locked: "Unlock the Mac vault before saving Web items locally.",
        unavailable: "Open the Mac app on this Mac, then unlock its local vault.",
        unlocked: "Mac companion is ready. Saved items stay encrypted on this Mac.",
      },
    },
  },
};

type WebCopy = typeof enWebCopy;

const zhHansWebCopy: WebCopy = {
  home: {
    title: "本地运行 UnuVault",
    body: "启动 3000 端口的 API，打开 3001 端口的 Web app，然后验证注册流程。",
    registerLink: "打开注册流程",
  },
  security: {
    title: "安全",
    trustSummary: {
      title: "信任摘要",
      body: "UnuVault 会把安全说明放在可见位置，而不是藏在支持页面里。",
    },
    devices: {
      title: "设备",
      body: "查看哪些浏览器和手机当前可以访问你的 UnuVault 保险库。",
    },
    recentActivity: {
      title: "近期活动",
      body: "重要登录、导入和安全操作会显示在这里。",
    },
  },
  import: {
    title: "从 Chrome、Edge 或 Safari 导入",
    reportTitle: "导入报告",
    reportBody: "导入项目、重复项和后续指引会显示在这里。",
  },
  auth: {
    badge: "本机启用",
    emailLabel: "邮箱",
    passwordLabel: "密码",
    emailPasswordRequired: "请填写邮箱和密码。",
    registerTitle: "创建你的 UnuVault 账户",
    registerBody: "先给每天都在使用的密码一个更安全的家。",
    registerSubmit: "创建账户",
    registerSubmitting: "正在创建账户...",
    registerSuccess: "请查看邮箱，完成 UnuVault 设置。",
    registerError: "暂时无法创建账户。请重试。",
    alreadyHaveAccount: "已有账户？",
    signInLink: "登录",
    loginTitle: "登录 UnuVault",
    loginBody: "继续使用已有账户，让本机交接和保险库访问在这个浏览器里完成。",
    loginSubmit: "登录",
    loginSubmitting: "正在登录...",
    googleSubmit: "继续使用 Google",
    loginError: "暂时无法登录。请重试。",
    needAccount: "需要新账户？",
    createAccountLink: "创建账户",
  },
  vault: {
    title: "保险库",
    subtitle: "让当前的 UnuVault 项目在每个可信界面之间保持同步。",
    authNote: "请先通过注册流程登录。",
    syncError: "暂时无法同步保险库。请重试。",
    missingItem: "找不到这个保险库项目。",
    status: {
      bootstrapping: "正在同步保险库...",
      saving: "正在保存项目...",
      updating: "正在更新项目...",
      deleting: "正在删除项目...",
      synced: "保险库已同步",
      saved: "项目已保存",
      updated: "项目已更新",
      deleted: "项目已删除",
      lastSyncedAt: (time: string) => `上次同步于 ${time}`,
    },
    unlock: {
      unlockedTitle: "已解锁会话",
      setupTitle: "创建主密码",
      lockedTitle: "解锁保险库",
      unlockedBody: "敏感字段和行操作会保持可用，直到你再次锁定。",
      lockedBody: "使用主密码显示已保存凭据，并启用行操作。",
      unlockedBadge: "保险库已解锁",
      lockButton: "锁定保险库",
      formLabel: "解锁保险库",
      masterPassword: "主密码",
      confirmMasterPassword: "确认主密码",
      setMasterPassword: "设置主密码",
      unlockVault: "解锁保险库",
      requiredError: "请填写主密码",
      mismatchError: "两次输入的密码不一致",
      existingPasswordError: "主密码必须能解锁已有保存密码",
      wrongPasswordError: "主密码不正确",
    },
    validation: {
      titleRequired: "请填写标题。",
      editTitleRequired: "请填写编辑后的标题。",
      validWebsite: "请输入有效的网站 URL。",
      unlockBeforePassword: "请先解锁保险库，再保存密码。",
    },
    items: {
      title: "保险库项目",
      unlockedBody: "搜索、复制、编辑和保存操作现在可用。",
      lockedBody: "保险库解锁前，密码会保持隐藏。",
      searchLabel: "搜索保险库",
      searchPlaceholder: "搜索保险库",
      lockedSearchPlaceholder: "解锁后搜索",
      newLogin: "新建登录项",
      unlockedReviewLabel: "已解锁会话",
      lockedReviewLabel: "已锁定状态",
      unlockedReviewBody: "安全绿色只用于状态反馈；危险红色保留给破坏性操作。",
      lockedReviewBody: "锁定时，保存、复制、显示、编辑和删除都不可用。",
      notesAdded: "已添加备注",
      usernameAndPasswordHidden: "用户名已隐藏 - 密码已隐藏",
      credentialsLocked: "解锁前无法查看凭据",
      lockedButton: "已锁定",
      copied: "已复制",
      copyUsername: "复制用户名",
      copiedPassword: "已复制密码",
      copyPassword: "复制密码",
      hide: "隐藏",
      show: "显示",
      details: "详情",
      edit: "编辑",
      noMatches: "没有匹配的保险库项目。",
      empty: "还没有保险库项目。",
      noPasswordSaved: "未保存密码",
      hiddenPassword: "••••••••",
    },
    detail: {
      panelLabel: "保险库项目详情",
      saveLoginTitle: "保存登录项",
      saveFormLabel: "保存保险库项目",
      title: "标题",
      username: "用户名",
      website: "网站",
      password: "密码",
      notes: "备注",
      hidePassword: "隐藏密码",
      showPassword: "显示密码",
      saveItem: "保存项目",
      editKicker: "编辑项目",
      editTitle: "编辑标题",
      editUsername: "编辑用户名",
      editWebsite: "编辑网站",
      editPassword: "编辑密码",
      editNotes: "编辑备注",
      hideEditPassword: "隐藏编辑密码",
      showEditPassword: "显示编辑密码",
      save: "保存",
      cancel: "取消",
      selectedKicker: "已选项目",
      updatedToday: (username: string) => `${username} - 今天已更新`,
      noUsernameSaved: "未保存用户名",
      editItem: "编辑项目",
      dangerTitle: "危险操作",
      dangerBody: "删除操作会与常规复制和编辑操作保持视觉分离。",
      deleteItem: "删除项目",
      selectOrCreate: "选择或创建一个保险库项目。",
    },
    aria: {
      lockedItem: (title: string) => `已锁定 ${title}`,
      copied: (title: string) => `已复制 ${title}`,
      copyUsername: (title: string) => `复制 ${title} 的用户名`,
      copiedSavedPassword: (title: string) => `已复制 ${title} 的保存密码`,
      copiedPassword: (title: string) => `已复制 ${title} 的密码`,
      copySavedPassword: (title: string) => `复制 ${title} 的保存密码`,
      copyPassword: (title: string) => `复制 ${title} 的密码`,
      hideRowPassword: (title: string) => `隐藏 ${title} 的行内密码`,
      hidePassword: (title: string) => `隐藏 ${title} 的密码`,
      showRowPassword: (title: string) => `显示 ${title} 的行内密码`,
      showPassword: (title: string) => `显示 ${title} 的密码`,
      openDetails: (title: string) => `打开 ${title} 的详情`,
      editRow: (title: string) => `编辑 ${title} 这一行`,
      edit: (title: string) => `编辑 ${title}`,
      delete: (title: string) => `删除 ${title}`,
    },
    macCompanion: {
      label: "Mac 伴侣",
      title: "保存到这台 Mac",
      body: "将已解锁的保险库项目发送到可信 Mac companion。Mac 本机保险库必须正在运行并已解锁。",
      saveButton: "保存到这台 Mac",
      savingButton: "正在保存...",
      unlockWebVault: "请先解锁 Web 保险库，再保存到这台 Mac。",
      savingMessage: "正在把已解锁的保险库项目保存到这台 Mac...",
      emptyMessage: "没有可发送到这台 Mac 的已保存密码。",
      vaultLockedMessage: "请先解锁 Mac 保险库，再保存 Web 项目到本机。",
      importError: "Mac companion 无法导入保险库。请解锁 Mac 保险库后重试。",
      unavailableError: "Mac companion 不可用。请启动或解锁 Mac app 后重试。",
      formatReceipt: (count: number) => `已保存 ${count} 项到这台 Mac。`,
      statusLabel: {
        attention: "Mac companion 需要处理",
        checking: "正在检查 Mac companion",
        locked: "Mac companion 已锁定",
        unavailable: "Mac companion 不可用",
        unlocked: "Mac companion 已解锁",
      },
      statusHelper: {
        attention: "保存 Web 项目到本机前，请先检查 Mac app。",
        checking: "正在检查 Mac app 是否运行且已解锁。",
        locked: "请先解锁 Mac 保险库，再保存 Web 项目到本机。",
        unavailable: "请在这台 Mac 上打开 Mac app，然后解锁本机保险库。",
        unlocked: "Mac companion 已就绪。保存的项目会在这台 Mac 上加密保存。",
      },
    },
  },
};

const webCopies: Record<WebLocale, WebCopy> = {
  en: enWebCopy,
  "zh-Hans": zhHansWebCopy,
};

function readBrowserLanguages(): readonly string[] {
  const localeOverride = readLocaleOverride();
  const languages = localeOverride ? [localeOverride] : [];

  if (typeof navigator === "undefined") {
    return languages;
  }

  if (navigator.language) {
    languages.push(navigator.language);
  }

  languages.push(...Array.from(navigator.languages ?? []));

  return languages;
}

function readLocaleOverride(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("lang") ?? searchParams.get("locale");
}

export function resolveWebLocale(
  languages: string | readonly string[] | null | undefined = readBrowserLanguages(),
): WebLocale {
  const languageList = typeof languages === "string" ? [languages] : languages ?? [];

  return languageList.some((language) => {
    const normalized = language.toLowerCase();
    return (
      normalized === "zh" ||
      normalized.startsWith("zh-cn") ||
      normalized.startsWith("zh-hans")
    );
  })
    ? "zh-Hans"
    : "en";
}

export function getWebCopy(
  languages?: string | readonly string[] | null,
): WebCopy {
  return webCopies[resolveWebLocale(languages)];
}
