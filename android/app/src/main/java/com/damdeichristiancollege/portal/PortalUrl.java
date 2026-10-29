package com.damdeichristiancollege.portal;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/**
 * Validation and origin checks for the portal address. Pure Java (no Android
 * APIs) so it can be unit-tested on the JVM.
 */
public final class PortalUrl {
    private PortalUrl() {}

    /** Result of {@link #normalize}: either an origin URL or an error message. */
    public static final class Result {
        public final String url;
        public final String error;

        private Result(String url, String error) {
            this.url = url;
            this.error = error;
        }

        public boolean ok() {
            return url != null;
        }
    }

    /**
     * Turns user input into a portal origin such as {@code https://portal.example.edu.in}.
     * HTTPS is required; plain HTTP is accepted only when {@code allowPrivateHttp} is set
     * (debug builds) and the host is a private/local network address.
     */
    public static Result normalize(String input, boolean allowPrivateHttp) {
        String s = input == null ? "" : input.trim();
        if (s.isEmpty()) return new Result(null, "Enter the portal address.");
        if (!s.contains("://")) s = "https://" + s;

        URI uri;
        try {
            uri = new URI(s);
        } catch (URISyntaxException e) {
            return new Result(null, "That doesn't look like a web address.");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        String host = uri.getHost();
        if (host == null || host.isEmpty() || host.startsWith(".") || host.endsWith(".")) {
            return new Result(null, "That doesn't look like a web address.");
        }
        host = host.toLowerCase(Locale.ROOT);
        if (uri.getRawUserInfo() != null) {
            return new Result(null, "Remove the user name from the address.");
        }
        if (scheme.equals("http")) {
            if (!allowPrivateHttp || !isPrivateHost(host)) {
                return new Result(null, "The address must start with https:// for a secure connection.");
            }
        } else if (!scheme.equals("https")) {
            return new Result(null, "The address must start with https://");
        }
        int port = uri.getPort();
        boolean defaultPort = port == -1
                || (scheme.equals("https") && port == 443)
                || (scheme.equals("http") && port == 80);
        String hostPart = host.contains(":") ? "[" + host + "]" : host;
        return new Result(scheme + "://" + hostPart + (defaultPort ? "" : ":" + port), null);
    }

    /** The origin (scheme://host[:port]) of a URL, or null if it has none. */
    public static String originOf(String url) {
        if (url == null) return null;
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null) return null;
            scheme = scheme.toLowerCase(Locale.ROOT);
            host = host.toLowerCase(Locale.ROOT);
            int port = uri.getPort();
            boolean defaultPort = port == -1
                    || (scheme.equals("https") && port == 443)
                    || (scheme.equals("http") && port == 80);
            String hostPart = host.contains(":") && !host.startsWith("[") ? "[" + host + "]" : host;
            return scheme + "://" + hostPart + (defaultPort ? "" : ":" + port);
        } catch (URISyntaxException e) {
            return null;
        }
    }

    public static boolean isSameOrigin(String url, String portalOrigin) {
        String origin = originOf(url);
        return origin != null && origin.equals(portalOrigin);
    }

    static boolean isPrivateHost(String host) {
        if (host.equals("localhost") || host.endsWith(".local")) return true;
        String[] p = host.split("\\.");
        if (p.length != 4) return false;
        int[] o = new int[4];
        for (int i = 0; i < 4; i++) {
            try {
                o[i] = Integer.parseInt(p[i]);
            } catch (NumberFormatException e) {
                return false;
            }
            if (o[i] < 0 || o[i] > 255) return false;
        }
        return o[0] == 10
                || o[0] == 127
                || (o[0] == 192 && o[1] == 168)
                || (o[0] == 172 && o[1] >= 16 && o[1] <= 31);
    }
}
