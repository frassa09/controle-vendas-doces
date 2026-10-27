// Assina o APK de release com a chave definida em ~/.gradle/gradle.properties
// (CVD_UPLOAD_STORE_FILE, CVD_UPLOAD_KEY_ALIAS, CVD_UPLOAD_STORE_PASSWORD,
// CVD_UPLOAD_KEY_PASSWORD). Sem essas propriedades, cai na chave de debug, o que
// serve para testar mas não para atualizar um app já instalado com a chave real.
const { withAppBuildGradle } = require('expo/config-plugins');

const releaseSigningConfig = `
        release {
            if (findProperty('CVD_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('CVD_UPLOAD_STORE_FILE'))
                storePassword findProperty('CVD_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('CVD_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('CVD_UPLOAD_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (!gradle.includes("findProperty('CVD_UPLOAD_STORE_FILE')")) {
      gradle = gradle.replace(/signingConfigs\s*\{/, (match) => `${match}${releaseSigningConfig}`);
      gradle = gradle.replace(
        /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
        "$1signingConfig findProperty('CVD_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
      );
    }
    mod.modResults.contents = gradle;
    return mod;
  });
};
