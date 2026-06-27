package com.pggateway.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;

/**
 * SNAP-style symmetric service signature (Bank Indonesia Open API). The partner (PJP) and the
 * gateway both hold the same client secret; each request is signed so a tampered body, a replayed
 * call, or a forged caller is rejected at the door.
 *
 * String-to-sign (colon-delimited, SNAP symmetric convention):
 * <pre>
 *   {HTTP-METHOD}:{relative-path}:{X-CLIENT-KEY}:{lowerHex(SHA-256(body))}:{X-TIMESTAMP}
 * </pre>
 * Signature = Base64( HMAC-SHA512( stringToSign, clientSecret ) ).
 *
 * The PJP sends X-CLIENT-KEY, X-TIMESTAMP (ISO-8601 with offset) and X-SIGNATURE; the gateway
 * recomputes and compares in constant time. Body is hashed over the exact bytes transmitted, so
 * the caller must sign the same bytes it sends.
 */
public final class SnapSignature {

    private SnapSignature() {}

    /** lowercase hex of SHA-256 over the raw request body (empty body hashes the empty string). */
    public static String bodyHashHex(byte[] body) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(body == null ? new byte[0] : body);
            return HexFormat.of().formatHex(h);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static String stringToSign(String method, String path, String clientKey,
                                      String bodyHashHex, String timestamp) {
        return method + ":" + path + ":" + clientKey + ":" + bodyHashHex + ":" + timestamp;
    }

    /** Base64( HMAC-SHA512( stringToSign, secret ) ). */
    public static String sign(String secret, String stringToSign) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            byte[] sig = mac.doFinal(stringToSign.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(sig);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Constant-time comparison — never short-circuits on the first differing byte. */
    public static boolean matches(String expected, String provided) {
        if (expected == null || provided == null) return false;
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                provided.getBytes(StandardCharsets.UTF_8));
    }
}
