package uz.reestrmkd.backend.domain.common.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class FormatUtils {

    private static final Pattern TAILING_DIGITS = Pattern.compile("(\\d+)$");

    private FormatUtils() {
    }

    public static String formatByGroups(String value, int... groups) {
        String digits = String.valueOf(value == null ? "" : value).replaceAll("\\D", "");
        int maxLen = 0;
        for (int group : groups) {
            maxLen += group;
        }

        String normalized = digits.substring(0, Math.min(digits.length(), maxLen));
        List<String> parts = new ArrayList<>();

        int offset = 0;
        for (int len : groups) {
            int end = Math.min(offset + len, normalized.length());
            if (offset >= end) {
                break;
            }
            parts.add(normalized.substring(offset, end));
            offset += len;
        }

        return String.join(":", parts);
    }

    public static String formatComplexCadastre(String value) {
        return formatByGroups(value, 2, 2, 2, 2, 2, 4);
    }

    public static String formatBuildingCadastre(String value) {
        return formatByGroups(value, 2, 2, 2, 2, 2, 5);
    }

    public static int getNextSequenceNumber(List<String> existingCodes, String prefix) {
        int max = 0;
        if (existingCodes == null) {
            return 1;
        }

        for (String code : existingCodes) {
            if (code == null || code.isBlank()) {
                continue;
            }

            String normalized = code.trim();
            if (prefix != null && !prefix.isBlank() && !normalized.startsWith(prefix)) {
                continue;
            }

            int number;
            if (prefix != null && !prefix.isBlank()) {
                String numericPart = normalized.substring(Math.min(prefix.length(), normalized.length()));
                number = parseIntOrZero(numericPart);
            } else {
                Matcher matcher = TAILING_DIGITS.matcher(normalized);
                number = matcher.find() ? parseIntOrZero(matcher.group(1)) : 0;
            }

            if (number > max) {
                max = number;
            }
        }

        return max + 1;
    }

    private static int parseIntOrZero(String value) {
        try {
            return Integer.parseInt(Objects.requireNonNullElse(value, "0"));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }
}
