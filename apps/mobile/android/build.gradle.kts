// MAPBOX_DOWNLOADS_TOKEN lives in local.properties (gitignored) — a secret
// (scope Downloads:Read) generated back in TOR-70 for this exact purpose,
// never used until now because no package needed the Mapbox SDK download
// repo before mapbox_maps_flutter (TOR-22). Read here, not via System.getenv,
// so a fresh machine only needs the one local.properties file to build.
val mapboxDownloadsToken: String =
    java.util.Properties().apply {
        val propsFile = rootProject.file("local.properties")
        if (propsFile.exists()) load(propsFile.inputStream())
    }.getProperty("MAPBOX_DOWNLOADS_TOKEN", "")

allprojects {
    repositories {
        google()
        mavenCentral()
        maven {
            url = uri("https://api.mapbox.com/downloads/v2/releases/maven")
            authentication {
                create<BasicAuthentication>("basic")
            }
            credentials {
                username = "mapbox"
                password = mapboxDownloadsToken
            }
        }
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
