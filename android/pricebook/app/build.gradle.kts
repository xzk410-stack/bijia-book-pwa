plugins {
    id("com.android.application")
}

val releaseStorePath = System.getenv("BIJIABU_KEYSTORE")
val releaseStorePassword = System.getenv("BIJIABU_STORE_PASSWORD")
val releaseKeyAlias = System.getenv("BIJIABU_KEY_ALIAS")
val releaseKeyPassword = System.getenv("BIJIABU_KEY_PASSWORD")

android {
    namespace = "com.bijiabu.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.bijiabu.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 27
        versionName = "1.6.7"
    }

    if (
        releaseStorePath != null &&
        releaseStorePassword != null &&
        releaseKeyAlias != null &&
        releaseKeyPassword != null
    ) {
        signingConfigs {
            create("release") {
                storeFile = file(releaseStorePath)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }
}


dependencies {
    implementation("androidx.activity:activity:1.10.0")
    implementation("androidx.browser:browser:1.9.0")
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
}
