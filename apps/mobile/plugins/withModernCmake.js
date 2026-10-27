// Faz todos os módulos nativos (app e bibliotecas) compilarem com um CMake recente.
// O padrão do Android Gradle Plugin é o CMake 3.22.1, cujo ninja não aceita caminhos
// longos no Windows: o build falha com "ninja: error: mkdir(...)" ou "Filename longer
// than 260 characters" (react-native-reanimated, gesture-handler...). O ninja do
// CMake 3.31 aceita caminhos longos. O CMake 3.31.6 precisa estar no Android SDK
// (SDK Manager > SDK Tools > CMake 3.31.6); veja o README.
const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins');

const CMAKE_VERSION = '3.31.6';
const marker = '// cvd: CMake recente para caminhos longos';

// Bibliotecas: definido antes de o AGP finalizar a configuração de cada uma.
const librariesSnippet = `
${marker}
subprojects { project ->
    // Projetos já avaliados (módulos do Expo) não compilam C++ aqui.
    if (project.state.executed) return
    project.afterEvaluate {
        def android = project.extensions.findByName('android')
        if (android != null) {
            android.externalNativeBuild.cmake.version = '${CMAKE_VERSION}'
        }
    }
}
`;

// O app: o plugin do React Native define o CMakeLists dele, mas não a versão.
const appSnippet = `
${marker}
android.externalNativeBuild.cmake.version = '${CMAKE_VERSION}'
`;

function append(contents, snippet) {
  return contents.includes(marker) ? contents : contents + snippet;
}

module.exports = function withModernCmake(config) {
  config = withProjectBuildGradle(config, (mod) => {
    mod.modResults.contents = append(mod.modResults.contents, librariesSnippet);
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = append(mod.modResults.contents, appSnippet);
    return mod;
  });
};
