# Android APK

The repository contains the web source and Capacitor configuration. Native Android source can be generated reproducibly from the locked dependencies:

```sh
npm ci
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

Requires Java 21 and the Android SDK. Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

The **Build Android APK** GitHub Actions workflow performs these steps and uploads a debug APK artifact. A successful workflow run is required before an APK is available; adding the workflow alone is not a completed APK build. This debug build is for testing; production signing is not configured.
