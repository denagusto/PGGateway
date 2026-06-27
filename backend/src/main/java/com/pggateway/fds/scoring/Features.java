package com.pggateway.fds.scoring;

import java.util.Map;

/** Typed, null-safe accessors over the feature map the detectors read. */
public final class Features {

    private Features() {}

    public static long lng(Map<String, Object> f, String k) {
        Object v = f.get(k);
        return v instanceof Number n ? n.longValue() : 0L;
    }

    public static int integer(Map<String, Object> f, String k) {
        Object v = f.get(k);
        return v instanceof Number n ? n.intValue() : 0;
    }

    public static double dbl(Map<String, Object> f, String k) {
        Object v = f.get(k);
        return v instanceof Number n ? n.doubleValue() : 0.0;
    }

    public static boolean bool(Map<String, Object> f, String k) {
        return Boolean.TRUE.equals(f.get(k));
    }

    public static String str(Map<String, Object> f, String k) {
        Object v = f.get(k);
        return v == null ? "" : v.toString();
    }

    /** Rupiah formatted with thousands separators, e.g. 600000000 -> "Rp 600.000.000". */
    public static String rupiah(long rupiah) {
        StringBuilder sb = new StringBuilder(Long.toString(Math.abs(rupiah)));
        for (int i = sb.length() - 3; i > 0; i -= 3) sb.insert(i, '.');
        return (rupiah < 0 ? "-Rp " : "Rp ") + sb;
    }
}
