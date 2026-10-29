package com.damdeichristiancollege.portal;

/** Plain-JVM tests for portal address validation (run with ./test.sh). */
public final class PortalUrlTest {
    private static int passed, failed;

    public static void main(String[] args) {
        // Accepted and normalised to an origin
        ok("https://portal.example.edu.in", false, "https://portal.example.edu.in");
        ok("portal.example.edu.in", false, "https://portal.example.edu.in");
        ok("  HTTPS://Portal.Example.edu.in/dashboard?x=1#top ", false, "https://portal.example.edu.in");
        ok("https://portal.example.edu.in:443/", false, "https://portal.example.edu.in");
        ok("https://portal.example.edu.in:8443", false, "https://portal.example.edu.in:8443");
        ok("http://10.0.2.2:3000", true, "http://10.0.2.2:3000");
        ok("http://192.168.1.20:3000/login", true, "http://192.168.1.20:3000");
        ok("http://172.20.0.5", true, "http://172.20.0.5");
        ok("http://localhost:3000", true, "http://localhost:3000");

        // Rejected
        bad("", false);
        bad("   ", false);
        bad("http://portal.example.edu.in", false);   // plain HTTP in release
        bad("http://portal.example.edu.in", true);    // plain HTTP to a public host, even in debug
        bad("http://10.0.2.2:3000", false);           // private HTTP not allowed in release
        bad("http://172.32.0.1", true);               // outside 172.16/12
        bad("ftp://portal.example.edu.in", false);
        bad("javascript:alert(1)", false);
        bad("file:///sdcard/x.html", false);
        bad("https://user:pass@portal.example.edu.in", false);
        bad("https://", false);
        bad("https://exa mple.com", false);

        // Same-origin checks used for navigation and downloads
        check(PortalUrl.isSameOrigin("https://portal.example.edu.in/api/pdf/receipt/1", "https://portal.example.edu.in"), "same origin path");
        check(PortalUrl.isSameOrigin("https://PORTAL.example.edu.in:443/x", "https://portal.example.edu.in"), "case/default port");
        check(!PortalUrl.isSameOrigin("http://portal.example.edu.in/x", "https://portal.example.edu.in"), "scheme differs");
        check(!PortalUrl.isSameOrigin("https://portal.example.edu.in.evil.example/x", "https://portal.example.edu.in"), "suffix host");
        check(!PortalUrl.isSameOrigin("https://evil.example/?u=https://portal.example.edu.in", "https://portal.example.edu.in"), "url in query");
        check(!PortalUrl.isSameOrigin("https://portal.example.edu.in:8443/", "https://portal.example.edu.in"), "port differs");
        check(!PortalUrl.isSameOrigin("data:text/csv,a,b", "https://portal.example.edu.in"), "data url");
        check(!PortalUrl.isSameOrigin(null, "https://portal.example.edu.in"), "null url");

        System.out.println(passed + " passed, " + failed + " failed");
        if (failed > 0) System.exit(1);
    }

    private static void ok(String input, boolean debug, String expected) {
        PortalUrl.Result r = PortalUrl.normalize(input, debug);
        check(r.ok() && expected.equals(r.url), "accept '" + input + "' -> " + expected + " (got " + r.url + ", " + r.error + ")");
    }

    private static void bad(String input, boolean debug) {
        PortalUrl.Result r = PortalUrl.normalize(input, debug);
        check(!r.ok() && r.error != null, "reject '" + input + "' (got " + r.url + ")");
    }

    private static void check(boolean condition, String name) {
        if (condition) passed++;
        else {
            failed++;
            System.out.println("FAIL: " + name);
        }
    }
}
