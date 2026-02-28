package uz.reestrmkd.backendjpa;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

class ApiParityContractTest {
    private static final Pattern CLASS_REQUEST_MAPPING = Pattern.compile("@RequestMapping\\(([^)]*)\\)");
    private static final Pattern MAPPING = Pattern.compile("@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\\(([^)]*)\\)");
    private static final Pattern NO_ARG_MAPPING = Pattern.compile("@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)(?!\\s*\\()\\b");
    private static final Set<String> ALLOWED_OK_STUB_ROUTES = Set.of("GET /api/v1/ops/ping");
    private static final Set<String> ALLOWED_FRONTEND_LEGACY_PATHS = Set.of("/api/v1/basements");
    private static final Set<String> ALLOWED_RESPONSE_KEY_GAPS = Set.of(
            "GET /api/v1/blocks/{blockId}/units -> entranceMap",
            "GET /api/v1/projects -> totalPages",
            "POST /api/v1/blocks/{blockId}/common-areas/clear -> deleted"
    );

    @Test
    void javaJpaRoutesMustMatchNodeRouteManifestExactly() throws Exception {
        Set<String> nodeRoutes = readNodeRoutes();
        Set<String> javaRoutes = readJavaRouteKeys();

        Set<String> missingInJava = new TreeSet<>(nodeRoutes);
        missingInJava.removeAll(javaRoutes);

        Set<String> extraInJava = new TreeSet<>(javaRoutes);
        extraInJava.removeAll(nodeRoutes);

        assertTrue(missingInJava.isEmpty(), "Missing routes in Java JPA: " + missingInJava);
        assertTrue(extraInJava.isEmpty(), "Extra routes in Java JPA: " + extraInJava);
    }

    @Test
    void everyApiV1EndpointMustBeBackedByRealLogic() throws Exception {
        List<RouteImplementation> implementations = readJavaImplementations();

        for (RouteImplementation impl : implementations) {
            if (!impl.routeKey.startsWith("GET /api/v1")
                    && !impl.routeKey.startsWith("POST /api/v1")
                    && !impl.routeKey.startsWith("PUT /api/v1")
                    && !impl.routeKey.startsWith("DELETE /api/v1")
                    && !impl.routeKey.startsWith("PATCH /api/v1")) {
                continue;
            }

            boolean stubbedOk = impl.methodChunk.contains("Map.of(\"ok\", true)")
                    || impl.methodChunk.contains("return Map.of(\"ok\", true);");

            if (stubbedOk) {
                assertTrue(ALLOWED_OK_STUB_ROUTES.contains(impl.routeKey),
                        () -> "Stub Map.of(ok=true) detected for " + impl.routeKey + " in " + impl.file);
            }

            if (isMutationRoute(impl.routeKey)) {
                assertTrue(containsDelegationCall(impl.methodChunk),
                        () -> "Mutation endpoint must delegate to service logic: " + impl.routeKey + " in " + impl.file);
            }
        }
    }


    @Test
    void nodeCriticalBehaviorContractsMustBeImplementedInJpaServices() throws Exception {
        String versioningService = readFile("src/main/java/uz/reestrmkd/backendjpa/service/VersioningJpaService.java");
        String lockService = readFile("src/main/java/uz/reestrmkd/backendjpa/service/LockJpaService.java");
        String lockController = readFile("src/main/java/uz/reestrmkd/backendjpa/api/LockController.java");
        String versioningController = readFile("src/main/java/uz/reestrmkd/backendjpa/api/VersioningController.java");

        assertTrue(versioningService.contains("entityType and entityId are required"),
                "Versioning list endpoint must require entityType and entityId like Node implementation");
        assertTrue(lockService.contains("HttpStatus.NOT_FOUND, \"Lock not found\""),
                "Lock refresh/release should map missing lock to 404 like Node implementation");
        assertTrue(lockService.contains("\"reason\", \"LOCK_REFRESHED\""),
                "Lock refresh response should include reason field like Node implementation");
        assertTrue(lockService.contains("\"reason\", \"LOCK_RELEASED\""),
                "Lock release response should include reason field like Node implementation");
        assertTrue(lockController.contains("@RequestHeader(value = \"X-User-Id\""),
                "Lock endpoints should derive actor from request headers rather than body impersonation fields");
        assertFalse(lockController.contains("body.get(\"userId\")"),
                "Lock endpoints should not trust userId from request body");
    }


    @Test
    void frontendApiRequestsMustHaveMatchingJavaJpaEndpoints() throws Exception {
        Set<String> frontendPaths = readFrontendApiPaths();
        List<String> javaPaths = readJavaImplementations().stream()
                .map(route -> route.routeKey.substring(route.routeKey.indexOf(' ') + 1))
                .toList();

        Set<String> missing = new TreeSet<>();
        for (String frontendPath : frontendPaths) {
            if (ALLOWED_FRONTEND_LEGACY_PATHS.contains(frontendPath)) continue;
            boolean matched = javaPaths.stream().anyMatch(javaPath -> pathMatches(frontendPath, javaPath));
            if (!matched) missing.add(frontendPath);
        }

        assertTrue(missing.isEmpty(), "Frontend API paths without Java JPA endpoint: " + missing);
    }


    @Test
    void fullRegistryPayloadShapeMustMatchNodeContract() throws Exception {
        String nodeProjectRoutes = readFile("../backend/src/project-extended-routes.js");
        String javaProjectService = readFile("src/main/java/uz/reestrmkd/backendjpa/service/ProjectJpaService.java");

        List<String> topLevelKeys = List.of("buildings", "blocks", "floors", "entrances", "units");
        for (String key : topLevelKeys) {
            assertTrue(nodeProjectRoutes.contains(key + ":"), "Node full-registry should include key: " + key);
            assertTrue(javaProjectService.contains("\"" + key + "\", payload" + Character.toUpperCase(key.charAt(0)) + key.substring(1)),
                    "Java full-registry should include top-level key: " + key);
        }

        List<String> unitKeys = List.of("id", "uid", "unitCode", "num", "number", "type", "hasMezzanine", "mezzanineType", "area", "livingArea", "usefulArea", "rooms", "floorId", "entranceId", "buildingId", "buildingCode", "cadastreNumber", "explication");
        for (String key : unitKeys) {
            assertTrue(nodeProjectRoutes.contains(key + ":"), "Node full-registry unit payload should include key: " + key);
            assertTrue(javaProjectService.contains("item.put(\"" + key + "\""), "Java full-registry unit payload should include key: " + key);
        }

        List<String> roomKeys = List.of("id", "type", "label", "area", "height", "level", "isMezzanine");
        for (String key : roomKeys) {
            assertTrue(nodeProjectRoutes.contains(key + ":"), "Node room payload should include key: " + key);
            assertTrue(javaProjectService.contains("mapped.put(\"" + key + "\""), "Java room payload should include key: " + key);
        }
    }

    @Test
    void lockAndVersioningPayloadShapeMustMatchNodeContract() throws Exception {
        String nodeLocksRoutes = readFile("../backend/src/locks-routes.js");
        String javaLockService = readFile("src/main/java/uz/reestrmkd/backendjpa/service/LockJpaService.java");
        String nodeVersioningRoutes = readFile("../backend/src/project-extended-routes.js");
        String javaVersioningService = readFile("src/main/java/uz/reestrmkd/backendjpa/service/VersioningJpaService.java");

        List<String> lockResponseKeys = List.of("ok", "reason", "message", "expiresAt");
        for (String key : lockResponseKeys) {
            assertTrue(nodeLocksRoutes.contains(key), "Node lock handlers should include response field: " + key);
            assertTrue(javaLockService.contains("\"" + key + "\""), "Java lock handlers should include response field: " + key);
        }

        List<String> versioningStatuses = List.of("PENDING", "CURRENT", "PREVIOUS", "REJECTED");
        for (String status : versioningStatuses) {
            assertTrue(nodeVersioningRoutes.contains("'" + status + "'"), "Node versioning handlers should use status: " + status);
            assertTrue(javaVersioningService.contains("'" + status + "'"), "Java versioning handlers should use status: " + status);
        }

        List<String> versioningActorFields = List.of("createdBy", "approvedBy", "declinedBy", "reason");
        for (String field : versioningActorFields) {
            assertTrue(nodeVersioningRoutes.contains(field), "Node versioning handlers should include field: " + field);
            assertTrue(javaVersioningService.contains(field) || readFile("src/main/java/uz/reestrmkd/backendjpa/api/VersioningController.java").contains(field),
                    "Java versioning flow should include field: " + field);
        }
    }


    @Test
    void allNodeObjectResponseKeysMustBePresentInJavaCodebase() throws Exception {
        Map<String, Set<String>> nodeRouteKeys = readNodeRoutesWithObjectResponseKeys();
        String javaCombined = readAllJavaApiAndServiceSources();

        Set<String> missing = new TreeSet<>();
        for (Map.Entry<String, Set<String>> entry : nodeRouteKeys.entrySet()) {
            String route = entry.getKey();
            Set<String> keys = entry.getValue();
            if (keys.isEmpty()) continue;
            for (String key : keys) {
                String miss = route + " -> " + key;
                if (!javaCombined.contains("\"" + key + "\"") && !ALLOWED_RESPONSE_KEY_GAPS.contains(miss)) {
                    missing.add(miss);
                }
            }
        }

        assertTrue(missing.isEmpty(), "Node response keys not found in Java sources: " + missing);
    }

    private boolean isMutationRoute(String routeKey) {
        return routeKey.startsWith("POST ")
                || routeKey.startsWith("PUT ")
                || routeKey.startsWith("PATCH ")
                || routeKey.startsWith("DELETE ");
    }

    private boolean containsDelegationCall(String methodChunk) {
        Pattern delegation = Pattern.compile("return\\s+[a-zA-Z_][a-zA-Z0-9_]*\\.[a-zA-Z_][a-zA-Z0-9_]*\\(");
        return delegation.matcher(methodChunk).find();
    }


    private Set<String> readFrontendApiPaths() throws IOException {
        Set<String> paths = new TreeSet<>();
        for (Path file : locateFrontendApiFiles()) {
            String source = Files.readString(file);

            Matcher requestCall = Pattern.compile("request\\(\\s*(?:`([^`]+)`|'([^']+)')").matcher(source);
            while (requestCall.find()) {
                String path = requestCall.group(1) != null ? requestCall.group(1) : requestCall.group(2);
                addFrontendPath(paths, path);
            }

            Matcher fetchCall = Pattern.compile("fetch\\([^\\n]*?/api/v1([^\\\"`']*)").matcher(source);
            while (fetchCall.find()) {
                addFrontendPath(paths, "/api/v1" + fetchCall.group(1));
            }
        }
        return paths;
    }

    private List<Path> locateFrontendApiFiles() {
        Path[] candidates = new Path[] {
                Path.of("../../src/lib/bff-client.js"),
                Path.of("../../src/lib/auth-service.js"),
                Path.of("src/lib/bff-client.js"),
                Path.of("src/lib/auth-service.js")
        };

        List<Path> files = new ArrayList<>();
        for (Path candidate : candidates) {
            if (Files.exists(candidate) && Files.isRegularFile(candidate)) files.add(candidate);
        }
        if (files.isEmpty()) throw new IllegalStateException("Cannot locate frontend API client files from module root");
        return files;
    }

    private void addFrontendPath(Set<String> paths, String rawPath) {
        if (rawPath == null || !rawPath.startsWith("/api/v1")) return;
        String normalized = replaceTemplateExpressions(rawPath);
        int q = normalized.indexOf('?');
        if (q >= 0) normalized = normalized.substring(0, q);
        normalized = normalized.replaceAll("/+", "/");
        String[] segments = normalized.split("/");
        for (int idx = 0; idx < segments.length; idx++) {
            String segment = segments[idx];
            if (!"{param}".equals(segment) && segment.endsWith("{param}")) {
                segments[idx] = segment.substring(0, segment.length() - "{param}".length());
            }
        }
        normalized = String.join("/", segments);
        if (normalized.endsWith("/") && normalized.length() > 1) normalized = normalized.substring(0, normalized.length() - 1);
        if (!normalized.isBlank()) paths.add(normalized);
    }

    private String replaceTemplateExpressions(String value) {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (ch == '$' && i + 1 < value.length() && value.charAt(i + 1) == '{') {
                i += 2;
                int depth = 1;
                while (i < value.length() && depth > 0) {
                    char c = value.charAt(i);
                    if (c == '{') depth++;
                    else if (c == '}') depth--;
                    i++;
                }
                out.append("{param}");
                i--; // for-loop increment compensation
                continue;
            }
            out.append(ch);
        }
        return out.toString();
    }


    private boolean pathMatches(String frontendPath, String javaPath) {
        String[] frontendSegments = frontendPath.replaceAll("/$", "").split("/");
        String[] javaSegments = javaPath.replaceAll("/$", "").split("/");
        if (frontendSegments.length != javaSegments.length) return false;

        for (int i = 0; i < frontendSegments.length; i++) {
            String f = frontendSegments[i];
            String j = javaSegments[i];
            if (j.matches("\\{[^}]+}")) continue;
            if (!Objects.equals(f, j)) return false;
        }
        return true;
    }



    private Map<String, Set<String>> readNodeRoutesWithObjectResponseKeys() throws IOException {
        Map<String, Set<String>> routeKeys = new LinkedHashMap<>();
        Path srcDir = locateNodeBackendSrcDir();
        Pattern nodeRoute = Pattern.compile("app\\.(get|post|put|delete|patch)\\(\\s*['\"]([^'\"]+)['\"]");

        try (DirectoryStream<Path> stream = Files.newDirectoryStream(srcDir, "*.js")) {
            for (Path file : stream) {
                String source = Files.readString(file);
                List<Match> matches = new ArrayList<>();
                Matcher matcher = nodeRoute.matcher(source);
                while (matcher.find()) {
                    String path = normalizeNodePath(matcher.group(2));
                    if (!path.startsWith("/api/v1")) continue;
                    matches.add(new Match(matcher.start(), matcher.end(), matcher.group(1).toUpperCase(Locale.ROOT), path));
                }

                for (int i = 0; i < matches.size(); i++) {
                    Match current = matches.get(i);
                    int chunkEnd = i + 1 < matches.size() ? matches.get(i + 1).start : source.length();
                    String chunk = source.substring(current.end, chunkEnd);
                    String routeKey = current.method + " " + current.path;
                    routeKeys.put(routeKey, extractReplySendObjectKeys(chunk));
                }
            }
        }

        return routeKeys;
    }


    private Set<String> extractReplySendObjectKeys(String sourceChunk) {
        int sendIdx = sourceChunk.indexOf("reply.send({");
        if (sendIdx < 0) return Set.of();
        int braceOpen = sourceChunk.indexOf('{', sendIdx);
        if (braceOpen < 0) return Set.of();

        int depth = 0;
        int end = -1;
        for (int i = braceOpen; i < sourceChunk.length(); i++) {
            char c = sourceChunk.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') {
                depth--;
                if (depth == 0) {
                    end = i;
                    break;
                }
            }
        }
        if (end < 0) return Set.of();

        String body = sourceChunk.substring(braceOpen + 1, end);
        Set<String> keys = new LinkedHashSet<>();
        Matcher keyMatcher = Pattern.compile("(?m)(^|\s|,)([A-Za-z_][A-Za-z0-9_]*)\s*:").matcher(body);
        while (keyMatcher.find()) keys.add(keyMatcher.group(2));
        return keys;
    }

    private record Match(int start, int end, String method, String path) {}


    private String readAllJavaApiAndServiceSources() throws IOException {
        StringBuilder sb = new StringBuilder();
        Path[] dirs = new Path[] {
                Path.of("src/main/java/uz/reestrmkd/backendjpa/api"),
                Path.of("src/main/java/uz/reestrmkd/backendjpa/service")
        };

        for (Path dir : dirs) {
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir, "*.java")) {
                for (Path file : stream) {
                    sb.append(Files.readString(file)).append("\n");
                }
            }
        }
        return sb.toString();
    }

    private Set<String> readNodeRoutes() throws IOException {
        Set<String> routes = new TreeSet<>();
        Path srcDir = locateNodeBackendSrcDir();
        Pattern nodeRoute = Pattern.compile("app\\.(get|post|put|delete|patch)\\(\\s*['\"]([^'\"]+)['\"]");

        try (DirectoryStream<Path> stream = Files.newDirectoryStream(srcDir, "*.js")) {
            for (Path file : stream) {
                String source = Files.readString(file);
                Matcher matcher = nodeRoute.matcher(source);
                while (matcher.find()) {
                    String method = matcher.group(1).toUpperCase(Locale.ROOT);
                    String path = matcher.group(2);
                    if (!path.startsWith("/api/v1")) continue;
                    routes.add(method + " " + normalizeNodePath(path));
                }
            }
        }

        return routes;
    }

    private Set<String> readJavaRouteKeys() throws IOException {
        Set<String> keys = new TreeSet<>();
        for (RouteImplementation impl : readJavaImplementations()) {
            keys.add(impl.routeKey);
        }
        return keys;
    }

    private List<RouteImplementation> readJavaImplementations() throws IOException {
        List<RouteImplementation> routes = new ArrayList<>();
        Path apiDir = Path.of("src/main/java/uz/reestrmkd/backendjpa/api");

        try (DirectoryStream<Path> stream = Files.newDirectoryStream(apiDir, "*Controller.java")) {
            for (Path file : stream) {
                String source = Files.readString(file);
                String basePath = extractClassRequestMapping(source);
                routes.addAll(extractMappedMethods(file, source, basePath));
            }
        }

        return routes;
    }

    private String extractClassRequestMapping(String source) {
        Matcher classMatcher = CLASS_REQUEST_MAPPING.matcher(source);
        if (!classMatcher.find()) return "";

        String args = classMatcher.group(1);
        String explicit = extractFirstQuotedValue(args);
        return explicit == null ? "" : explicit;
    }

    private List<RouteImplementation> extractMappedMethods(Path file, String source, String basePath) {
        List<RouteImplementation> routes = new ArrayList<>();

        Matcher mappingMatcher = MAPPING.matcher(source);
        while (mappingMatcher.find()) {
            String method = toHttpMethod(mappingMatcher.group(1));
            String subPath = extractFirstQuotedValue(mappingMatcher.group(2));
            if (subPath == null) subPath = "";
            String fullPath = basePath + subPath;
            if (!fullPath.startsWith("/api/v1")) continue;
            routes.add(new RouteImplementation(method + " " + normalizeJavaPath(fullPath), extractMethodChunk(source, mappingMatcher.start(), mappingMatcher.end()), file));
        }

        Matcher noArgMatcher = NO_ARG_MAPPING.matcher(source);
        while (noArgMatcher.find()) {
            String method = toHttpMethod(noArgMatcher.group(1));
            String fullPath = basePath;
            if (!fullPath.startsWith("/api/v1")) continue;
            routes.add(new RouteImplementation(method + " " + normalizeJavaPath(fullPath), extractMethodChunk(source, noArgMatcher.start(), noArgMatcher.end()), file));
        }

        return routes;
    }

    private String extractMethodChunk(String source, int annotationStart, int annotationEnd) {
        int openBrace = source.indexOf('{', annotationEnd);
        if (openBrace < 0) return source.substring(annotationStart);
        int level = 0;
        for (int i = openBrace; i < source.length(); i++) {
            char c = source.charAt(i);
            if (c == '{') level++;
            if (c == '}') {
                level--;
                if (level == 0) {
                    return source.substring(annotationStart, i + 1);
                }
            }
        }
        return source.substring(annotationStart);
    }

    private String toHttpMethod(String mappingName) {
        return switch (mappingName) {
            case "GetMapping" -> "GET";
            case "PostMapping" -> "POST";
            case "PutMapping" -> "PUT";
            case "DeleteMapping" -> "DELETE";
            case "PatchMapping" -> "PATCH";
            default -> throw new IllegalStateException("Unexpected method annotation: " + mappingName);
        };
    }

    private Path locateNodeBackendSrcDir() {
        Path[] candidates = new Path[] {
                Path.of("../backend/src"),
                Path.of("apps/backend/src")
        };

        for (Path candidate : candidates) {
            if (Files.exists(candidate) && Files.isDirectory(candidate)) return candidate;
        }

        throw new IllegalStateException("Cannot locate Node backend src directory from module root");
    }

    private String normalizeNodePath(String nodePath) {
        return nodePath.replaceAll(":([A-Za-z0-9_]+)", "{$1}");
    }

    private String normalizeJavaPath(String javaPath) {
        return javaPath;
    }

    private String readFile(String moduleRelativePath) throws IOException {
        return Files.readString(Path.of(moduleRelativePath));
    }

    private String extractFirstQuotedValue(String annotationArgs) {
        Matcher valueMatcher = Pattern.compile("\\\"([^\\\"]*)\\\"").matcher(annotationArgs);
        if (!valueMatcher.find()) return null;
        return valueMatcher.group(1);
    }

    private record RouteImplementation(String routeKey, String methodChunk, Path file) {
    }
}
