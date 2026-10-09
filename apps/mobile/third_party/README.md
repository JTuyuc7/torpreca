# third_party/

Vendored (copied-in, not `flutter pub`-managed) copies of third-party packages that need a local patch this project can't apply any other way — see each subfolder's own note for what changed and why.

## mapbox_maps_flutter (2.9.0)

**Why this exists (TOR-22/TOR-132, 13 sep 2026):** upstream `mapbox_maps_flutter` 2.9.0 hardcodes `compileSdk 33` in `android/build.gradle` — too low for its own transitive androidx dependencies (`flutter_plugin_android_lifecycle`, `androidx.core`, etc., which require compiling against API 34+), so `flutter build apk --release` fails AGP's `checkReleaseAarMetadata` check (debug builds are unaffected — that check only runs for release).

Newer upstream releases (2.20.0, 2.30.1) were tried instead of patching and rejected — see `context/mobile/TOR-22-mapa-principal.md` for the full comparison:
- `2.30.1` fails to build at all: its `build.gradle` assumes AGP 9's "Kotlin built-in" support provides a `kotlin { }` DSL extension that this project's toolchain doesn't register.
- `2.20.0` builds its Gradle config fine, but its own Kotlin **source** doesn't compile against the Mapbox Core SDK version resolved here (unresolved references like `PointDecoder`, `_PerformanceStatisticsApi`).

A Gradle-side override (forcing `compileSdk` from the app's `android/build.gradle.kts` for every Android library subproject, via `afterEvaluate`) was also tried and is **not possible**: AGP 9 reads and locks `compileSdk` during a library module's own configuration, before any `afterEvaluate` callback can run — confirmed by Gradle's own error ("It has already been read to configure this project... Consider... using the variant API" — `compileSdk` specifically isn't exposed through the Variant API either).

**Changes from upstream** are both in `android/build.gradle`: (1) `compileSdk 33` → `compileSdk 36` (see the comment at that line); (2) added 3 oct 2026 — `com.mapbox.maps:android:11.13.0` → `com.mapbox.maps:android-ndk27:11.13.0`, because Play Console rejected the production build with "Your app does not support 16 KB memory page sizes" (the default artifact's `libmapbox-maps.so`, `libmapbox-common.so` and `libc++_shared.so` were 4 KB-aligned; the NDK 27 artifact aligns them to 16 KB, verified by reading the ELF `p_align` of every `.so` in the `.aab`). Nothing else — `lib/` (the Dart API) and the rest of `android/` are untouched, so diffing against a fresh `pub.dev` download of 2.9.0 should show only those two lines.

**License:** Mapbox's own TOS permits modifying the SDK for use with Mapbox products, as long as changes don't affect billing/accounting/telemetry code — this change is a build-config number, unrelated to any of that. See `mapbox_maps_flutter/LICENSE`.

**Maintenance note:** this package no longer updates via `flutter pub upgrade` — it's pinned as a `path:` dependency in `apps/mobile/pubspec.yaml`. Revisit when a real upstream release properly supports this project's AGP/Kotlin toolchain (tracked as **TOR-132** in the Backlog): delete this folder, point `pubspec.yaml` back at the hosted version, and re-verify `flutter build apk --release`.