# Mi recetario — app Android con Capacitor

Tu recetario (antes un solo archivo HTML) empaquetado como aplicación nativa de
Android con **Capacitor 8**, más un **GitHub Action** que compila el APK por ti.

La app sigue siendo HTML + CSS + JavaScript sin framework ni paso de compilación:
lo único que cambia es que ahora vive en `www/` y un contenedor nativo la abre a
pantalla completa.

---

## Qué hay aquí

| Ruta | Para qué sirve |
| --- | --- |
| `www/index.html` | **La app** (copia de trabajo; edita aquí de ahora en adelante) |
| `www/fonts/` | Tipografías Caveat, Fraunces y Nunito alojadas localmente (offline) |
| `www/icons/`, `www/manifest.webmanifest` | Iconos y manifiesto para instalarla también como PWA |
| `capacitor.config.json` | Configuración de Capacitor (id de app, nombre, barras del sistema) |
| `android/` | Proyecto Android nativo, listo para Android Studio |
| `.github/workflows/android.yml` | Compila el APK en GitHub y publica Releases |
| `tests/` | Pruebas automáticas de la app (se ejecutan en cada build) |
| `scripts/` | Utilidades: fuentes, iconos y servidor local |
| `Mi recetario(1).html` | Tu archivo original, **sin tocar**. Es solo respaldo |

> ⚠️ A partir de ahora edita `www/index.html`. Si editas el HTML de la raíz, la
> app no cambia: ese archivo ya no se usa.

---

## 1. Probarla en el navegador

```bash
npm install
npm run serve          # http://localhost:5173
npm test               # comprueba que la app sigue funcionando (sin navegador)
```

Sirve para revisar cambios rápido. Los datos se guardan en `localStorage`, así
que lo que agregues aquí no aparece en el teléfono (son almacenamientos distintos).

---

## 2. Compilar el APK en tu computadora

Requisitos: **Node 22 o superior**, **JDK 21** y **Android Studio** (o el SDK de
Android + Gradle). En Windows el JDK se instala con
`winget install EclipseAdoptium.Temurin.21.JDK`.

```bash
npm install
npm run open:android   # sincroniza y abre Android Studio
```

En Android Studio: **Run ▶** con un emulador o un teléfono conectado por USB.

Sin abrir Android Studio:

```bash
npm run build:apk      # Windows
npm run build:apk:ci   # Linux / macOS
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.
Para instalarlo por cable:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

> Cada vez que cambies algo en `www/`, ejecuta `npm run sync` (o
> `npx cap sync android`) antes de compilar. Si no, Android Studio compila la
> versión anterior.

---

## 3. Compilarlo con GitHub Actions (sin instalar nada)

Es la vía más simple si no quieres pelear con el SDK.

1. Crea un repositorio en GitHub y sube el proyecto:

   ```bash
   git init
   git add .
   git commit -m "Mi recetario con Capacitor"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/mi-recetario.git
   git push -u origin main
   ```

2. Entra a la pestaña **Actions** del repositorio → workflow **Android** →
   **Run workflow** (también se ejecuta solo con cada push a `main`).

3. Cuando termine, abre la ejecución y descarga el artefacto
   **`mi-recetario-debug`**: dentro está `app-debug.apk`.

4. Pásalo al teléfono (cable, Drive, WhatsApp…) y ábrelo. Android pedirá
   permitir la instalación desde esa fuente.

Tiempo aproximado: 5–8 minutos la primera vez (descarga Gradle y el SDK).
Antes de compilar, el Action ejecuta `npm test`: si un cambio en la app la deja
rota, el build falla ahí y no genera un APK defectuoso.

El workflow guarda en caché la **firma de depuración** (`debug-keystore-v1`), así
que los APK de ejecuciones distintas se instalan unos encima de otros como una
actualización normal y conservan tus recetas. Si algún día borras esa caché, el
APK nuevo tendrá otra firma: Android pedirá desinstalar el anterior.

### Versión de publicación (Release)

Al subir un tag que empiece con `v`, se compila la versión `release` y se adjunta
a un Release de GitHub:

```bash
git tag v1.0.0
git push origin v1.0.0
```

- Si configuraste los secretos de firma (abajo) → **APK firmado + AAB** listos
  para Google Play.
- Si no → un APK **sin firmar** (sirve para probar, no para publicar).

El `versionName` sale del tag (`v1.0.0` → `1.0.0`) y el `versionCode` del número
de ejecución, así que cada Release es siempre superior al anterior.

---

## 4. Firmar para Google Play

Genera tu llave una sola vez y **guárdala con mucho cuidado** (si la pierdes no
puedes actualizar la app publicada):

```bash
keytool -genkeypair -v -keystore release.keystore -alias recetario \
  -keyalg RSA -keysize 2048 -validity 10000
```

Convierte el keystore a base64 y cópialo (una sola línea):

```bash
# macOS
base64 -i release.keystore | pbcopy
# Linux
base64 -w0 release.keystore
# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore")) | Set-Clipboard
```

En GitHub: **Settings → Secrets and variables → Actions → New repository secret**

| Secreto | Valor |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | El texto base64 del keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Contraseña del keystore |
| `ANDROID_KEY_ALIAS` | `recetario` (el alias que elegiste) |
| `ANDROID_KEY_PASSWORD` | Contraseña de la llave (suele ser la misma) |

Para compilar firmado en tu equipo (usa la **ruta completa** del keystore, porque
Gradle la resuelve desde `android/app/`):

```bash
cd android
./gradlew assembleRelease \
  -PRELEASE_STORE_FILE="C:/Users/TU-USUARIO/ruta/completa/release.keystore" \
  -PRELEASE_STORE_PASSWORD=tuclave \
  -PRELEASE_KEY_ALIAS=recetario \
  -PRELEASE_KEY_PASSWORD=tuclave \
  -PVERSION_NAME=1.0.0 -PVERSION_CODE=1
```

> `release.keystore` y `*.jks` ya están en `.gitignore`: nunca los subas.

---

## 5. Personalizar

**Nombre e id.** El id (`com.mirecetario.app`) es el identificador permanente en
Android: cámbialo **antes** de publicar y ojo, si lo cambias después de
instalarla se considera otra app. Debe cambiarse en tres sitios:

- `capacitor.config.json` → `appId`
- `android/app/build.gradle` → `namespace` y `applicationId`
- `android/app/src/main/res/values/strings.xml` → `package_name` y `custom_url_scheme`

El nombre visible está en `android/app/src/main/res/values/strings.xml` (`app_name`).

**Iconos y pantalla de inicio.** Se generan con un script (requiere Python 3 +
Pillow):

```bash
npm run icons
```

Modifica `scripts/make-icons.py` si quieres otra imagen, o reemplaza a mano
`android/app/src/main/res/mipmap-*/ic_launcher*.png`.

**Colores del sistema.** `android/app/src/main/res/values/colors.xml`.

**Unidades, moneda y demás.** Todo se ajusta dentro de la app, en la sección
*Configuración*.

---

## 6. Qué se adaptó para que funcione como app nativa

- **Sin conexión:** las tres tipografías se descargan a `www/fonts/` (nada de
  Google Fonts en línea), así que la app abre igual en modo avión.
- **Barras del sistema:** `SystemBars` de Capacitor 8 ajusta los iconos de la
  barra de estado al tema claro/oscuro.
- **Área segura (notch y barra de gestos):** la hoja de estilos consume
  `--safe-area-inset-*`, que Capacitor inyecta en Android y que iOS expone vía
  `env()`. El contenido no queda debajo de la cámara ni de la barra inferior.
- **Botón atrás de Android:** cierra primero el menú, los desplegables y las
  ventanas; desde el detalle vuelve a la lista y solo sale de la app cuando ya
  estás en *Mis recetas*.
- **Encabezado fijo de verdad:** se pega al borde superior y su relleno incluye
  el área segura, así el fondo cubre también la franja de la barra de estado y
  nada se ve pasar por encima al hacer scroll.
- **Toques y rebote:** se desactivó el zoom por doble toque, el resaltado azul de
  los enlaces y el rebote elástico del scroll.
- **Iconos:** adaptativos (fondo verde salvia + libro), con versiones redondas y
  pantallas de inicio para todas las densidades.

---

## 7. Tus datos

Las recetas se guardan en el almacenamiento del WebView (`localStorage`, clave
`recetario-cafe-v1`). Se conservan al cerrar la app y al actualizarla, pero **se
borran si desinstalas la app o borras sus datos**.

Para no perder nada: *Configuración → Respaldo*, copia el texto JSON y guárdalo
en un correo o nota. Para restaurar, pégalo y pulsa **Cargar respaldo**.

---

## 8. Problemas comunes

| Síntoma | Solución |
| --- | --- |
| Cambié la app y el APK sigue igual | Falta `npm run sync` antes de compilar |
| `SDK location not found` | Abre el proyecto una vez en Android Studio, o crea `android/local.properties` con `sdk.dir=C:\\ruta\\al\\Android\\Sdk` |
| `Unsupported class file major version` | Usa JDK 21 (`java -version`) |
| El Action falla en `npm ci` | Borra `package-lock.json`, haz `npm install` y vuelve a subirlo |
| Android bloquea la instalación | Ajustes → permitir instalar apps de esa fuente; o `adb install` |
| "Aplicación no instalada" al actualizar | El APK está firmado con otra clave: desinstala la versión anterior (respalda antes en *Configuración → Respaldo*) |
| `cap sync` no encuentra `www` | Ejecuta los comandos desde la raíz del proyecto |
| `Failed to find package 'tools'` en el Action | `setup-android` pedía ese paquete, ya retirado del SDK. El workflow fija `packages: platform-tools`; no lo quites |

---

## 9. iOS (opcional)

Hace falta una Mac con Xcode:

```bash
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

La app ya está preparada (áreas seguras, fuentes locales, botón atrás no aplica).
Firmar y publicar en App Store requiere cuenta de desarrollador de Apple.
