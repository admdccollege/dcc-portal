import UIKit

/// First-run screen where the user enters the portal address issued by the college.
final class SetupViewController: UIViewController, UITextFieldDelegate {
    private let currentOrigin: String?
    /// Called with the chosen origin, or nil if the user cancelled.
    private let onFinish: (String?) -> Void

    private let scrollView = UIScrollView()
    private let urlField = UITextField()
    private let errorLabel = UILabel()

    init(currentOrigin: String?, onFinish: @escaping (String?) -> Void) {
        self.currentOrigin = currentOrigin
        self.onFinish = onFinish
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(named: "Surface")

        let logo = UIImageView(image: UIImage(named: "Logo"))
        logo.layer.cornerRadius = 16
        logo.layer.cornerCurve = .continuous
        logo.clipsToBounds = true
        logo.accessibilityElementsHidden = true
        NSLayoutConstraint.activate([
            logo.widthAnchor.constraint(equalToConstant: 72),
            logo.heightAnchor.constraint(equalToConstant: 72),
        ])

        let heading = label("Connect to the college portal", style: .title1, weight: .bold)
        heading.accessibilityTraits = .header
        let body = label("Enter the web address of the Damdei Christian College portal provided by the college office, for example https://portal.example.edu.in. You only need to do this once.",
                         style: .body, color: .secondaryLabel)

        urlField.placeholder = "https://portal.example.edu.in"
        urlField.text = currentOrigin
        urlField.keyboardType = .URL
        urlField.textContentType = .URL
        urlField.autocapitalizationType = .none
        urlField.autocorrectionType = .no
        urlField.spellCheckingType = .no
        urlField.returnKeyType = .go
        urlField.clearButtonMode = .whileEditing
        urlField.borderStyle = .roundedRect
        urlField.font = .preferredFont(forTextStyle: .body)
        urlField.adjustsFontForContentSizeCategory = true
        urlField.accessibilityLabel = "Portal address"
        urlField.delegate = self
        urlField.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true

        errorLabel.font = .preferredFont(forTextStyle: .footnote)
        errorLabel.adjustsFontForContentSizeCategory = true
        errorLabel.textColor = .systemRed
        errorLabel.numberOfLines = 0
        errorLabel.isHidden = true

        var config = UIButton.Configuration.filled()
        config.title = "Continue"
        config.baseBackgroundColor = UIColor(named: "Brand")
        config.baseForegroundColor = UIColor(named: "BrandOn")
        config.buttonSize = .large
        let save = UIButton(configuration: config, primaryAction: UIAction { [weak self] _ in self?.submit() })

        logo.setContentHuggingPriority(.required, for: .horizontal)
        let logoRow = UIStackView(arrangedSubviews: [logo, UIView()])

        let stack = UIStackView(arrangedSubviews: [logoRow, heading, body, urlField, errorLabel, save])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = 16
        stack.setCustomSpacing(24, after: body)
        stack.setCustomSpacing(4, after: urlField)
        stack.setCustomSpacing(24, after: errorLabel)

        if let fallback = PortalConfig.defaultOrigin, fallback != currentOrigin {
            var c = UIButton.Configuration.plain()
            c.title = "Use default address"
            c.baseForegroundColor = UIColor(named: "Brand")
            stack.addArrangedSubview(UIButton(configuration: c, primaryAction: UIAction { [weak self] _ in
                PortalConfig.clear()
                self?.onFinish(fallback)
            }))
        }
        if currentOrigin != nil {
            var c = UIButton.Configuration.plain()
            c.title = "Cancel"
            c.baseForegroundColor = UIColor(named: "Brand")
            stack.addArrangedSubview(UIButton(configuration: c, primaryAction: UIAction { [weak self] _ in
                self?.onFinish(nil)
            }))
        }

        scrollView.keyboardDismissMode = .interactive
        scrollView.alwaysBounceVertical = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        scrollView.addSubview(stack)

        let content = scrollView.contentLayoutGuide
        let frame = scrollView.frameLayoutGuide
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            stack.topAnchor.constraint(equalTo: content.topAnchor, constant: 48),
            stack.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -24),
            stack.centerXAnchor.constraint(equalTo: frame.centerXAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: frame.leadingAnchor, constant: 24),
            // Comfortable reading width on iPad.
            stack.widthAnchor.constraint(lessThanOrEqualToConstant: 560),
        ])
        let fullWidth = stack.widthAnchor.constraint(equalTo: frame.widthAnchor, constant: -48)
        fullWidth.priority = .defaultHigh
        fullWidth.isActive = true
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if currentOrigin == nil { urlField.becomeFirstResponder() }
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        submit()
        return true
    }

    private func submit() {
        let result = PortalURL.normalize(urlField.text ?? "", allowPrivateHTTP: PortalConfig.isDebugBuild)
        guard let origin = result.origin else {
            errorLabel.text = result.error
            errorLabel.isHidden = false
            UIAccessibility.post(notification: .announcement, argument: result.error)
            return
        }
        errorLabel.isHidden = true
        urlField.resignFirstResponder()
        PortalConfig.save(origin)
        onFinish(origin)
    }

    private func label(_ text: String, style: UIFont.TextStyle, weight: UIFont.Weight? = nil,
                       color: UIColor = .label) -> UILabel {
        let l = UILabel()
        l.text = text
        l.numberOfLines = 0
        l.textColor = color
        l.adjustsFontForContentSizeCategory = true
        if let weight = weight {
            // Default (unscaled) point sizes for the text styles used with a custom weight.
            let size: CGFloat = style == .title1 ? 28 : 17
            l.font = UIFontMetrics(forTextStyle: style).scaledFont(for: .systemFont(ofSize: size, weight: weight))
        } else {
            l.font = .preferredFont(forTextStyle: style)
        }
        return l
    }
}
