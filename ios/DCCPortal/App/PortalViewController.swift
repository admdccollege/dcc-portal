import UIKit
import WebKit

/// Hosts the DCC portal in a WKWebView. Only the configured portal origin is loaded
/// inside the app; every other link opens in Safari or the relevant app. Sign-in,
/// permissions and all data access stay on the server exactly as on the web.
final class PortalViewController: UIViewController {
    private let origin: String
    private let onChangeAddress: () -> Void

    private var webView: WKWebView!
    private let progressView = UIProgressView(progressViewStyle: .bar)
    private let errorView = UIStackView()
    private let errorMessage = UILabel()
    private var progressObservation: NSKeyValueObservation?
    /// Destination files for in-flight downloads.
    private var downloadDestinations: [ObjectIdentifier: URL] = [:]

    init(origin: String, onChangeAddress: @escaping () -> Void) {
        self.origin = origin
        self.onChangeAddress = onChangeAddress
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: PrintBridge.name)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(named: "Surface")
        setUpWebView()
        setUpProgress()
        setUpErrorView()
        loadStart()
    }

    // MARK: - Setup

    private func setUpWebView() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        config.preferences.isFraudulentWebsiteWarningEnabled = true
        config.defaultWebpagePreferences.preferredContentMode = .mobile
        config.allowsInlineMediaPlayback = true
        config.dataDetectorTypes = []
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        config.applicationNameForUserAgent = "Mobile/15E148 DCCPortalApp/\(version)"

        // Lets the portal's Print buttons (window.print) open the iOS print sheet.
        let script = WKUserScript(
            source: "window.print=function(){window.webkit.messageHandlers.\(PrintBridge.name).postMessage(document.title||'')};",
            injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        config.userContentController.addUserScript(script)
        config.userContentController.add(PrintBridge(owner: self), name: PrintBridge.name)

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = false
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif
        webView.isOpaque = false
        webView.backgroundColor = UIColor(named: "Surface")
        webView.scrollView.backgroundColor = UIColor(named: "Surface")

        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    private func setUpProgress() {
        progressView.progressTintColor = UIColor(named: "Brand")
        progressView.trackTintColor = .clear
        progressView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(progressView)
        NSLayoutConstraint.activate([
            progressView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progressView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] webView, _ in
            guard let self = self else { return }
            let p = Float(webView.estimatedProgress)
            self.progressView.setProgress(p, animated: p > self.progressView.progress)
            self.progressView.isHidden = p >= 1
        }
    }

    private func setUpErrorView() {
        let title = UILabel()
        title.text = "Can't reach the portal"
        title.font = .preferredFont(forTextStyle: .title2)
        title.adjustsFontForContentSizeCategory = true
        title.textAlignment = .center
        title.numberOfLines = 0
        title.accessibilityTraits = .header

        errorMessage.font = .preferredFont(forTextStyle: .body)
        errorMessage.adjustsFontForContentSizeCategory = true
        errorMessage.textColor = .secondaryLabel
        errorMessage.textAlignment = .center
        errorMessage.numberOfLines = 0

        var retryConfig = UIButton.Configuration.filled()
        retryConfig.title = "Try again"
        retryConfig.baseBackgroundColor = UIColor(named: "Brand")
        retryConfig.baseForegroundColor = UIColor(named: "BrandOn")
        retryConfig.buttonSize = .large
        let retry = UIButton(configuration: retryConfig, primaryAction: UIAction { [weak self] _ in self?.reload() })

        var changeConfig = UIButton.Configuration.plain()
        changeConfig.title = "Change portal address"
        changeConfig.baseForegroundColor = UIColor(named: "Brand")
        let change = UIButton(configuration: changeConfig, primaryAction: UIAction { [weak self] _ in self?.onChangeAddress() })

        let views: [UIView] = [title, errorMessage, retry, change]
        views.forEach { errorView.addArrangedSubview($0) }
        errorView.axis = .vertical
        errorView.alignment = .center
        errorView.spacing = 12
        errorView.setCustomSpacing(24, after: errorMessage)
        errorView.isHidden = true
        errorView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(errorView)
        NSLayoutConstraint.activate([
            errorView.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor),
            errorView.leadingAnchor.constraint(equalTo: view.readableContentGuide.leadingAnchor),
            errorView.trailingAnchor.constraint(equalTo: view.readableContentGuide.trailingAnchor),
        ])
    }

    // MARK: - Loading and errors

    private var startURL: URL { URL(string: origin + "/")! }

    private func loadStart() {
        webView.load(URLRequest(url: startURL))
    }

    private func reload() {
        hideError()
        if PortalURL.isSameOrigin(webView.url, origin) {
            webView.reload()
        } else {
            loadStart()
        }
    }

    private func showError(_ message: String) {
        errorMessage.text = message
        errorView.isHidden = false
        webView.isHidden = true
        progressView.isHidden = true
        UIAccessibility.post(notification: .screenChanged, argument: errorView)
    }

    private func hideError() {
        errorView.isHidden = true
        webView.isHidden = false
    }

    private func handleLoadFailure(_ error: Error) {
        let nsError = error as NSError
        // Cancelled loads (link opened elsewhere, a download started) are not failures.
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled { return }
        if nsError.domain == "WebKitErrorDomain" && nsError.code == 102 { return } // frame load interrupted
        switch (nsError.domain, nsError.code) {
        case (NSURLErrorDomain, NSURLErrorNotConnectedToInternet),
             (NSURLErrorDomain, NSURLErrorNetworkConnectionLost),
             (NSURLErrorDomain, NSURLErrorDataNotAllowed):
            showError("You appear to be offline. Check your internet connection and try again.")
        case (NSURLErrorDomain, NSURLErrorServerCertificateUntrusted),
             (NSURLErrorDomain, NSURLErrorServerCertificateHasBadDate),
             (NSURLErrorDomain, NSURLErrorServerCertificateHasUnknownRoot),
             (NSURLErrorDomain, NSURLErrorServerCertificateNotYetValid),
             (NSURLErrorDomain, NSURLErrorSecureConnectionFailed):
            showError("The portal's security certificate could not be verified, so the connection was stopped to protect your data.")
        default:
            showError("The portal could not be loaded (\(nsError.localizedDescription)).")
        }
    }

    // MARK: - External links, printing, downloaded files

    fileprivate func openExternally(_ url: URL) {
        // Only hand off well-known schemes; never javascript:, file:, data: or custom schemes.
        guard let scheme = url.scheme?.lowercased(), ["https", "http", "mailto", "tel"].contains(scheme) else { return }
        UIApplication.shared.open(url)
    }

    fileprivate func printPage(title: String) {
        guard PortalURL.isSameOrigin(webView.url, origin) else { return }
        let info = UIPrintInfo(dictionary: nil)
        info.jobName = title.trimmingCharacters(in: .whitespaces).isEmpty ? "DCC Portal document" : title
        info.outputType = .general
        let controller = UIPrintInteractionController.shared
        controller.printInfo = info
        controller.printFormatter = webView.viewPrintFormatter()
        if UIDevice.current.userInterfaceIdiom == .pad {
            _ = controller.present(from: CGRect(x: view.bounds.midX, y: view.safeAreaInsets.top + 8, width: 1, height: 1),
                               in: view, animated: true, completionHandler: nil)
        } else {
            _ = controller.present(animated: true, completionHandler: nil)
        }
    }

    /// Offers a downloaded file through the share sheet (Save to Files, Print, AirDrop, …).
    private func share(file: URL) {
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        sheet.popoverPresentationController?.permittedArrowDirections = []
        sheet.completionWithItemsHandler = { _, _, _, _ in
            try? FileManager.default.removeItem(at: file.deletingLastPathComponent())
        }
        present(sheet, animated: true)
    }

    private func alert(_ message: String) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default))
        present(a, animated: true)
    }

    fileprivate static func isAttachment(_ response: URLResponse) -> Bool {
        guard let http = response as? HTTPURLResponse,
              let disposition = http.value(forHTTPHeaderField: "Content-Disposition") else { return false }
        return disposition.lowercased().hasPrefix("attachment")
    }
}

// MARK: - WKNavigationDelegate

extension PortalViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.cancel) }

        if navigationAction.shouldPerformDownload {
            // <a download>: portal files, or CSV templates built in the page (data: URLs).
            let allowed = url.scheme == "data" || url.scheme == "blob" || PortalURL.isSameOrigin(url, origin)
            return decisionHandler(allowed ? .download : .cancel)
        }
        if PortalURL.isSameOrigin(url, origin) || url.scheme == "about" {
            return decisionHandler(.allow)
        }
        // Includes server redirects to other hosts (e.g. short-lived signed file links).
        if navigationAction.targetFrame?.isMainFrame != false {
            openExternally(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        // Attachments, files WebKit can't show, and PDFs (marksheets, receipts) are
        // downloaded so they can be saved or printed from the share sheet.
        let isPDF = navigationResponse.response.mimeType == "application/pdf"
        if navigationResponse.isForMainFrame,
           isPDF || !navigationResponse.canShowMIMEType || Self.isAttachment(navigationResponse.response) {
            return decisionHandler(.download)
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        progressView.isHidden = false
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hideError()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleLoadFailure(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleLoadFailure(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // The web content process crashed or was reclaimed: reload the current page.
        reload()
    }
}

// MARK: - WKUIDelegate

extension PortalViewController: WKUIDelegate {
    /// Links with target="_blank": portal pages open in place, others externally.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if PortalURL.isSameOrigin(url, origin) {
                webView.load(navigationAction.request)
            } else {
                openExternally(url)
            }
        }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }
}

// MARK: - WKDownloadDelegate

extension PortalViewController: WKDownloadDelegate {
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        // Each download gets its own temporary folder; the user then chooses where to keep it.
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("downloads", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        } catch {
            return completionHandler(nil)
        }
        let name = suggestedFilename.isEmpty ? "download" : suggestedFilename
        let dest = dir.appendingPathComponent((name as NSString).lastPathComponent)
        downloadDestinations[ObjectIdentifier(download)] = dest
        completionHandler(dest)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let file = downloadDestinations.removeValue(forKey: ObjectIdentifier(download)) else { return }
        share(file: file)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if let file = downloadDestinations.removeValue(forKey: ObjectIdentifier(download)) {
            try? FileManager.default.removeItem(at: file.deletingLastPathComponent())
        }
        alert("Download failed. Please try again.")
    }
}

// MARK: - Print bridge

/// Receives window.print() calls from portal pages. Held weakly to avoid a retain
/// cycle through WKUserContentController; acts only for the portal's main frame.
private final class PrintBridge: NSObject, WKScriptMessageHandler {
    static let name = "dccPrint"
    private weak var owner: PortalViewController?

    init(owner: PortalViewController) {
        self.owner = owner
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let owner = owner, message.frameInfo.isMainFrame else { return }
        let o = message.frameInfo.securityOrigin
        var components = URLComponents()
        components.scheme = o.protocol
        components.host = o.host
        components.port = o.port == 0 ? nil : o.port
        guard let originURL = components.url, PortalURL.isSameOrigin(originURL, owner.originForBridge) else { return }
        owner.printPage(title: message.body as? String ?? "")
    }
}

private extension PortalViewController {
    var originForBridge: String { origin }
}
